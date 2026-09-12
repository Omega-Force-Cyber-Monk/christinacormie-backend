ALTER TABLE "bookings"
ADD COLUMN "custom_menu_items" JSONB,
ADD COLUMN "is_adult_confirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "terms_accepted" BOOLEAN NOT NULL DEFAULT false;
