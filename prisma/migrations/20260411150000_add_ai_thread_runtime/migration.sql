-- AI Agent V1: Thread / Run / Approval runtime
-- 与 AiExecutionRecord 同口径：跨模块 FK 在 SQL 层维护，不在 Prisma schema 声明反向 relation。

-- CreateEnum
CREATE TYPE "AiThreadStatus" AS ENUM (
    'ACTIVE',
    'ARCHIVED'
);

-- CreateEnum
CREATE TYPE "AiSurfaceType" AS ENUM (
    'WORKSPACE',
    'PROJECT',
    'ISSUE',
    'WORKFLOW',
    'DOC'
);

-- CreateEnum
CREATE TYPE "AiPinSource" AS ENUM (
    'ORIGIN',
    'USER',
    'AGENT'
);

-- CreateEnum
CREATE TYPE "AiMessageRole" AS ENUM (
    'USER',
    'ASSISTANT',
    'TOOL',
    'SYSTEM'
);

-- CreateEnum
CREATE TYPE "AiRunStatus" AS ENUM (
    'RUNNING',
    'WAITING_APPROVAL',
    'COMPLETED',
    'FAILED',
    'CANCELLED'
);

-- CreateEnum
CREATE TYPE "AiRunStepKind" AS ENUM (
    'LLM_CALL',
    'TOOL_CALL'
);

-- CreateEnum
CREATE TYPE "AiApprovalStatus" AS ENUM (
    'PENDING',
    'CONFIRMED',
    'REJECTED',
    'EXPIRED'
);

-- AlterTable: Issue 增加 AI 编码 prompt 落点
ALTER TABLE "issues"
ADD COLUMN "ai_handoff_prompt" TEXT,
ADD COLUMN "ai_handoff_prompt_updated_at" TIMESTAMP(3);

-- CreateTable: ai_threads
CREATE TABLE "ai_threads" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "creator_user_id" TEXT NOT NULL,
    "title" TEXT,
    "status" "AiThreadStatus" NOT NULL DEFAULT 'ACTIVE',
    "origin_surface_type" "AiSurfaceType",
    "origin_surface_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_message_at" TIMESTAMP(3),

    CONSTRAINT "ai_threads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_threads_workspace_id_creator_user_id_last_message_at_idx"
ON "ai_threads"("workspace_id", "creator_user_id", "last_message_at");

-- CreateIndex
CREATE INDEX "ai_threads_workspace_id_status_idx"
ON "ai_threads"("workspace_id", "status");

-- CreateTable: ai_thread_context_pins
CREATE TABLE "ai_thread_context_pins" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "surface_type" "AiSurfaceType" NOT NULL,
    "surface_id" TEXT NOT NULL,
    "source" "AiPinSource" NOT NULL DEFAULT 'USER',
    "pinned_by_user_id" TEXT,
    "pinned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_thread_context_pins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_thread_context_pins_thread_id_surface_type_surface_id_key"
ON "ai_thread_context_pins"("thread_id", "surface_type", "surface_id");

-- CreateIndex
CREATE INDEX "ai_thread_context_pins_thread_id_idx"
ON "ai_thread_context_pins"("thread_id");

-- CreateTable: ai_runs
-- 注意：先建 ai_runs，再建 ai_messages（因为 ai_messages 引用 ai_runs）
CREATE TABLE "ai_runs" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "status" "AiRunStatus" NOT NULL DEFAULT 'RUNNING',
    "model" TEXT NOT NULL,
    "step_count" INTEGER NOT NULL DEFAULT 0,
    "max_steps" INTEGER NOT NULL DEFAULT 10,
    "token_budget" INTEGER NOT NULL DEFAULT 60000,
    "tokens_used" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "last_error" JSONB,
    "pending_approval_id" TEXT,

    CONSTRAINT "ai_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_runs_thread_id_started_at_idx"
ON "ai_runs"("thread_id", "started_at");

-- CreateIndex
CREATE INDEX "ai_runs_status_idx"
ON "ai_runs"("status");

-- CreateTable: ai_messages
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "run_id" TEXT,
    "role" "AiMessageRole" NOT NULL,
    "parts" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_messages_thread_id_created_at_idx"
ON "ai_messages"("thread_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_messages_run_id_idx"
ON "ai_messages"("run_id");

-- CreateTable: ai_run_steps
CREATE TABLE "ai_run_steps" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "step_index" INTEGER NOT NULL,
    "kind" "AiRunStepKind" NOT NULL,
    "model" TEXT,
    "tool_name" TEXT,
    "tool_input" JSONB,
    "tool_output" JSONB,
    "prompt_snapshot" JSONB,
    "response_snapshot" JSONB,
    "tokens_in" INTEGER,
    "tokens_out" INTEGER,
    "latency_ms" INTEGER,
    "error" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_run_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_run_steps_run_id_step_index_idx"
ON "ai_run_steps"("run_id", "step_index");

-- CreateTable: ai_pending_approvals
CREATE TABLE "ai_pending_approvals" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "action_key" TEXT NOT NULL,
    "summary" TEXT,
    "input" JSONB,
    "preview_result" JSONB,
    "status" "AiApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_user_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_pending_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_pending_approvals_status_expires_at_idx"
ON "ai_pending_approvals"("status", "expires_at");

-- CreateIndex
CREATE INDEX "ai_pending_approvals_thread_id_status_idx"
ON "ai_pending_approvals"("thread_id", "status");

-- AddForeignKey: ai_threads -> workspaces / users (跨模块，SQL 层维护，不进 Prisma relation)
ALTER TABLE "ai_threads"
ADD CONSTRAINT "ai_threads_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "ai_threads"
ADD CONSTRAINT "ai_threads_creator_user_id_fkey"
FOREIGN KEY ("creator_user_id") REFERENCES "users"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey: ai_thread_context_pins -> ai_threads
ALTER TABLE "ai_thread_context_pins"
ADD CONSTRAINT "ai_thread_context_pins_thread_id_fkey"
FOREIGN KEY ("thread_id") REFERENCES "ai_threads"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey: ai_runs -> ai_threads
ALTER TABLE "ai_runs"
ADD CONSTRAINT "ai_runs_thread_id_fkey"
FOREIGN KEY ("thread_id") REFERENCES "ai_threads"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey: ai_messages -> ai_threads / ai_runs
ALTER TABLE "ai_messages"
ADD CONSTRAINT "ai_messages_thread_id_fkey"
FOREIGN KEY ("thread_id") REFERENCES "ai_threads"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "ai_messages"
ADD CONSTRAINT "ai_messages_run_id_fkey"
FOREIGN KEY ("run_id") REFERENCES "ai_runs"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey: ai_run_steps -> ai_runs
ALTER TABLE "ai_run_steps"
ADD CONSTRAINT "ai_run_steps_run_id_fkey"
FOREIGN KEY ("run_id") REFERENCES "ai_runs"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey: ai_pending_approvals -> ai_threads / ai_runs
ALTER TABLE "ai_pending_approvals"
ADD CONSTRAINT "ai_pending_approvals_thread_id_fkey"
FOREIGN KEY ("thread_id") REFERENCES "ai_threads"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "ai_pending_approvals"
ADD CONSTRAINT "ai_pending_approvals_run_id_fkey"
FOREIGN KEY ("run_id") REFERENCES "ai_runs"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
