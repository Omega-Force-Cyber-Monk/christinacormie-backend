-- Vendor onboarding historically left the one associated food truck in DRAFT.
-- Activate only non-deleted drafts owned by vendors whose onboarding status
-- already permits public participation. Preserve explicit INACTIVE/SUSPENDED.
UPDATE "food_trucks" AS ft
SET
  "status" = 'ACTIVE',
  "updated_at" = CURRENT_TIMESTAMP
FROM "vendors" AS v
WHERE ft."vendor_id" = v."id"
  AND ft."status" = 'DRAFT'
  AND ft."deleted_at" IS NULL
  AND v."deleted_at" IS NULL
  AND v."status" IN ('APPROVED', 'PENDING_APPROVAL');
