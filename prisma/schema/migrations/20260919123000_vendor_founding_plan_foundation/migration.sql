ALTER TABLE "vendors"
  ADD COLUMN "is_founding_member" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "founding_joined_at" TIMESTAMPTZ(6),
  ADD COLUMN "trial_started_at" TIMESTAMPTZ(6),
  ADD COLUMN "trial_ends_at" TIMESTAMPTZ(6),
  ADD COLUMN "founding_discount_ends_at" TIMESTAMPTZ(6),
  ADD COLUMN "locked_commission_rate" DECIMAL(6, 3);

INSERT INTO "platform_settings" ("id", "key", "value", "description", "is_public")
VALUES (
  gen_random_uuid(),
  'vendor_founding_offer',
  '{
    "enabled": true,
    "startAt": "2026-08-05T00:00:00.000Z",
    "endAt": "2026-10-04T23:59:59.999Z",
    "officialLaunchAt": "2026-10-05T00:00:00.000Z",
    "subscriptionDiscountPercent": 50,
    "subscriptionDiscountMonths": 9,
    "freeTrialMonths": 3
  }'::jsonb,
  'Vendor founding offer window and subscription discount configuration.',
  true
)
ON CONFLICT ("key") DO NOTHING;
