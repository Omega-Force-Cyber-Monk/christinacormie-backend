-- Ensure PostGIS extension exists
CREATE EXTENSION IF NOT EXISTS postgis;

-- Spatial GIST indexes for geography columns
CREATE INDEX IF NOT EXISTS idx_markets_center_location ON markets USING GIST (center_location);
CREATE INDEX IF NOT EXISTS idx_food_trucks_current_location ON food_trucks USING GIST (current_location);
CREATE INDEX IF NOT EXISTS idx_service_areas_center_location ON service_areas USING GIST (center_location);
CREATE INDEX IF NOT EXISTS idx_bookings_location ON bookings USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_community_requests_location ON community_requests USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_qr_scans_scan_location ON qr_scans USING GIST (scan_location);
CREATE INDEX IF NOT EXISTS idx_check_ins_user_location ON check_ins USING GIST (user_location);

-- Create admin_audit_logs table
CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_user_id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" VARCHAR(255) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'admin_audit_logs_admin_user_id_fkey'
    ) THEN
        ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- Indexes for admin_audit_logs
CREATE INDEX IF NOT EXISTS "admin_audit_logs_admin_user_id_idx" ON "admin_audit_logs"("admin_user_id");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_entity_type_entity_id_idx" ON "admin_audit_logs"("entity_type", "entity_id");
