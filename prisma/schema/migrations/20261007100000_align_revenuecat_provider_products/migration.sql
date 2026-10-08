-- Align backend RevenueCat provider product mappings with the values configured
-- in the RevenueCat dashboard used by the mobile app.

UPDATE "vendor_subscription_provider_products"
SET
  "entitlement_id" = 'premium_vendor',
  "revenuecat_offering_id" = COALESCE("revenuecat_offering_id", 'default'),
  "updated_at" = NOW()
WHERE "provider" = 'REVENUECAT';

UPDATE "vendor_subscription_provider_products" vpp
SET
  "product_id" = mapping."product_id",
  "entitlement_id" = 'premium_vendor',
  "revenuecat_offering_id" = 'default',
  "revenuecat_package_id" = mapping."package_id",
  "active" = true,
  "updated_at" = NOW()
FROM "vendor_subscription_plans" p
JOIN (
  VALUES
    ('STARTER', 'WEB', 'bitedrop_vendor_starter_monthly', '$rc_monthly'),
    ('STARTER', 'IOS', 'com.bitedrop.app.vendor.starter.monthly', '$rc_monthly'),
    ('STARTER', 'ANDROID', 'com.bitedrop.app.vendor.starter:starter-monthly', '$rc_monthly'),
    ('PRO', 'WEB', 'bitedrop_vendor_pro_monthly', 'pro_monthly'),
    ('PRO', 'IOS', 'com.bitedrop.app.vendor.pro.monthly', 'pro_monthly'),
    ('PRO', 'ANDROID', 'com.bitedrop.app.vendor.pro:pro-monthly', 'pro_monthly'),
    ('ELITE', 'WEB', 'bitedrop_vendor_elite_monthly', 'elite_monthly'),
    ('ELITE', 'IOS', 'com.bitedrop.app.vendor.elite.monthly', 'elite_monthly'),
    ('ELITE', 'ANDROID', 'com.bitedrop.app.vendor.elite:elite-monthly', 'elite_monthly')
) AS mapping("code", "platform", "product_id", "package_id")
  ON p."code"::TEXT = mapping."code"
WHERE vpp."plan_id" = p."id"
  AND vpp."provider" = 'REVENUECAT'
  AND vpp."platform" = mapping."platform"::"VendorSubscriptionPlatform";

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
  'premium_vendor',
  'default',
  mapping."package_id",
  true
FROM "vendor_subscription_plans" p
JOIN (
  VALUES
    ('STARTER', 'WEB', 'bitedrop_vendor_starter_monthly', '$rc_monthly'),
    ('STARTER', 'IOS', 'com.bitedrop.app.vendor.starter.monthly', '$rc_monthly'),
    ('STARTER', 'ANDROID', 'com.bitedrop.app.vendor.starter:starter-monthly', '$rc_monthly'),
    ('PRO', 'WEB', 'bitedrop_vendor_pro_monthly', 'pro_monthly'),
    ('PRO', 'IOS', 'com.bitedrop.app.vendor.pro.monthly', 'pro_monthly'),
    ('PRO', 'ANDROID', 'com.bitedrop.app.vendor.pro:pro-monthly', 'pro_monthly'),
    ('ELITE', 'WEB', 'bitedrop_vendor_elite_monthly', 'elite_monthly'),
    ('ELITE', 'IOS', 'com.bitedrop.app.vendor.elite.monthly', 'elite_monthly'),
    ('ELITE', 'ANDROID', 'com.bitedrop.app.vendor.elite:elite-monthly', 'elite_monthly')
) AS mapping("code", "platform", "product_id", "package_id")
  ON p."code"::TEXT = mapping."code"
ON CONFLICT ("provider", "platform", "product_id") DO UPDATE SET
  "plan_id" = EXCLUDED."plan_id",
  "entitlement_id" = EXCLUDED."entitlement_id",
  "revenuecat_offering_id" = EXCLUDED."revenuecat_offering_id",
  "revenuecat_package_id" = EXCLUDED."revenuecat_package_id",
  "active" = true,
  "updated_at" = NOW();
