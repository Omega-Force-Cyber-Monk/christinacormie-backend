-- Bring production databases in line with the current Prisma schema for feeds and loyalty credits.
-- These statements are intentionally idempotent because some environments may already have the columns.

ALTER TABLE "posts"
  ADD COLUMN IF NOT EXISTS "view_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "reward_redemptions"
  ALTER COLUMN "reward_rule_id" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "vendor_id" UUID,
  ADD COLUMN IF NOT EXISTS "food_truck_id" UUID,
  ADD COLUMN IF NOT EXISTS "backup_code" VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "redemption_token" VARCHAR(255);

CREATE INDEX IF NOT EXISTS "reward_redemptions_backup_code_idx"
  ON "reward_redemptions"("backup_code");

CREATE UNIQUE INDEX IF NOT EXISTS "reward_redemptions_redemption_token_key"
  ON "reward_redemptions"("redemption_token");
