CREATE TYPE "VendorSubscriptionStatus" AS ENUM (
  'INACTIVE',
  'INCOMPLETE',
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'UNPAID'
);

ALTER TABLE "vendors"
  ADD COLUMN "subscription_status" "VendorSubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
  ADD COLUMN "stripe_customer_id" VARCHAR(255),
  ADD COLUMN "stripe_subscription_id" VARCHAR(255),
  ADD COLUMN "subscription_current_period_end" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX "vendors_stripe_customer_id_key" ON "vendors"("stripe_customer_id");
CREATE UNIQUE INDEX "vendors_stripe_subscription_id_key" ON "vendors"("stripe_subscription_id");

UPDATE "vendors"
SET "subscription_status" = 'ACTIVE'
WHERE "selected_plan" = 'FREE';
