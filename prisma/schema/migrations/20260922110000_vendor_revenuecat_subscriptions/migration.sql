CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VendorSubscriptionProvider') THEN
    CREATE TYPE "VendorSubscriptionProvider" AS ENUM ('REVENUECAT');
  END IF;
END $$;

ALTER TYPE "VendorSubscriptionProvider" ADD VALUE IF NOT EXISTS 'REVENUECAT';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VendorSubscriptionPlatform') THEN
    CREATE TYPE "VendorSubscriptionPlatform" AS ENUM ('WEB', 'IOS', 'ANDROID', 'UNKNOWN');
  END IF;
END $$;

ALTER TYPE "VendorSubscriptionPlatform" ADD VALUE IF NOT EXISTS 'WEB';
ALTER TYPE "VendorSubscriptionPlatform" ADD VALUE IF NOT EXISTS 'IOS';
ALTER TYPE "VendorSubscriptionPlatform" ADD VALUE IF NOT EXISTS 'ANDROID';
ALTER TYPE "VendorSubscriptionPlatform" ADD VALUE IF NOT EXISTS 'UNKNOWN';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VendorSubscriptionStatus') THEN
    CREATE TYPE "VendorSubscriptionStatus" AS ENUM (
      'TRIALING',
      'ACTIVE',
      'PAST_DUE',
      'CANCELED',
      'EXPIRED',
      'REFUNDED',
      'GRACE_PERIOD',
      'DISABLED'
    );
  END IF;
END $$;

ALTER TYPE "VendorSubscriptionStatus" ADD VALUE IF NOT EXISTS 'TRIALING';
ALTER TYPE "VendorSubscriptionStatus" ADD VALUE IF NOT EXISTS 'ACTIVE';
ALTER TYPE "VendorSubscriptionStatus" ADD VALUE IF NOT EXISTS 'PAST_DUE';
ALTER TYPE "VendorSubscriptionStatus" ADD VALUE IF NOT EXISTS 'CANCELED';
ALTER TYPE "VendorSubscriptionStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "VendorSubscriptionStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';
ALTER TYPE "VendorSubscriptionStatus" ADD VALUE IF NOT EXISTS 'GRACE_PERIOD';
ALTER TYPE "VendorSubscriptionStatus" ADD VALUE IF NOT EXISTS 'DISABLED';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionWebhookProcessingStatus') THEN
    CREATE TYPE "SubscriptionWebhookProcessingStatus" AS ENUM (
      'RECEIVED',
      'PROCESSING',
      'PROCESSED',
      'FAILED'
    );
  END IF;
END $$;

ALTER TYPE "SubscriptionWebhookProcessingStatus" ADD VALUE IF NOT EXISTS 'RECEIVED';
ALTER TYPE "SubscriptionWebhookProcessingStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "SubscriptionWebhookProcessingStatus" ADD VALUE IF NOT EXISTS 'PROCESSED';
ALTER TYPE "SubscriptionWebhookProcessingStatus" ADD VALUE IF NOT EXISTS 'FAILED';

