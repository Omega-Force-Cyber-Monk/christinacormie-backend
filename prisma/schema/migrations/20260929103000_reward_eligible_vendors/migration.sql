CREATE TYPE "RewardEligibleVendorScope" AS ENUM ('ALL_APPROVED_VENDORS', 'SELECTED_VENDORS');

ALTER TABLE "reward_rules"
  ADD COLUMN "eligible_vendor_scope" "RewardEligibleVendorScope" NOT NULL DEFAULT 'ALL_APPROVED_VENDORS';

CREATE TABLE "reward_rule_vendors" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "reward_rule_id" UUID NOT NULL,
  "vendor_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reward_rule_vendors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reward_rule_vendors_reward_rule_id_vendor_id_key"
  ON "reward_rule_vendors"("reward_rule_id", "vendor_id");

CREATE INDEX "reward_rule_vendors_vendor_id_idx"
  ON "reward_rule_vendors"("vendor_id");

ALTER TABLE "reward_rule_vendors"
  ADD CONSTRAINT "reward_rule_vendors_reward_rule_id_fkey"
  FOREIGN KEY ("reward_rule_id") REFERENCES "reward_rules"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reward_rule_vendors"
  ADD CONSTRAINT "reward_rule_vendors_vendor_id_fkey"
  FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
