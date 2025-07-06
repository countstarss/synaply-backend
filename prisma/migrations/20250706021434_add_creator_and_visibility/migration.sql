/*
  Warnings:

  - Added the required column `creator_id` to the `projects` table without a default value. This is not possible if the table is not empty.
  - Added the required column `creator_id` to the `workflows` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "VisibilityType" AS ENUM ('PRIVATE', 'TEAM_READONLY', 'TEAM_EDITABLE', 'PUBLIC');

-- AlterTable
ALTER TABLE "issues" ADD COLUMN     "visibility" "VisibilityType" NOT NULL DEFAULT 'PRIVATE';

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "creator_id" TEXT NOT NULL,
ADD COLUMN     "visibility" "VisibilityType" NOT NULL DEFAULT 'PRIVATE';

-- AlterTable
ALTER TABLE "workflows" ADD COLUMN     "creator_id" TEXT NOT NULL,
ADD COLUMN     "visibility" "VisibilityType" NOT NULL DEFAULT 'PRIVATE';

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "team_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "team_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