CREATE TABLE IF NOT EXISTS "vendor_subscription_plans" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" "VendorPlan" NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "monthly_price" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "standard_commission_rate" DECIMAL(6, 3) NOT NULL,
  "founding_commission_rate" DECIMAL(6, 3) NOT NULL,
  "trial_days" INTEGER NOT NULL DEFAULT 90,
  "features" JSONB NOT NULL DEFAULT '[]',
  "limits" JSONB NOT NULL DEFAULT '{}',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "vendor_subscription_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vendor_subscription_provider_products" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "plan_id" UUID NOT NULL,
  "provider" "VendorSubscriptionProvider" NOT NULL DEFAULT 'REVENUECAT',
  "platform" "VendorSubscriptionPlatform" NOT NULL DEFAULT 'UNKNOWN',
  "product_id" VARCHAR(255),
  "entitlement_id" VARCHAR(255),
  "revenuecat_offering_id" VARCHAR(255),
  "revenuecat_package_id" VARCHAR(255),
  "stripe_product_id" VARCHAR(255),
  "stripe_price_id" VARCHAR(255),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vendor_subscription_provider_products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vendor_founding_offer_config" (
  "id" VARCHAR(32) NOT NULL DEFAULT 'default',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "starts_at" TIMESTAMPTZ(6) NOT NULL,
  "ends_at" TIMESTAMPTZ(6) NOT NULL,
  "discount_percent" DECIMAL(5, 2) NOT NULL DEFAULT 50,
  "discount_start_month" INTEGER NOT NULL DEFAULT 4,
  "discount_end_month" INTEGER NOT NULL DEFAULT 12,
  "trial_days" INTEGER NOT NULL DEFAULT 90,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vendor_founding_offer_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vendor_subscriptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "vendor_id" UUID NOT NULL,
  "plan_id" UUID NOT NULL,
  "provider" "VendorSubscriptionProvider" NOT NULL DEFAULT 'REVENUECAT',
  "platform" "VendorSubscriptionPlatform" NOT NULL DEFAULT 'UNKNOWN',
  "status" "VendorSubscriptionStatus" NOT NULL,
  "is_founding_vendor" BOOLEAN NOT NULL DEFAULT false,
  "founding_locked_commission_rate" DECIMAL(6, 3),
  "started_at" TIMESTAMPTZ(6),
  "trial_ends_at" TIMESTAMPTZ(6),
  "current_period_starts_at" TIMESTAMPTZ(6),
  "current_period_ends_at" TIMESTAMPTZ(6),
  "will_renew" BOOLEAN,
  "revenuecat_app_user_id" VARCHAR(255),
  "external_customer_id" VARCHAR(255),
  "external_subscription_id" VARCHAR(255),
  "product_id" VARCHAR(255),
  "entitlement_id" VARCHAR(255),
  "latest_transaction_id" VARCHAR(255),
  "original_transaction_id" VARCHAR(255),
  "raw_provider_status" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vendor_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "subscription_webhook_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider" "VendorSubscriptionProvider" NOT NULL DEFAULT 'REVENUECAT',
  "event_id" VARCHAR(255) NOT NULL,
  "vendor_id" UUID,
  "event_type" VARCHAR(100) NOT NULL,
  "status" "SubscriptionWebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
  "payload" JSONB NOT NULL,
  "error" TEXT,
  "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMPTZ(6),
  CONSTRAINT "subscription_webhook_events_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "vendor_subscription_plans"
  ADD COLUMN IF NOT EXISTS "code" "VendorPlan" NOT NULL DEFAULT 'FREE',
  ADD COLUMN IF NOT EXISTS "name" VARCHAR(100) NOT NULL DEFAULT 'Free',
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "monthly_price" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "standard_commission_rate" DECIMAL(6, 3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "founding_commission_rate" DECIMAL(6, 3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "trial_days" INTEGER NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS "features" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "limits" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);

ALTER TABLE "vendor_subscription_provider_products"
  ADD COLUMN IF NOT EXISTS "plan_id" UUID,
  ADD COLUMN IF NOT EXISTS "provider" "VendorSubscriptionProvider" NOT NULL DEFAULT 'REVENUECAT',
  ADD COLUMN IF NOT EXISTS "platform" "VendorSubscriptionPlatform" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS "product_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "entitlement_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "revenuecat_offering_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "revenuecat_package_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "stripe_product_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "stripe_price_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "vendor_founding_offer_config"
  ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "starts_at" TIMESTAMPTZ(6) NOT NULL DEFAULT '2026-08-05T00:00:00Z',
  ADD COLUMN IF NOT EXISTS "ends_at" TIMESTAMPTZ(6) NOT NULL DEFAULT '2026-10-04T23:59:59Z',
  ADD COLUMN IF NOT EXISTS "discount_percent" DECIMAL(5, 2) NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS "discount_start_month" INTEGER NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS "discount_end_month" INTEGER NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS "trial_days" INTEGER NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "vendor_subscriptions"
  ADD COLUMN IF NOT EXISTS "vendor_id" UUID,
  ADD COLUMN IF NOT EXISTS "plan_id" UUID,
  ADD COLUMN IF NOT EXISTS "provider" "VendorSubscriptionProvider" NOT NULL DEFAULT 'REVENUECAT',
  ADD COLUMN IF NOT EXISTS "platform" "VendorSubscriptionPlatform" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS "status" "VendorSubscriptionStatus",
  ADD COLUMN IF NOT EXISTS "is_founding_vendor" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "founding_locked_commission_rate" DECIMAL(6, 3),
  ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "trial_ends_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "current_period_starts_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "current_period_ends_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "will_renew" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "revenuecat_app_user_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "external_customer_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "external_subscription_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "product_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "entitlement_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "latest_transaction_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "original_transaction_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "raw_provider_status" JSONB,
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "subscription_webhook_events"
  ADD COLUMN IF NOT EXISTS "provider" "VendorSubscriptionProvider" NOT NULL DEFAULT 'REVENUECAT',
  ADD COLUMN IF NOT EXISTS "event_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "vendor_id" UUID,
  ADD COLUMN IF NOT EXISTS "event_type" VARCHAR(100) NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS "status" "SubscriptionWebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
  ADD COLUMN IF NOT EXISTS "payload" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "error" TEXT,
  ADD COLUMN IF NOT EXISTS "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "processed_at" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX IF NOT EXISTS "vendor_subscription_plans_code_key" ON "vendor_subscription_plans"("code");
CREATE INDEX IF NOT EXISTS "vendor_subscription_plans_active_sort_order_idx" ON "vendor_subscription_plans"("active", "sort_order");

CREATE UNIQUE INDEX IF NOT EXISTS "vendor_subscription_provider_products_provider_platform_product_id_key"
  ON "vendor_subscription_provider_products"("provider", "platform", "product_id");
CREATE INDEX IF NOT EXISTS "vendor_subscription_provider_products_plan_id_active_idx"
  ON "vendor_subscription_provider_products"("plan_id", "active");
CREATE INDEX IF NOT EXISTS "vendor_subscription_provider_products_provider_entitlement_id_idx"
  ON "vendor_subscription_provider_products"("provider", "entitlement_id");

CREATE INDEX IF NOT EXISTS "vendor_subscriptions_vendor_id_status_idx" ON "vendor_subscriptions"("vendor_id", "status");
CREATE INDEX IF NOT EXISTS "vendor_subscriptions_revenuecat_app_user_id_idx" ON "vendor_subscriptions"("revenuecat_app_user_id");
CREATE INDEX IF NOT EXISTS "vendor_subscriptions_provider_platform_idx" ON "vendor_subscriptions"("provider", "platform");

CREATE UNIQUE INDEX IF NOT EXISTS "subscription_webhook_events_event_id_key" ON "subscription_webhook_events"("event_id");
CREATE INDEX IF NOT EXISTS "subscription_webhook_events_provider_status_idx" ON "subscription_webhook_events"("provider", "status");
CREATE INDEX IF NOT EXISTS "subscription_webhook_events_vendor_id_idx" ON "subscription_webhook_events"("vendor_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendor_subscription_provider_products_plan_id_fkey'
  ) THEN
    ALTER TABLE "vendor_subscription_provider_products"
      ADD CONSTRAINT "vendor_subscription_provider_products_plan_id_fkey"
      FOREIGN KEY ("plan_id") REFERENCES "vendor_subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendor_subscriptions_vendor_id_fkey'
  ) THEN
    ALTER TABLE "vendor_subscriptions"
      ADD CONSTRAINT "vendor_subscriptions_vendor_id_fkey"
      FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendor_subscriptions_plan_id_fkey'
  ) THEN
    ALTER TABLE "vendor_subscriptions"
      ADD CONSTRAINT "vendor_subscriptions_plan_id_fkey"
      FOREIGN KEY ("plan_id") REFERENCES "vendor_subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "vendor_subscription_plans" (
  "code",
  "name",
  "description",
  "monthly_price",
  "standard_commission_rate",
  "founding_commission_rate",
  "trial_days",
  "features",
  "limits",
  "sort_order"
) VALUES
  (
    'FREE',
    'Free',
    'Basic discovery profile without booking access.',
    0,
    0,
    0,
    90,
    '["discovery_map","vendor_profile","menu_photos","reviews","community_tab","followers"]',
    '{"staffAccounts":0,"truckListings":1,"bookings":false,"analytics":"none"}',
    1
  ),
  (
    'STARTER',
    'Starter',
    'Drops and booking essentials for growing vendors.',
    10,
    0.150,
    0.120,
    90,
    '["discovery_map","vendor_profile","menu_photos","reviews","community_tab","followers","live_drops","drop_promos","qr_checkin_rewards","follower_push","follower_broadcast","event_booking_requests","quotes_accept_bookings","basic_analytics","staff_accounts"]',
    '{"staffAccounts":1,"truckListings":1,"bookings":true,"analytics":"basic"}',
    2
  ),
  (
    'PRO',
    'Pro',
    'Full platform access with discovery boost and analytics.',
    19,
    0.120,
    0.100,
    90,
    '["starter_features","community_booking_requests","featured_discovery","search_boost","full_earnings_analytics","staff_accounts"]',
    '{"staffAccounts":2,"truckListings":1,"bookings":true,"analytics":"full"}',
    3
  ),
  (
    'ELITE',
    'Elite',
    'Maximum growth plan with advanced analytics and multi-truck support.',
    49,
    0.080,
    0.060,
    90,
    '["pro_features","multi_truck","advanced_analytics","featured_badge","priority_support","early_access","social_media_feature"]',
    '{"staffAccounts":5,"truckListings":3,"bookings":true,"analytics":"advanced"}',
    4
  )
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "vendor_founding_offer_config" (
  "id",
  "active",
  "starts_at",
  "ends_at",
  "discount_percent",
  "discount_start_month",
  "discount_end_month",
  "trial_days"
) VALUES (
  'default',
  true,
  '2026-08-05T00:00:00Z',
  '2026-10-04T23:59:59Z',
  50,
  4,
  12,
  90
) ON CONFLICT ("id") DO NOTHING;

