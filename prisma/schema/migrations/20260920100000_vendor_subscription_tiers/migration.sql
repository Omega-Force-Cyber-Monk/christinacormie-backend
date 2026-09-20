ALTER TABLE "vendors"
  ADD COLUMN IF NOT EXISTS "active_subscription_tier_id" UUID;

CREATE TABLE IF NOT EXISTS "vendor_subscription_tiers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(50) NOT NULL,
  "legacy_plan" "VendorPlan",
  "name" VARCHAR(100) NOT NULL,
  "subtitle" VARCHAR(150),
  "description" TEXT,
  "badge" VARCHAR(100),
  "monthly_price_cents" INTEGER NOT NULL,
  "founding_monthly_price_cents_after_trial" INTEGER,
  "normal_commission_rate" DECIMAL(6,3),
  "founding_commission_rate" DECIMAL(6,3),
  "booking_enabled" BOOLEAN NOT NULL DEFAULT false,
  "max_staff_accounts" INTEGER NOT NULL DEFAULT 0,
  "max_included_trucks" INTEGER NOT NULL DEFAULT 1,
  "additional_truck_monthly_price_cents" INTEGER,
  "analytics_level" VARCHAR(30) NOT NULL DEFAULT 'NONE',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "trial_days" INTEGER NOT NULL DEFAULT 90,
  "features" JSONB,
  "included" JSONB,
  "not_included" JSONB,
  "stripe_product_id" VARCHAR(255),
  "stripe_price_id" VARCHAR(255),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "vendor_subscription_tiers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vendor_subscriptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "vendor_id" UUID NOT NULL,
  "tier_id" UUID NOT NULL,
  "stripe_customer_id" VARCHAR(255),
  "stripe_subscription_id" VARCHAR(255),
  "status" "VendorSubscriptionStatus" NOT NULL DEFAULT 'INCOMPLETE',
  "monthly_price_cents" INTEGER NOT NULL,
  "commission_rate" DECIMAL(6,3),
  "is_founding_member" BOOLEAN NOT NULL DEFAULT false,
  "trial_started_at" TIMESTAMPTZ(6),
  "trial_ends_at" TIMESTAMPTZ(6),
  "current_period_start" TIMESTAMPTZ(6),
  "current_period_end" TIMESTAMPTZ(6),
  "canceled_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vendor_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "vendor_subscription_tiers_code_key" ON "vendor_subscription_tiers"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "vendor_subscription_tiers_stripe_product_id_key" ON "vendor_subscription_tiers"("stripe_product_id");
CREATE UNIQUE INDEX IF NOT EXISTS "vendor_subscription_tiers_stripe_price_id_key" ON "vendor_subscription_tiers"("stripe_price_id");
CREATE UNIQUE INDEX IF NOT EXISTS "vendor_subscriptions_stripe_subscription_id_key" ON "vendor_subscriptions"("stripe_subscription_id");
CREATE INDEX IF NOT EXISTS "vendor_subscriptions_vendor_id_status_idx" ON "vendor_subscriptions"("vendor_id", "status");

ALTER TABLE "vendors"
  ADD CONSTRAINT "vendors_active_subscription_tier_id_fkey"
  FOREIGN KEY ("active_subscription_tier_id") REFERENCES "vendor_subscription_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "vendor_subscriptions"
  ADD CONSTRAINT "vendor_subscriptions_vendor_id_fkey"
  FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vendor_subscriptions"
  ADD CONSTRAINT "vendor_subscriptions_tier_id_fkey"
  FOREIGN KEY ("tier_id") REFERENCES "vendor_subscription_tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "vendor_subscription_tiers" (
  "code",
  "legacy_plan",
  "name",
  "subtitle",
  "badge",
  "monthly_price_cents",
  "founding_monthly_price_cents_after_trial",
  "normal_commission_rate",
  "founding_commission_rate",
  "booking_enabled",
  "max_staff_accounts",
  "max_included_trucks",
  "additional_truck_monthly_price_cents",
  "analytics_level",
  "sort_order",
  "trial_days",
  "features",
  "included",
  "not_included",
  "active"
) VALUES
(
  'FREE',
  'FREE',
  'Free',
  'Basic Discovery',
  NULL,
  0,
  0,
  NULL,
  NULL,
  false,
  0,
  1,
  NULL,
  'NONE',
  0,
  0,
  '{"liveDrops":false,"rewards":false,"analytics":"NONE","eventBookings":false,"communityBookingRequests":false,"staffAccounts":0,"multipleTrucks":false}',
  '["Listed on discovery map","Full profile with photos","Full menu with photos","Customer reviews and ratings","Community tab access","Followers — users can follow the food truck","Follower count visible"]',
  '["Live drops","QR check-in and rewards","Push notifications to followers","Message followers","Analytics","Event bookings","Staff accounts"]',
  true
),
(
  'STARTER',
  'STARTER',
  'Starter',
  'Drops & Bookings',
  NULL,
  1000,
  500,
  0.150,
  0.120,
  true,
  1,
  1,
  NULL,
  'BASIC',
  10,
  90,
  '{"liveDrops":true,"rewards":true,"analytics":"BASIC","eventBookings":true,"communityBookingRequests":false,"staffAccounts":1,"multipleTrucks":false}',
  '["Everything in Free","Live drops with real-time map","Drop promotions and deals","QR check-in and credit redemption","Push notifications to followers","Message followers broadcast","Event booking requests","Send quotes and accept bookings","Basic analytics","1 staff account"]',
  '["Featured on discovery","Search boost","Full earnings analytics","Community booking requests"]',
  true
),
(
  'PRO',
  'PRO',
  'Pro',
  'Full Platform',
  'MOST POPULAR',
  1900,
  950,
  0.120,
  0.100,
  true,
  2,
  1,
  NULL,
  'FULL',
  20,
  90,
  '{"liveDrops":true,"rewards":true,"analytics":"FULL","eventBookings":true,"communityBookingRequests":true,"staffAccounts":2,"multipleTrucks":false}',
  '["Everything in Starter","Community booking requests","Featured on discovery section","Search relevance boost","Full earnings and analytics","2 staff accounts"]',
  '["Multiple truck listings","Advanced analytics","Priority support","Featured badge on profile"]',
  true
),
(
  'ELITE',
  'ELITE',
  'Elite',
  'Maximum Growth',
  NULL,
  4900,
  2450,
  0.080,
  0.060,
  true,
  5,
  3,
  1500,
  'ADVANCED',
  30,
  90,
  '{"liveDrops":true,"rewards":true,"analytics":"ADVANCED","eventBookings":true,"communityBookingRequests":true,"staffAccounts":5,"multipleTrucks":true,"prioritySupport":true,"featuredBadge":true}',
  '["Everything in Pro","Up to 3 truck listings included","Additional trucks: $15/month each","Up to 5 staff accounts","Advanced analytics and reports","Featured badge on profile","Priority customer support","Early access to new features","Eligible for Bite Drop social media feature","Each truck requires own verification"]',
  '[]',
  true
)
ON CONFLICT ("code") DO NOTHING;

UPDATE "vendors" v
SET "active_subscription_tier_id" = t."id"
FROM "vendor_subscription_tiers" t
WHERE t."legacy_plan" = v."selected_plan"
  AND v."active_subscription_tier_id" IS NULL;
