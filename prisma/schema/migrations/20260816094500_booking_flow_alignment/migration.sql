CREATE TYPE "BookingEventType" AS ENUM (
  'BIRTHDAY_PARTY',
  'CORPORATE_EVENT',
  'WEDDING',
  'PRIVATE_PARTY',
  'OTHER'
);

CREATE TYPE "BookingPaymentPreference" AS ENUM (
  'DEPOSIT_ONLY',
  'PREPAID_IN_FULL',
  'NO_PREFERENCE'
);

ALTER TABLE "bookings"
ADD COLUMN "event_type" "BookingEventType",
ADD COLUMN "contact_phone" VARCHAR(30),
ADD COLUMN "budget_amount" DECIMAL(12,2),
ADD COLUMN "preferred_menu_item_ids" JSONB,
ADD COLUMN "reference_image_urls" JSONB,
ADD COLUMN "payment_preference" "BookingPaymentPreference" NOT NULL DEFAULT 'NO_PREFERENCE';
