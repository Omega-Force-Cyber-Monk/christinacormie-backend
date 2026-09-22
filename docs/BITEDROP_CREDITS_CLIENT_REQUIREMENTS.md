# BiteDrop Credits - Client Requirement Notes

This document captures what the client/UI is communicating for the vendor BiteDrop Credits section.

## Page Purpose

Vendors can turn credit acceptance on or off. When credit acceptance is enabled, customers can redeem BiteDrop Credits with that vendor.

## Credit Acceptance State

The page shows the vendor's current credit acceptance status:

- `Currently Accepting`
- `Not Accepting`

The main action button changes based on the current state:

- If accepting: `Turn Off Credit Acceptance`
- If not accepting: `Turn On Credit Acceptance`

## How Credit Redemption Works

The UI explains the redemption flow in three steps:

1. Customer chooses redemption
   - Customer can show their QR code.
   - Customer can provide a manual code.
   - Customer can scan the vendor QR.

2. Verify purchase minimum
   - The vendor/order must meet the required minimum spend for the customer’s credit tier.
   - Minimums shown in the UI:
     - Free / Featured: `$10`
     - Premium: `$5`
     - Founding: `$0`

3. Complete transaction
   - Credits are deducted instantly.
   - Vendor receives the full eligible amount.
   - No processing fees are deducted from the vendor payout for credit redemption.

## Business Benefits Shown to Vendor

The UI says enabling BiteDrop Credits helps vendors through:

- Priority visibility
  - Vendor can appear in a `Credit Accepted` filter.

- Attract ready buyers
  - Credit holders are actively looking to spend.

- Drive repeat visits
  - UI copy mentions average repeat/visit lift.

- Boost rankings
  - Credit transactions improve the vendor’s platform score.

## Redemption Methods

The UI supports three redemption methods:

1. Staff Scan
   - Vendor/staff uses their device to scan the customer's QR code.
   - This is presented as the fastest method.

2. Manual Entry
   - Customer tells the vendor their code.
   - Vendor enters the code on their device.

3. Self-Service
   - Customer scans the vendor QR.
   - Customer redeems on their own phone.

## Backend Meaning

Based on this UI, backend should support:

- Vendor credit acceptance toggle.
- Reading current vendor credit acceptance status.
- Redemption analytics and recent redemption history.
- QR scan redemption.
- Manual code redemption.
- Self-service vendor QR redemption.
- Purchase minimum validation based on customer credit tier.
- Full credit amount applied without vendor processing fee deduction.
- Ranking/visibility fields can be calculated later from redemption activity.

## Important Notes

- This document only records the client/UI requirement from the provided screen.
- Exact API design, database schema, and implementation details should be handled in the implementation plan.
