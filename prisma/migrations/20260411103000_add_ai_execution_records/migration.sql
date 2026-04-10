-- CreateEnum
CREATE TYPE "AiExecutionStatus" AS ENUM (
    'PREVIEW',
    'SUCCEEDED',
    'FAILED',
    'BLOCKED'
);

-- CreateEnum
CREATE TYPE "AiApprovalMode" AS ENUM (
    'AUTO',
    'CONFIRM'
);

-- CreateEnum
CREATE TYPE "AiExecutionTargetType" AS ENUM (
    'WORKSPACE',
    'PROJECT',
    'ISSUE',
    'WORKFLOW',
    'DOC'
);

-- CreateTable
CREATE TABLE "ai_execution_records" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "action_key" TEXT NOT NULL,
    "status" "AiExecutionStatus" NOT NULL,
    "approval_mode" "AiApprovalMode" NOT NULL,
    "target_type" "AiExecutionTargetType",
    "target_id" TEXT,
    "summary" TEXT,
    "conversation_id" TEXT,
    "input" JSONB,
    "result" JSONB,
    "error" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "ai_execution_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_execution_records_workspace_id_created_at_idx"
ON "ai_execution_records"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_execution_records_workspace_id_action_key_idx"
ON "ai_execution_records"("workspace_id", "action_key");

-- CreateIndex
CREATE INDEX "ai_execution_records_actor_user_id_created_at_idx"
ON "ai_execution_records"("actor_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "ai_execution_records"
ADD CONSTRAINT "ai_execution_records_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_execution_records"
ADD CONSTRAINT "ai_execution_records_actor_user_id_fkey"
FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
