-- AlterTable
ALTER TABLE "issues" ADD COLUMN     "progressLog" JSONB,
ADD COLUMN     "workflowSnapshot" JSONB;

-- AlterTable
ALTER TABLE "workflows" ADD COLUMN     "assigneeMap" JSONB,
ADD COLUMN     "json" JSONB,
ADD COLUMN     "totalSteps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "version" TEXT NOT NULL DEFAULT 'v1';

-- CreateTable
CREATE TABLE "issue_progress_logs" (
    "id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "stepName" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "assignee_id" TEXT,
    "actor_id" TEXT NOT NULL,
    "comment" TEXT,
    "attachments" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_progress_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "issue_progress_logs" ADD CONSTRAINT "issue_progress_logs_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_progress_logs" ADD CONSTRAINT "issue_progress_logs_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_progress_logs" ADD CONSTRAINT "issue_progress_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "team_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
