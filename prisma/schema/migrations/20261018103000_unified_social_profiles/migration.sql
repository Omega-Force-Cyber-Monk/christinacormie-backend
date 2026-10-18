-- One vendor may own only one food truck. Fail with a useful message instead
-- of silently deleting or merging production data.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM food_trucks
    GROUP BY vendor_id HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one food truck per vendor: duplicate vendor_id values exist';
  END IF;
END $$;

CREATE UNIQUE INDEX "food_trucks_vendor_id_key" ON "food_trucks"("vendor_id");

CREATE TABLE "user_follows" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "follower_user_id" UUID NOT NULL,
  "followed_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_follows_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_follows_no_self" CHECK ("follower_user_id" <> "followed_user_id")
);

CREATE UNIQUE INDEX "user_follows_follower_user_id_followed_user_id_key"
  ON "user_follows"("follower_user_id", "followed_user_id");
CREATE INDEX "user_follows_followed_user_id_created_at_idx"
  ON "user_follows"("followed_user_id", "created_at");
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_follower_user_id_fkey"
  FOREIGN KEY ("follower_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_followed_user_id_fkey"
  FOREIGN KEY ("followed_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve existing Food Truck follows in the new account-level follow graph.
INSERT INTO "user_follows" ("follower_user_id", "followed_user_id", "created_at")
SELECT ftf."user_id", v."user_id", MIN(ftf."created_at")
FROM "food_truck_follows" ftf
JOIN "food_trucks" ft ON ft."id" = ftf."food_truck_id"
JOIN "vendors" v ON v."id" = ft."vendor_id"
WHERE ftf."user_id" <> v."user_id"
GROUP BY ftf."user_id", v."user_id"
ON CONFLICT ("follower_user_id", "followed_user_id") DO NOTHING;

CREATE TABLE "user_blocks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "blocker_user_id" UUID NOT NULL,
  "blocked_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_blocks_no_self" CHECK ("blocker_user_id" <> "blocked_user_id")
);

CREATE UNIQUE INDEX "user_blocks_blocker_user_id_blocked_user_id_key"
  ON "user_blocks"("blocker_user_id", "blocked_user_id");
CREATE INDEX "user_blocks_blocked_user_id_idx" ON "user_blocks"("blocked_user_id");
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_user_id_fkey"
  FOREIGN KEY ("blocker_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_user_id_fkey"
  FOREIGN KEY ("blocked_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "places" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "market_id" UUID,
  "name" VARCHAR(180) NOT NULL,
  "address" TEXT,
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "places_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "places_is_active_name_idx" ON "places"("is_active", "name");
ALTER TABLE "places" ADD CONSTRAINT "places_market_id_fkey"
  FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "posts" ADD COLUMN "author_user_id" UUID;
ALTER TABLE "posts" ADD COLUMN "location_id" UUID;
ALTER TABLE "posts" ALTER COLUMN "vendor_id" DROP NOT NULL;
ALTER TABLE "posts" ALTER COLUMN "food_truck_id" DROP NOT NULL;
ALTER TABLE "posts" ALTER COLUMN "content" SET DEFAULT '';

UPDATE "posts" p
SET "author_user_id" = v."user_id"
FROM "vendors" v
WHERE p."vendor_id" = v."id" AND p."author_user_id" IS NULL;

ALTER TABLE "posts" ADD CONSTRAINT "posts_author_user_id_fkey"
  FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "posts" ADD CONSTRAINT "posts_location_id_fkey"
  FOREIGN KEY ("location_id") REFERENCES "places"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "posts_author_user_id_created_at_idx" ON "posts"("author_user_id", "created_at");

CREATE TABLE "post_tags" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "post_id" UUID NOT NULL,
  "tagged_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "post_tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "post_tags_post_id_tagged_user_id_key"
  ON "post_tags"("post_id", "tagged_user_id");
CREATE INDEX "post_tags_tagged_user_id_created_at_idx"
  ON "post_tags"("tagged_user_id", "created_at");
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_tagged_user_id_fkey"
  FOREIGN KEY ("tagged_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "DirectConversationStatus" AS ENUM ('ACTIVE', 'REQUESTED', 'DECLINED');
ALTER TABLE "conversations"
  ADD COLUMN "direct_status" "DirectConversationStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "requested_recipient_id" UUID,
  ADD COLUMN "accepted_at" TIMESTAMPTZ(6);
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_requested_recipient_id_fkey"
  FOREIGN KEY ("requested_recipient_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "conversations_requested_recipient_id_direct_status_idx"
  ON "conversations"("requested_recipient_id", "direct_status");
