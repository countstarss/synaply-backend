/*
  Warnings:

  - You are about to drop the column `progressLog` on the `issues` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "issue_progress_logs" ADD COLUMN     "isRejected" BOOLEAN;

-- AlterTable
ALTER TABLE "issues" DROP COLUMN "progressLog",
ADD COLUMN     "current_assignee_id" TEXT,
ADD COLUMN     "workflowCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "workflowCurrentStepIndex" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "workflows" ADD COLUMN     "currentStepIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currentStepStatus" "IssueStatus" NOT NULL DEFAULT 'TODO',
ADD COLUMN     "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false;
