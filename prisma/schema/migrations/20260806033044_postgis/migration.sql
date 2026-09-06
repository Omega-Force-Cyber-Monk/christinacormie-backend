-- DropIndex
DROP INDEX "idx_bookings_location";

-- DropIndex
DROP INDEX "idx_check_ins_user_location";

-- DropIndex
DROP INDEX "idx_community_requests_location";

-- DropIndex
DROP INDEX "idx_food_trucks_current_location";

-- DropIndex
DROP INDEX "idx_markets_center_location";

-- DropIndex
DROP INDEX "idx_qr_scans_scan_location";

-- DropIndex
DROP INDEX "idx_service_areas_center_location";

-- AlterTable
ALTER TABLE "admin_audit_logs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "notification_preferences" ADD COLUMN     "check_in_alerts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "payment_alerts" BOOLEAN NOT NULL DEFAULT true;
