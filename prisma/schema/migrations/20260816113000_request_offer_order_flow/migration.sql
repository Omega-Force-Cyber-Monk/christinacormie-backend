CREATE TYPE "CommunityEventType" AS ENUM (
  'CORPORATE_EVENT',
  'BIRTHDAY_PARTY',
  'WEDDING_RECEPTION',
  'GRADUATION_PARTY',
  'COMMUNITY_EVENT',
  'FUNDRAISER',
  'OTHER'
);

CREATE TYPE "OfferPricingModel" AS ENUM (
  'FLAT_FEE',
  'PER_PERSON'
);

ALTER TYPE "BookingEventType" ADD VALUE IF NOT EXISTS 'WEDDING_RECEPTION';
ALTER TYPE "BookingEventType" ADD VALUE IF NOT EXISTS 'GRADUATION_PARTY';
ALTER TYPE "BookingEventType" ADD VALUE IF NOT EXISTS 'COMMUNITY_EVENT';
ALTER TYPE "BookingEventType" ADD VALUE IF NOT EXISTS 'FUNDRAISER';

ALTER TABLE "community_requests"
  ADD COLUMN "event_type" "CommunityEventType",
  ADD COLUMN "contact_phone" VARCHAR(30),
  ADD COLUMN "preferred_menu_items" JSONB;

ALTER TABLE "vendor_offers"
  ADD COLUMN "note_to_client" TEXT,
  ADD COLUMN "pricing_model" "OfferPricingModel",
  ADD COLUMN "selected_menu_items" JSONB,
  ADD COLUMN "extra_charges" JSONB,
  ADD COLUMN "base_service_fee" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "transport_fee" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "tax_amount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "discount_amount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "payment_preference" "BookingPaymentPreference",
  ADD COLUMN "deposit_amount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "deposit_percent" DECIMAL(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "balance_due_at_event" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "commission_amount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "vendor_net_amount" DECIMAL(12, 2) NOT NULL DEFAULT 0;
