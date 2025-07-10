-- CreateEnum
CREATE TYPE "IssueType" AS ENUM ('NORMAL', 'WORKFLOW');

-- AlterTable
ALTER TABLE "issues" ADD COLUMN     "issueType" "IssueType" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "priority" "IssuePriority" NOT NULL DEFAULT 'NORMAL';
