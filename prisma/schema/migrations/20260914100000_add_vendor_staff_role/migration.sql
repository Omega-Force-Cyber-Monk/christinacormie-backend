ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'VENDOR_STAFF';

CREATE TYPE "StaffStatus" AS ENUM ('ACTIVE', 'DISABLED');

CREATE TABLE IF NOT EXISTS "vendor_staff" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "vendor_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "pin_hash" VARCHAR(255) NOT NULL,
  "pin_encrypted" TEXT NOT NULL,
  "status" "StaffStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "vendor_staff_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vendor_staff_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "vendor_staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "vendor_staff_user_id_key"
  ON "vendor_staff"("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "vendor_staff_vendor_id_email_key"
  ON "vendor_staff"("vendor_id", "email");

