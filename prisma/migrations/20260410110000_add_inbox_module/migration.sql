-- CreateTable
CREATE TABLE "inbox_items" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "target_user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "project_id" TEXT,
    "project_name" TEXT,
    "issue_id" TEXT,
    "issue_key" TEXT,
    "workflow_run_id" TEXT,
    "doc_id" TEXT,
    "actor_user_id" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "requires_action" BOOLEAN NOT NULL DEFAULT false,
    "action_label" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unread',
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "read_at" TIMESTAMP(3),
    "done_at" TIMESTAMP(3),
    "dismissed_at" TIMESTAMP(3),
    "snoozed_until" TIMESTAMP(3),
    "dedupe_key" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbox_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inbox_items_workspace_id_target_user_id_dedupe_key_key"
ON "inbox_items"("workspace_id", "target_user_id", "dedupe_key");

-- CreateIndex
CREATE INDEX "inbox_items_workspace_id_target_user_id_status_idx"
ON "inbox_items"("workspace_id", "target_user_id", "status");

-- CreateIndex
CREATE INDEX "inbox_items_workspace_id_target_user_id_bucket_idx"
ON "inbox_items"("workspace_id", "target_user_id", "bucket");

-- CreateIndex
CREATE INDEX "inbox_items_workspace_id_target_user_id_occurred_at_idx"
ON "inbox_items"("workspace_id", "target_user_id", "occurred_at");
