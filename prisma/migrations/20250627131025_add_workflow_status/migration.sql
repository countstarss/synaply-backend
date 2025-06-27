-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "workflows" ADD COLUMN     "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT';
