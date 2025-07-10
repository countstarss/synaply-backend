/*
  Warnings:

  - You are about to drop the column `current_assignee_id` on the `issues` table. All the data in the column will be lost.
  - You are about to drop the column `current_step_id` on the `issues` table. All the data in the column will be lost.
  - You are about to drop the column `parent_task_id` on the `issues` table. All the data in the column will be lost.
  - You are about to drop the column `priority` on the `issues` table. All the data in the column will be lost.
  - You are about to drop the column `project_id` on the `issues` table. All the data in the column will be lost.
  - You are about to drop the column `start_date` on the `issues` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `issues` table. All the data in the column will be lost.
  - You are about to drop the column `visibility` on the `issues` table. All the data in the column will be lost.
  - You are about to drop the column `workflowCompleted` on the `issues` table. All the data in the column will be lost.
  - You are about to drop the column `workflowCurrentStepIndex` on the `issues` table. All the data in the column will be lost.
  - You are about to drop the column `workflowSnapshot` on the `issues` table. All the data in the column will be lost.
  - You are about to drop the column `workflow_id` on the `issues` table. All the data in the column will be lost.
  - You are about to drop the `issue_activities` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `issue_dependencies` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `issue_progress_logs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "issue_activities" DROP CONSTRAINT "issue_activities_actor_id_fkey";

-- DropForeignKey
ALTER TABLE "issue_activities" DROP CONSTRAINT "issue_activities_issue_id_fkey";

-- DropForeignKey
ALTER TABLE "issue_dependencies" DROP CONSTRAINT "issue_dependencies_blocker_issue_id_fkey";

-- DropForeignKey
ALTER TABLE "issue_dependencies" DROP CONSTRAINT "issue_dependencies_depends_on_issue_id_fkey";

-- DropForeignKey
ALTER TABLE "issue_progress_logs" DROP CONSTRAINT "issue_progress_logs_actor_id_fkey";

-- DropForeignKey
ALTER TABLE "issue_progress_logs" DROP CONSTRAINT "issue_progress_logs_assignee_id_fkey";

-- DropForeignKey
ALTER TABLE "issue_progress_logs" DROP CONSTRAINT "issue_progress_logs_issue_id_fkey";

-- DropForeignKey
ALTER TABLE "issues" DROP CONSTRAINT "issues_creator_id_fkey";

-- DropForeignKey
ALTER TABLE "issues" DROP CONSTRAINT "issues_direct_assignee_id_fkey";

-- DropForeignKey
ALTER TABLE "issues" DROP CONSTRAINT "issues_parent_task_id_fkey";

-- DropForeignKey
ALTER TABLE "issues" DROP CONSTRAINT "issues_project_id_fkey";

-- DropForeignKey
ALTER TABLE "issues" DROP CONSTRAINT "issues_workflow_id_fkey";

-- DropForeignKey
ALTER TABLE "projects" DROP CONSTRAINT "projects_creator_id_fkey";

-- AlterTable
ALTER TABLE "issues" DROP COLUMN "current_assignee_id",
DROP COLUMN "current_step_id",
DROP COLUMN "parent_task_id",
DROP COLUMN "priority",
DROP COLUMN "project_id",
DROP COLUMN "start_date",
DROP COLUMN "status",
DROP COLUMN "visibility",
DROP COLUMN "workflowCompleted",
DROP COLUMN "workflowCurrentStepIndex",
DROP COLUMN "workflowSnapshot",
DROP COLUMN "workflow_id";

-- DropTable
DROP TABLE "issue_activities";

-- DropTable
DROP TABLE "issue_dependencies";

-- DropTable
DROP TABLE "issue_progress_logs";

-- DropEnum
DROP TYPE "ChatType";

-- DropEnum
DROP TYPE "MessageType";
