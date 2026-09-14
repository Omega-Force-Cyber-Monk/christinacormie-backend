-- Current Prisma Post model expects share_count, but older production databases
-- were created before that column existed.

ALTER TABLE "posts"
  ADD COLUMN IF NOT EXISTS "share_count" INTEGER NOT NULL DEFAULT 0;
