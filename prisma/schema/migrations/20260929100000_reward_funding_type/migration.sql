CREATE TYPE "RewardFundingType" AS ENUM ('VENDOR_FUNDED', 'BITEDROP_FUNDED');

ALTER TABLE "reward_rules"
  ADD COLUMN "funding_type" "RewardFundingType" NOT NULL DEFAULT 'VENDOR_FUNDED';

ALTER TABLE "reward_redemptions"
  ADD COLUMN "funding_type" "RewardFundingType" NOT NULL DEFAULT 'VENDOR_FUNDED';

UPDATE "reward_redemptions" rr
SET "funding_type" = COALESCE(rule."funding_type", 'VENDOR_FUNDED'::"RewardFundingType")
FROM "reward_rules" rule
WHERE rr."reward_rule_id" = rule."id";
