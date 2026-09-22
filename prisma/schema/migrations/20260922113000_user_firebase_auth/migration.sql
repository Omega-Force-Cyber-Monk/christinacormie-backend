ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "firebase_uid" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "auth_provider" VARCHAR(30);

CREATE UNIQUE INDEX IF NOT EXISTS "users_firebase_uid_key" ON "users"("firebase_uid");
