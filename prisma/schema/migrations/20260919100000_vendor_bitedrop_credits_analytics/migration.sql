-- Add vendor-level BiteDrop Credits acceptance setting.
ALTER TABLE "vendors"
  ADD COLUMN "credit_acceptance_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "credit_acceptance_updated_at" TIMESTAMPTZ(6);

-- Track how a customer credit redemption was confirmed by vendor/staff.
CREATE TYPE "RewardRedemptionMethod" AS ENUM ('QR_SCAN', 'MANUAL_CODE', 'SELF_SERVICE');

ALTER TABLE "reward_redemptions"
  ADD COLUMN "redemption_method" "RewardRedemptionMethod";

CREATE INDEX "reward_redemptions_vendor_id_used_at_idx"
  ON "reward_redemptions"("vendor_id", "used_at");

CREATE INDEX "reward_redemptions_food_truck_id_used_at_idx"
  ON "reward_redemptions"("food_truck_id", "used_at");
