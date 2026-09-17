# System Payment Implementation Plan

This document is only an alignment plan. Do not implement from this until the flow is reviewed and confirmed.

## Goal

Build a clean Stripe payment flow for BiteDrop bookings where:

- customer pays by card;
- platform Stripe account receives/holds the payment;
- vendor payout is released only after booking completion approval;
- platform keeps commission;
- vendor net amount goes to vendor Stripe connected account;
- Stripe handles vendor bank payout from the connected account;
- refunds go back to the customer original payment method.

## Roles in payment flow

### Customer

Customer does not need Stripe Connect onboarding.

Customer only pays by:

- card;
- Apple Pay / Google Pay if enabled by Stripe;
- other Stripe-supported payment methods if enabled.

Customer does not need:

- connected account;
- bank account setup;
- payout onboarding.

Refunds go back to the customer original payment method through Stripe.

### Vendor

Vendor needs Stripe Connect onboarding because vendor receives payout.

Vendor must complete Stripe onboarding to provide:

- identity/business verification;
- tax information if required by Stripe;
- bank account;
- payout eligibility.

Backend stores only Stripe account status:

- `stripeAccountId`
- `onboardingCompleted`
- `chargesEnabled`
- `payoutsEnabled`
- `disabledReason`

Backend should not manually collect sensitive W-9/SSN/EIN/bank account data.

### Platform/Admin

Platform/admin owns the main Stripe account.

Backend uses:

```env
STRIPE_SECRET_KEY=platform_stripe_secret_key
STRIPE_WEBHOOK_SECRET=platform_webhook_secret
```

Platform receives customer payment first. After completion, platform keeps commission and transfers vendor net amount to vendor connected account.

## Recommended vendor payout setup UI

Current UI shows:

1. W-9 tax information
2. Connect bank account on Stripe

Recommended flow:

Keep the intro screen, but remove custom W-9 collection from app.

Use:

1. Verify your business with Stripe
2. Connect your bank account with Stripe

Button:

```text
Continue with Stripe
```

Frontend calls:

```http
POST /api/v1/payments/connect/account
```

Backend returns:

```json
{
  "paymentAccount": {
    "stripeAccountId": "acct_xxx",
    "onboardingCompleted": false,
    "chargesEnabled": false,
    "payoutsEnabled": false,
    "disabledReason": null
  },
  "onboardingUrl": "https://connect.stripe.com/setup/..."
}
```

Frontend opens `onboardingUrl`.

Status check:

```http
GET /api/v1/payments/connect/account
```

Frontend rules:

```ts
if (!paymentAccount) {
  showPayoutSetupIntro();
} else if (
  !paymentAccount.onboardingCompleted ||
  !paymentAccount.payoutsEnabled
) {
  showContinueStripeSetup();
} else {
  showPayoutReady();
}
```

## Booking payment lifecycle

### 1. Quote accepted

Customer accepts vendor quote.

Booking status should become:

```text
PAYMENT_PENDING
```

Customer can now pay deposit/full amount depending on quote terms.

### 2. Customer payment starts

Frontend calls:

```http
POST /api/v1/payments/bookings/:bookingId/intent
```

Backend creates Stripe PaymentIntent under platform Stripe account.

Important:

- do not send money directly to vendor during payment intent creation;
- do not use direct `transfer_data[destination]` in this flow;
- payment should land in platform Stripe balance.

Payment record:

```text
Payment.status = PROCESSING
```

### 3. Payment success webhook

Stripe sends:

```text
payment_intent.succeeded
```

Backend should:

- mark payment as `SUCCEEDED`;
- mark booking as `CONFIRMED`;
- create/update commission record;
- create pending payout record;
- notify customer/vendor.

Booking timeline:

Customer:

```text
Booking confirmed ✅
Deposit received ✅
Event day pending
Request pending pending
Payment released pending
```

Vendor:

```text
Booking confirmed ✅
Deposit received ✅
Event day pending
Completion request sent pending
Completed pending
```

### 4. Before event completion

Money stays in platform Stripe balance.

Vendor should not receive payout yet.

Payout record remains:

```text
Payout.status = PENDING
```

### 5. Vendor requests completion

Vendor sends completion request after event day.

Booking fields:

```text
completionRequestedAt
completionRequestedById
```

Customer sees:

```text
Requested for completion
Approve
Report an issue
```

Vendor sees:

```text
Completion request sent
```

### 6. Customer approves completion

Customer approves completion request.

Backend should:

- release vendor payout;
- transfer vendor net amount from platform Stripe account to vendor connected account;
- mark payout as `PAID`;
- mark booking as `COMPLETED`;
- set `paymentReleasedAt`;
- notify vendor/customer/admin if needed.

Stripe operation:

```text
Platform Stripe balance -> Vendor connected account
```

Vendor connected account to vendor bank account is handled by Stripe payout schedule.

Backend does not manually send money to vendor bank account.

### 7. Customer reports issue

