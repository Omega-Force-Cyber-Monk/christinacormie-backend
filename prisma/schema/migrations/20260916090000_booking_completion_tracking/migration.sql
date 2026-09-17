CREATE TYPE "BookingIssueStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

CREATE TYPE "BookingIssueMessageSenderRole" AS ENUM ('CUSTOMER', 'VENDOR', 'ADMIN');

ALTER TABLE "bookings"
  ADD COLUMN "completion_requested_at" TIMESTAMPTZ(6),
  ADD COLUMN "completion_requested_by" UUID,
  ADD COLUMN "completion_approved_at" TIMESTAMPTZ(6),
  ADD COLUMN "completion_approved_by" UUID,
  ADD COLUMN "payment_released_at" TIMESTAMPTZ(6);

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_completion_requested_by_fkey"
    FOREIGN KEY ("completion_requested_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "bookings_completion_approved_by_fkey"
    FOREIGN KEY ("completion_approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "booking_issues" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "booking_id" UUID NOT NULL,
  "reported_by" UUID NOT NULL,
  "message" TEXT NOT NULL,
  "status" "BookingIssueStatus" NOT NULL DEFAULT 'OPEN',
  "resolved_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_issues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "booking_issue_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "issue_id" UUID NOT NULL,
  "sender_id" UUID NOT NULL,
  "sender_role" "BookingIssueMessageSenderRole" NOT NULL,
  "message" TEXT NOT NULL,
  "read_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_issue_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "booking_issues_booking_id_status_idx" ON "booking_issues"("booking_id", "status");
CREATE INDEX "booking_issues_reported_by_idx" ON "booking_issues"("reported_by");
CREATE INDEX "booking_issue_messages_issue_id_created_at_idx" ON "booking_issue_messages"("issue_id", "created_at");
CREATE INDEX "booking_issue_messages_sender_id_idx" ON "booking_issue_messages"("sender_id");

ALTER TABLE "booking_issues"
  ADD CONSTRAINT "booking_issues_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "booking_issues_reported_by_fkey"
    FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "booking_issue_messages"
  ADD CONSTRAINT "booking_issue_messages_issue_id_fkey"
    FOREIGN KEY ("issue_id") REFERENCES "booking_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "booking_issue_messages_sender_id_fkey"
    FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payouts"
  ADD COLUMN "booking_id" UUID,
  ADD COLUMN "payment_id" UUID;

CREATE UNIQUE INDEX "payouts_payment_id_key" ON "payouts"("payment_id");
CREATE INDEX "payouts_booking_id_idx" ON "payouts"("booking_id");

ALTER TABLE "payouts"
  ADD CONSTRAINT "payouts_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "payouts_payment_id_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
