/*
  Warnings:

  - A unique constraint covering the columns `[promotion_id,user_id]` on the table `promotion_redemptions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "stripe_webhook_events" (
    "id" UUID NOT NULL,
    "stripe_event_id" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'PROCESSING',
    "processed_at" TIMESTAMPTZ(6),
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stripe_webhook_events_stripe_event_id_key" ON "stripe_webhook_events"("stripe_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_redemptions_promotion_id_user_id_key" ON "promotion_redemptions"("promotion_id", "user_id");
