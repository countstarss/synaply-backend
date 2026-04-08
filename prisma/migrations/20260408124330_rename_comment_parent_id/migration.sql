DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'comments'
      AND column_name = 'parentId'
  ) THEN
    ALTER TABLE "comments"
    RENAME COLUMN "parentId" TO "parent_id";
  END IF;
END $$;
