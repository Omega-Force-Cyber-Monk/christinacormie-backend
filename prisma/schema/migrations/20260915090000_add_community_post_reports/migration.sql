CREATE TYPE "CommunityPostReportReason" AS ENUM (
  'SPAM_OR_IRRELEVANT',
  'INAPPROPRIATE_CONTENT',
  'HARASSMENT',
  'SCAM_OR_FRAUD',
  'NOT_FOOD_TRUCK_RELATED'
);

CREATE TYPE "CommunityPostReportStatus" AS ENUM (
  'PENDING',
  'REVIEWING',
  'RESOLVED',
  'DISMISSED'
);

CREATE TABLE "community_post_reports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "post_id" UUID NOT NULL,
  "reported_by" UUID NOT NULL,
  "reason" "CommunityPostReportReason" NOT NULL,
  "status" "CommunityPostReportStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_by" UUID,
  "resolution_notes" TEXT,
  "reviewed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "community_post_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "community_post_reports_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "community_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "community_post_reports_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "community_post_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "community_post_reports_post_id_reported_by_key"
  ON "community_post_reports"("post_id", "reported_by");

CREATE INDEX "community_post_reports_post_id_status_idx"
  ON "community_post_reports"("post_id", "status");

