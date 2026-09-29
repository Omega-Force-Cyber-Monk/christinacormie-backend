ALTER TABLE "reward_rules"
  ADD COLUMN "minimum_purchase_amount" DECIMAL(12, 2);

ALTER TABLE "reward_redemptions"
  ADD COLUMN "minimum_purchase_amount" DECIMAL(12, 2);

UPDATE "reward_redemptions" rr
SET "minimum_purchase_amount" = rule."minimum_purchase_amount"
FROM "reward_rules" rule
WHERE rr."reward_rule_id" = rule."id";
