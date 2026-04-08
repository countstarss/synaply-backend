-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM (
    'PLANNING',
    'ACTIVE',
    'BLOCKED',
    'SHIPPING',
    'DONE',
    'ARCHIVED'
);

-- CreateEnum
CREATE TYPE "ProjectRiskLevel" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);

-- AlterTable
ALTER TABLE "projects"
ADD COLUMN "brief" TEXT,
ADD COLUMN "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "phase" TEXT,
ADD COLUMN "risk_level" "ProjectRiskLevel" NOT NULL DEFAULT 'LOW',
ADD COLUMN "owner_member_id" TEXT,
ADD COLUMN "last_sync_at" TIMESTAMP(3);

-- Backfill owner and sync metadata for existing projects
UPDATE "projects"
SET "owner_member_id" = COALESCE(
    (
        SELECT tm."id"
        FROM "team_members" tm
        WHERE tm."id" = "projects"."creator_id"
        LIMIT 1
    ),
    (
        SELECT tm."id"
        FROM "workspaces" w
        JOIN "team_members" tm
          ON (
            (w."type" = 'TEAM' AND tm."team_id" = w."team_id")
            OR (w."type" = 'PERSONAL' AND tm."user_id" = w."user_id")
          )
        WHERE w."id" = "projects"."workspace_id"
        ORDER BY
          CASE tm."role"
            WHEN 'OWNER' THEN 0
            WHEN 'ADMIN' THEN 1
            ELSE 2
          END,
          tm."created_at" ASC
        LIMIT 1
    )
)
WHERE "owner_member_id" IS NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "projects"
        WHERE "owner_member_id" IS NULL
    ) THEN
        RAISE EXCEPTION 'Failed to backfill owner_member_id for all existing projects';
    END IF;
END $$;

UPDATE "projects"
SET "last_sync_at" = "updated_at"
WHERE "last_sync_at" IS NULL;

-- AlterTable
ALTER TABLE "projects"
ALTER COLUMN "owner_member_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "projects_owner_member_id_idx" ON "projects"("owner_member_id");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- AddForeignKey
ALTER TABLE "projects"
ADD CONSTRAINT "projects_owner_member_id_fkey"
FOREIGN KEY ("owner_member_id") REFERENCES "team_members"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
