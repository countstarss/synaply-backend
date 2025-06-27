-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE');

-- CreateEnum
CREATE TYPE "IssuePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- AlterTable
ALTER TABLE "issues" ADD COLUMN     "due_date" TIMESTAMP(3),
ADD COLUMN     "parent_task_id" TEXT,
ADD COLUMN     "priority" "IssuePriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "start_date" TIMESTAMP(3),
ADD COLUMN     "status" "IssueStatus" NOT NULL DEFAULT 'TODO';

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_dependencies" (
    "id" TEXT NOT NULL,
    "blocker_issue_id" TEXT NOT NULL,
    "depends_on_issue_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "issue_dependencies_blocker_issue_id_depends_on_issue_id_key" ON "issue_dependencies"("blocker_issue_id", "depends_on_issue_id");

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "team_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_dependencies" ADD CONSTRAINT "issue_dependencies_blocker_issue_id_fkey" FOREIGN KEY ("blocker_issue_id") REFERENCES "issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_dependencies" ADD CONSTRAINT "issue_dependencies_depends_on_issue_id_fkey" FOREIGN KEY ("depends_on_issue_id") REFERENCES "issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