If customer reports issue before approving completion:

- booking should not be completed;
- vendor payout should remain pending;
- payout is frozen until admin decision;
- admin can see issue/messages in booking management;
- customer/vendor can send normal HTTP messages;
- no Socket.IO required for this admin issue flow.

Initial admin decision options should be intentionally simple:

```ts
enum BookingIssueResolutionDecision {
  RELEASE_PAYOUT
  FULL_REFUND
}
```

Do not add partial refund in the first version. Partial refund affects commission and payout math, so it should be added later only after business rules are finalized.

#### Vendor favor decision

If admin resolves the issue in vendor favor:

- release vendor payout;
- mark payout as `PAID`;
- mark booking as `COMPLETED`;
- set `paymentReleasedAt`;
- close issue as resolved;
- notify customer and vendor.

Decision:

```json
{
  "decision": "RELEASE_PAYOUT",
  "resolutionNote": "Vendor completed the service."
}
```

#### Customer favor decision

If admin resolves the issue in customer favor:

- create full Stripe refund against the original PaymentIntent;
- cancel vendor payout;
- do not transfer money to vendor;
- close issue as resolved;
- mark booking as cancelled/refunded/dispute-resolved according to final status naming;
- notify customer and vendor.

Decision:

```json
{
  "decision": "FULL_REFUND",
  "resolutionNote": "Customer issue approved for refund."
}
```

## Money movement summary

### Completed booking

```text
Customer card
  -> Platform Stripe account
  -> Platform keeps commission
  -> Vendor net amount transfers to vendor connected account
  -> Stripe automatically pays vendor bank based on payout schedule
```

### Refund

```text
Platform Stripe account
  -> Refund original PaymentIntent
  -> Customer original card/payment method
```

Customer bank account collection is not needed.

## Current backend already implemented

Current backend already has:

- vendor Stripe Connect account creation;
- Stripe account link creation;
- vendor payment account status update from `account.updated`;
- customer PaymentIntent creation;
- Stripe webhook handling for payment success/failure/cancel;
- payment record;
- commission record;
- pending payout record;
- refund creation;
- refund webhook status updates;
- vendor payout release through Stripe transfer after completion approval;
- admin notification for payment/refund failure.

## Confirmed implementation decisions

1. Is vendor allowed to accept bookings before Stripe onboarding is complete?

Decision:

```text
No. Do not fully block vendor from using the app, but payment should not be accepted unless vendor payout setup is ready.
```

Recommended behavior:

- Vendor can browse/use profile.
- Vendor can set up profile/menu.
- Vendor can receive booking requests.
- Vendor can send quotes if needed.
- Customer payment creation should be blocked if vendor payout setup is not ready.

2. Should payment creation require vendor payout readiness?

Decision: yes.

```text
Before customer payment starts, require:
```

```ts
vendor.paymentAccount exists
vendor.paymentAccount.onboardingCompleted === true
vendor.paymentAccount.chargesEnabled === true
vendor.paymentAccount.payoutsEnabled === true
```

If not ready, return a clear error so frontend can show:

```text
This vendor has not completed payout setup yet. Please try again later.
```

3. Should admin be able to manually retry failed payout?

Decision: yes, but manual only.

Add admin endpoint:

```http
POST /api/v1/admin/payouts/:payoutId/retry
```

Rules:

- only `FAILED` payout can be retried;
- vendor Stripe connected account must still be ready;
- retry should call Stripe transfer again with idempotency protection;
- if retry succeeds, mark payout `PAID`;
- if retry fails, keep status `FAILED` with reason.

4. What happens if customer reports issue and admin resolves in vendor favor?

Decision:

```text
Vendor favor = release payout + complete booking.
```

5. What happens if issue resolves in customer favor?

Decision:

```text
Customer favor = full refund + cancel payout.
```

Partial refund is not part of the initial implementation. Add later after payout/commission adjustment rules are confirmed.

## Implemented payment safety phase

Implemented after review/confirmation:

1. Tightened vendor payout readiness checks before customer payment.
2. Added clear API responses telling frontend why vendor payout setup is incomplete.
3. Added admin payout retry endpoint for failed payouts.
4. Added admin issue-resolution decision flow:
   - `RELEASE_PAYOUT`
   - `FULL_REFUND`
5. Kept partial refund out of the first version.
6. Updated system flowchart docs.

Implementation note:

- `PATCH /api/v1/admin/bookings/:bookingId/issues/:issueId/resolve` now requires a decision body.
- `POST /api/v1/admin/payouts/:payoutId/retry` retries failed payouts through Stripe transfer.
- Old manual payout approve path no longer marks payout paid directly; it uses the safe Stripe retry flow.
- Old manual payout reject/hold paths return clear errors and point admin to booking issue resolution.

## Not recommended

Do not implement custom W-9/SSN/EIN/bank account storage in our backend unless there is a legal/compliance requirement.

Stripe Connect onboarding should collect sensitive payout/tax information.
