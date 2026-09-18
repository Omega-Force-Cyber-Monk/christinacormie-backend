CREATE TYPE "BookingIssueResolutionDecision" AS ENUM ('RELEASE_PAYOUT', 'FULL_REFUND');

ALTER TABLE "booking_issues"
ADD COLUMN "resolution_decision" "BookingIssueResolutionDecision",
ADD COLUMN "resolution_note" TEXT,
ADD COLUMN "resolved_by" UUID;

CREATE INDEX "booking_issues_resolved_by_idx" ON "booking_issues"("resolved_by");

ALTER TABLE "booking_issues"
ADD CONSTRAINT "booking_issues_resolved_by_fkey"
FOREIGN KEY ("resolved_by") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
