/*
  Warnings:

  - You are about to drop the column `current_step_id` on the `issues` table. All the data in the column will be lost.
  - You are about to drop the `workflow_steps` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "issues" DROP CONSTRAINT "issues_current_step_id_fkey";

-- DropForeignKey
ALTER TABLE "workflow_steps" DROP CONSTRAINT "workflow_steps_assignee_id_fkey";

-- DropForeignKey
ALTER TABLE "workflow_steps" DROP CONSTRAINT "workflow_steps_workflow_id_fkey";

-- AlterTable
ALTER TABLE "issues" DROP COLUMN "current_step_id";

-- DropTable
DROP TABLE "workflow_steps";
