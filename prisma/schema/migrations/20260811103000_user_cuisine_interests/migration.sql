CREATE TABLE "user_cuisine_interests" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "cuisine_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_cuisine_interests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_cuisine_interests_user_id_cuisine_id_key"
ON "user_cuisine_interests" ("user_id", "cuisine_id");

ALTER TABLE "user_cuisine_interests"
ADD CONSTRAINT "user_cuisine_interests_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_cuisine_interests"
ADD CONSTRAINT "user_cuisine_interests_cuisine_id_fkey"
FOREIGN KEY ("cuisine_id") REFERENCES "cuisines"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
