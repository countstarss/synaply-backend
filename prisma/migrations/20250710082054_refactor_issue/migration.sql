-- AlterEnum
ALTER TYPE "IssueStatus" ADD VALUE 'AMOST_DONE';

-- AlterTable
ALTER TABLE "issues" ADD COLUMN     "currentStepIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currentStepStatus" "IssueStatus" NOT NULL DEFAULT 'TODO',
ADD COLUMN     "current_step_id" TEXT,
ADD COLUMN     "teamMemberId" TEXT,
ADD COLUMN     "totalSteps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "workflowSnapshot" JSONB,
ADD COLUMN     "workflow_id" TEXT;

-- CreateTable
CREATE TABLE "IssueStepRecord" (
    "id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "stepName" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "resultText" TEXT,
    "attachments" JSONB,
    "assignee_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueStepRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_activities" (
    "id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "issue_activities_issue_id_idx" ON "issue_activities"("issue_id");

-- CreateIndex
CREATE INDEX "issue_activities_actor_id_idx" ON "issue_activities"("actor_id");

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueStepRecord" ADD CONSTRAINT "IssueStepRecord_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueStepRecord" ADD CONSTRAINT "IssueStepRecord_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "team_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_activities" ADD CONSTRAINT "issue_activities_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_activities" ADD CONSTRAINT "issue_activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "team_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
