-- CreateEnum
CREATE TYPE "DocType" AS ENUM (
    'DOCUMENT',
    'FOLDER'
);

-- CreateEnum
CREATE TYPE "DocStatus" AS ENUM (
    'ACTIVE',
    'ARCHIVED'
);

-- CreateEnum
CREATE TYPE "DocChangeSource" AS ENUM (
    'CREATE',
    'EDITOR',
    'META',
    'SYSTEM',
    'IMPORT'
);

-- CreateTable
CREATE TABLE "docs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "creator_member_id" TEXT NOT NULL,
    "owner_member_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "DocType" NOT NULL,
    "status" "DocStatus" NOT NULL DEFAULT 'ACTIVE',
    "visibility" "VisibilityType" NOT NULL DEFAULT 'PRIVATE',
    "parent_id" TEXT,
    "project_id" TEXT,
    "issue_id" TEXT,
    "workflow_id" TEXT,
    "icon" TEXT,
    "cover_image" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "latest_revision_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_edited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "docs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doc_revisions" (
    "id" TEXT NOT NULL,
    "doc_id" TEXT NOT NULL,
    "base_revision_id" TEXT,
    "author_member_id" TEXT NOT NULL,
    "client_mutation_id" TEXT NOT NULL,
    "content_snapshot" JSONB NOT NULL,
    "metadata_snapshot" JSONB,
    "change_source" "DocChangeSource" NOT NULL DEFAULT 'EDITOR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doc_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "docs_latest_revision_id_key" ON "docs"("latest_revision_id");

-- CreateIndex
CREATE INDEX "docs_workspace_id_idx" ON "docs"("workspace_id");

-- CreateIndex
CREATE INDEX "docs_workspace_id_is_archived_idx" ON "docs"("workspace_id", "is_archived");

-- CreateIndex
CREATE INDEX "docs_workspace_id_parent_id_idx" ON "docs"("workspace_id", "parent_id");

-- CreateIndex
CREATE INDEX "docs_project_id_idx" ON "docs"("project_id");

-- CreateIndex
CREATE INDEX "docs_issue_id_idx" ON "docs"("issue_id");

-- CreateIndex
CREATE INDEX "docs_workflow_id_idx" ON "docs"("workflow_id");

-- CreateIndex
CREATE INDEX "docs_creator_member_id_idx" ON "docs"("creator_member_id");

-- CreateIndex
CREATE INDEX "docs_owner_member_id_idx" ON "docs"("owner_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "doc_revisions_doc_id_client_mutation_id_key" ON "doc_revisions"("doc_id", "client_mutation_id");

-- CreateIndex
CREATE INDEX "doc_revisions_doc_id_created_at_idx" ON "doc_revisions"("doc_id", "created_at");

-- CreateIndex
CREATE INDEX "doc_revisions_author_member_id_idx" ON "doc_revisions"("author_member_id");

-- AddForeignKey
ALTER TABLE "docs"
ADD CONSTRAINT "docs_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docs"
ADD CONSTRAINT "docs_creator_member_id_fkey"
FOREIGN KEY ("creator_member_id") REFERENCES "team_members"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docs"
ADD CONSTRAINT "docs_owner_member_id_fkey"
FOREIGN KEY ("owner_member_id") REFERENCES "team_members"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docs"
ADD CONSTRAINT "docs_parent_id_fkey"
FOREIGN KEY ("parent_id") REFERENCES "docs"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docs"
ADD CONSTRAINT "docs_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docs"
ADD CONSTRAINT "docs_issue_id_fkey"
FOREIGN KEY ("issue_id") REFERENCES "issues"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docs"
ADD CONSTRAINT "docs_workflow_id_fkey"
FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doc_revisions"
ADD CONSTRAINT "doc_revisions_doc_id_fkey"
FOREIGN KEY ("doc_id") REFERENCES "docs"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doc_revisions"
ADD CONSTRAINT "doc_revisions_base_revision_id_fkey"
FOREIGN KEY ("base_revision_id") REFERENCES "doc_revisions"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doc_revisions"
ADD CONSTRAINT "doc_revisions_author_member_id_fkey"
FOREIGN KEY ("author_member_id") REFERENCES "team_members"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docs"
ADD CONSTRAINT "docs_latest_revision_id_fkey"
FOREIGN KEY ("latest_revision_id") REFERENCES "doc_revisions"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
