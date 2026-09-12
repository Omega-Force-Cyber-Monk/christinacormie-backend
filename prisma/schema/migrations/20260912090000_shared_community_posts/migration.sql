CREATE TYPE "CommunityPostCategory" AS ENUM ('NEED_TRUCK', 'VENDOR_CALLOUT', 'FOR_SALE', 'HIRING_JOBS', 'COMMUNITY_HELP', 'COMMUNITY');
CREATE TYPE "CommunityActionType" AS ENUM ('INTEREST', 'IGNORE');
ALTER TABLE "community_requests"
  ADD COLUMN "category" "CommunityPostCategory" NOT NULL DEFAULT 'NEED_TRUCK',
  ADD COLUMN "spots_open" INTEGER,
  ADD COLUMN "attendance_min" INTEGER,
  ADD COLUMN "attendance_max" INTEGER;
CREATE INDEX "community_requests_visibility_category_created_at_idx" ON "community_requests" ("visibility", "category", "created_at");
CREATE TABLE "community_post_actions" (
  "id" UUID NOT NULL PRIMARY KEY,
  "post_id" UUID NOT NULL REFERENCES "community_requests"("id"),
  "user_id" UUID NOT NULL REFERENCES "users"("id"),
  "type" "CommunityActionType" NOT NULL,
  "message" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "community_post_actions_post_id_user_id_type_key" ON "community_post_actions" ("post_id", "user_id", "type");
ALTER TABLE "vendor_offers" ADD COLUMN "price_per_person" DECIMAL(12, 2);
ALTER TABLE "booking_quotes" ADD COLUMN "price_per_person" DECIMAL(12, 2);
