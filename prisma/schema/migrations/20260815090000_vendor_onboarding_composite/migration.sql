CREATE TYPE "VendorPlan" AS ENUM ('FREE', 'STARTER', 'PRO', 'ELITE');
CREATE TYPE "TruckType" AS ENUM ('FOOD_TRUCK', 'FOOD_TRAILER', 'FOOD_CART', 'POP_UP', 'CATERING', 'OTHER');
CREATE TYPE "PhotoShootRequestStatus" AS ENUM ('PENDING', 'CONTACTED', 'SCHEDULED', 'COMPLETED', 'CANCELLED');

ALTER TABLE "vendors"
ADD COLUMN "selected_plan" "VendorPlan" NOT NULL DEFAULT 'FREE';

ALTER TABLE "food_trucks"
ADD COLUMN "truck_call_name" VARCHAR(255),
ADD COLUMN "truck_type" "TruckType",
ADD COLUMN "primary_city" VARCHAR(150);

CREATE TABLE "vendor_photo_shoot_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "vendor_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "food_truck_id" UUID,
  "contact_name" VARCHAR(150),
  "contact_email" VARCHAR(255),
  "contact_phone" VARCHAR(30),
  "city" VARCHAR(150),
  "preferred_date" DATE,
  "notes" TEXT,
  "status" "PhotoShootRequestStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vendor_photo_shoot_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vendor_photo_shoot_requests_vendor_id_idx" ON "vendor_photo_shoot_requests"("vendor_id");
CREATE INDEX "vendor_photo_shoot_requests_status_idx" ON "vendor_photo_shoot_requests"("status");

ALTER TABLE "vendor_photo_shoot_requests"
ADD CONSTRAINT "vendor_photo_shoot_requests_vendor_id_fkey"
FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vendor_photo_shoot_requests"
ADD CONSTRAINT "vendor_photo_shoot_requests_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vendor_photo_shoot_requests"
ADD CONSTRAINT "vendor_photo_shoot_requests_food_truck_id_fkey"
FOREIGN KEY ("food_truck_id") REFERENCES "food_trucks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
