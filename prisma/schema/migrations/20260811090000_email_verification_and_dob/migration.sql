ALTER TABLE "user_profiles"
ADD COLUMN "date_of_birth" DATE;

CREATE TABLE "email_verification_codes" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "code_hash" VARCHAR(255) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "consumed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_verification_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_verification_codes_user_id_expires_at_idx"
ON "email_verification_codes" ("user_id", "expires_at");

ALTER TABLE "email_verification_codes"
ADD CONSTRAINT "email_verification_codes_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
