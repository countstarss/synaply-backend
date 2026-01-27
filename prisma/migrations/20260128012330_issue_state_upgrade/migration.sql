-- CreateEnum
CREATE TYPE "IssueStateCategory" AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE', 'CANCELED');

-- AlterTable: Add new columns to workspaces
ALTER TABLE "workspaces" ADD COLUMN "issue_prefix" TEXT;

-- AlterTable: Add new columns to issues (all nullable for backward compatibility)
ALTER TABLE "issues" ADD COLUMN "state_id" TEXT;
ALTER TABLE "issues" ADD COLUMN "project_id" TEXT;
ALTER TABLE "issues" ADD COLUMN "visibility" "VisibilityType" NOT NULL DEFAULT 'TEAM_EDITABLE';
ALTER TABLE "issues" ADD COLUMN "creator_member_id" TEXT;
ALTER TABLE "issues" ADD COLUMN "key" TEXT;
ALTER TABLE "issues" ADD COLUMN "sequence" INTEGER;

-- CreateTable: IssueState
CREATE TABLE "issue_states" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "category" "IssueStateCategory" NOT NULL DEFAULT 'TODO',
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issue_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Label
CREATE TABLE "labels" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable: IssueLabel
CREATE TABLE "issue_labels" (
    "id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "label_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable: IssueAssignee
CREATE TABLE "issue_assignees" (
    "id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: issues
CREATE UNIQUE INDEX "issues_key_key" ON "issues"("key");
CREATE INDEX "issues_workspace_id_idx" ON "issues"("workspace_id");
CREATE INDEX "issues_state_id_idx" ON "issues"("state_id");
CREATE INDEX "issues_project_id_idx" ON "issues"("project_id");
CREATE INDEX "issues_creator_member_id_idx" ON "issues"("creator_member_id");

-- CreateIndex: issue_states
CREATE INDEX "issue_states_workspace_id_idx" ON "issue_states"("workspace_id");
CREATE UNIQUE INDEX "issue_states_workspace_id_name_key" ON "issue_states"("workspace_id", "name");

-- CreateIndex: labels
CREATE INDEX "labels_workspace_id_idx" ON "labels"("workspace_id");
CREATE UNIQUE INDEX "labels_workspace_id_name_key" ON "labels"("workspace_id", "name");

-- CreateIndex: issue_labels
CREATE UNIQUE INDEX "issue_labels_issue_id_label_id_key" ON "issue_labels"("issue_id", "label_id");

-- CreateIndex: issue_assignees
CREATE UNIQUE INDEX "issue_assignees_issue_id_member_id_key" ON "issue_assignees"("issue_id", "member_id");

-- AddForeignKey: issues
ALTER TABLE "issues" ADD CONSTRAINT "issues_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "issue_states"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "issues" ADD CONSTRAINT "issues_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "issues" ADD CONSTRAINT "issues_creator_member_id_fkey" FOREIGN KEY ("creator_member_id") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: issue_states
ALTER TABLE "issue_states" ADD CONSTRAINT "issue_states_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: labels
ALTER TABLE "labels" ADD CONSTRAINT "labels_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: issue_labels
ALTER TABLE "issue_labels" ADD CONSTRAINT "issue_labels_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "issue_labels" ADD CONSTRAINT "issue_labels_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: issue_assignees
ALTER TABLE "issue_assignees" ADD CONSTRAINT "issue_assignees_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "issue_assignees" ADD CONSTRAINT "issue_assignees_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
