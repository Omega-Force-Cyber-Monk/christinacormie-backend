-- Allow reviews to be created from either a completed booking or a confirmed reward redemption.
ALTER TABLE "reviews" ADD COLUMN "redemption_id" UUID;

ALTER TABLE "reviews" ALTER COLUMN "booking_id" DROP NOT NULL;

CREATE UNIQUE INDEX "reviews_redemption_id_key" ON "reviews"("redemption_id");

ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_redemption_id_fkey"
  FOREIGN KEY ("redemption_id")
  REFERENCES "reward_redemptions"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_booking_or_redemption_check"
  CHECK (
    ("booking_id" IS NOT NULL AND "redemption_id" IS NULL)
    OR
    ("booking_id" IS NULL AND "redemption_id" IS NOT NULL)
  );
