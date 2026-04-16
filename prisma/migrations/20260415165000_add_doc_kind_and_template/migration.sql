-- CreateEnum
CREATE TYPE "DocKind" AS ENUM (
    'GENERAL',
    'PROJECT_BRIEF',
    'DECISION_LOG',
    'REVIEW_PACKET',
    'HANDOFF_PACKET',
    'RELEASE_CHECKLIST'
);

-- AlterTable
ALTER TABLE "docs"
ADD COLUMN "kind" "DocKind" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN "template_key" TEXT;

-- CreateIndex
CREATE INDEX "docs_workspace_id_kind_idx" ON "docs"("workspace_id", "kind");