INSERT INTO "vendor_subscription_provider_products" (
  "plan_id",
  "provider",
  "platform",
  "product_id",
  "entitlement_id",
  "revenuecat_offering_id",
  "revenuecat_package_id",
  "active"
)
SELECT
  p."id",
  'REVENUECAT',
  mapping."platform"::"VendorSubscriptionPlatform",
  mapping."product_id",
  'vendor_subscription',
  'default',
  mapping."package_id",
  true
FROM "vendor_subscription_plans" p
JOIN (
  VALUES
    ('STARTER', 'WEB', 'bitedrop_vendor_starter_monthly', 'starter_monthly'),
    ('STARTER', 'IOS', 'com.bitedrop.app.vendor.starter.monthly', 'starter_monthly'),
    ('STARTER', 'ANDROID', 'vendor_starter_monthly', 'starter_monthly'),
    ('PRO', 'WEB', 'bitedrop_vendor_pro_monthly', 'pro_monthly'),
    ('PRO', 'IOS', 'com.bitedrop.app.vendor.pro.monthly', 'pro_monthly'),
    ('PRO', 'ANDROID', 'vendor_pro_monthly', 'pro_monthly'),
    ('ELITE', 'WEB', 'bitedrop_vendor_elite_monthly', 'elite_monthly'),
    ('ELITE', 'IOS', 'com.bitedrop.app.vendor.elite.monthly', 'elite_monthly'),
    ('ELITE', 'ANDROID', 'vendor_elite_monthly', 'elite_monthly')
) AS mapping("code", "platform", "product_id", "package_id")
  ON p."code"::TEXT = mapping."code"
ON CONFLICT ("provider", "platform", "product_id") DO NOTHING;
