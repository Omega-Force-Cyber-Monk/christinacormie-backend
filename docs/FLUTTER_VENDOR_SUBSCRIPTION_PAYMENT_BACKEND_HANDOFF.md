# Flutter Handoff — Vendor Subscription, Founding Plan, and Payment Backend Flow

This document explains the backend APIs and status flow for vendor subscription tiers, founding membership, Stripe subscription payment, booking payment, and payout setup.

It is for the Flutter developer/agent to consume the backend contract. It does not describe Flutter implementation details.

---

## 1. Core rule

The backend is DB-backed and admin-controlled.

```txt
Admin creates subscription tier
Backend stores tier in DB
Backend internally creates Stripe Product/Price when needed
Vendor selects tier
Vendor pays by card through native Stripe flow
Stripe webhook confirms status
Backend saves vendor subscription and unlocks features
```

Flutter does not send Stripe product IDs or Stripe price IDs.

Flutter does not receive `publishableKey` from backend. Flutter should use its own Stripe publishable key from app configuration.

Backend uses only:

```env
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_CONNECT_REFRESH_URL
STRIPE_CONNECT_RETURN_URL
```

---

## 2. Public subscription tier API

### Get vendor subscription tiers

```http
GET /api/v1/vendors/plans
```

Auth: not required.

Purpose:

- Show Free, Starter, Pro, Elite, and any active admin-created tiers.
- Return founding offer info.
- Return tier IDs that Flutter must use for subscription.

Important response fields:

```json
{
  "foundingOffer": {
    "enabled": true,
    "startAt": "2026-08-05T00:00:00.000Z",
    "endAt": "2026-10-04T23:59:59.999Z",
    "officialLaunchAt": "2026-10-05T00:00:00.000Z",
    "subscriptionDiscountPercent": 50,
    "subscriptionDiscountMonths": 9,
    "freeTrialMonths": 3,
    "isActiveNow": true
  },
  "trial": {
    "freeTrialMonths": 3,
    "foundingDiscountPercent": 50,
    "foundingDiscountMonths": 9
  },
  "plans": [
    {
      "id": "tier-uuid",
      "code": "STARTER",
      "plan": "STARTER",
      "name": "Starter",
      "subtitle": "Drops & Bookings",
      "monthlyPriceCents": 1000,
      "foundingMonthlyPriceCentsAfterTrial": 500,
      "normalCommissionRate": "0.150",
      "foundingCommissionRate": "0.120",
      "bookingEnabled": true,
      "maxStaffAccounts": 1,
      "maxIncludedTrucks": 1,
      "additionalTruckMonthlyPriceCents": null,
      "analyticsLevel": "BASIC",
      "trialDays": 90,
      "features": {},
      "included": [],
      "notIncluded": [],
      "active": true
    }
  ]
}
```

Flutter must use `plans[].id` as `tierId` when starting subscription payment.

---

## 3. Vendor subscription payment API

### Create or resume native subscription intent

```http
POST /api/v1/payments/vendors/me/subscription-intent
```

Auth: Vendor.

Request body:

```json
{
  "tierId": "tier-uuid-from-get-vendors-plans"
}
```

Backend behavior:

- Validates active tier.
- Rejects Free tier because Free does not require payment.
- Creates/reuses Stripe customer.
- Creates/reuses backend-managed Stripe subscription.
- Creates or updates `vendor_subscriptions`.
- Updates vendor summary fields:
  - `activeSubscriptionTierId`
  - `subscriptionStatus`
  - `stripeCustomerId`
  - `stripeSubscriptionId`
- Returns native Stripe client secret data.

Success response example:

```json
{
  "vendor": {
    "id": "vendor-uuid",
    "activeSubscriptionTierId": "tier-uuid",
    "selectedPlan": "STARTER",
    "subscriptionStatus": "INCOMPLETE",
    "stripeCustomerId": "cus_xxx",
    "stripeSubscriptionId": "sub_xxx",
    "trialStartedAt": "2026-09-20T00:00:00.000Z",
    "trialEndsAt": "2026-12-19T00:00:00.000Z",
    "subscriptionCurrentPeriodEnd": "2026-12-19T00:00:00.000Z",
    "isFoundingMember": true,
    "foundingDiscountEndsAt": "2027-09-20T00:00:00.000Z",
    "lockedCommissionRate": "0.120"
  },
  "stripe": {
    "customerId": "cus_xxx",
    "customerEphemeralKeySecret": "ek_xxx",
    "subscriptionId": "sub_xxx",
    "clientSecret": "seti_xxx_secret_xxx",
    "clientSecretType": "setup_intent"
  }
}
```

Response does not include `publishableKey`.

### Important validation

Old request body is not supported:

```json
{
  "plan": "STARTER"
}
```

Expected result:

```json
{
  "statusCode": 400,
  "message": ["property plan should not exist", "tierId must be a UUID"],
  "error": "Bad Request"
}
```

### Free tier payment

If Flutter sends the Free tier ID to this payment endpoint, backend returns:

```json
{
  "statusCode": 400,
  "message": "Free tier does not require subscription payment",
  "error": "Bad Request"
}
```

Free tier should not call subscription payment.

---

## 4. Subscription retry flow

If vendor opens native Stripe payment sheet and leaves before finishing:

```txt
subscriptionStatus remains INCOMPLETE
```

Flutter can call the same endpoint again:

```http
POST /api/v1/payments/vendors/me/subscription-intent
```

With same body:

```json
{
  "tierId": "same-tier-id"
}
```

Backend behavior:

- Does not create duplicate active subscription.
- Reuses existing incomplete Stripe subscription.
- Returns retryable client secret.

---

## 5. Vendor subscription statuses

Backend statuses:

| Status | Meaning | Paid features |
|---|---|---|
| `INACTIVE` | No paid subscription | Blocked |
| `INCOMPLETE` | Payment/setup started but not completed | Blocked |
| `TRIALING` | Trial active | Unlocked |
| `ACTIVE` | Subscription active | Unlocked |
| `PAST_DUE` | Payment failed / invoice unpaid | Blocked |
| `UNPAID` | Stripe marked unpaid | Blocked |
| `CANCELED` | Subscription canceled | Blocked |

Feature unlock rule:

```txt
TRIALING or ACTIVE = paid features unlocked
anything else = paid features blocked
```

Free tier is active for free listing only, but it does not unlock paid features.

---

## 6. Stripe webhook-backed subscription status updates

Backend webhook:

```http
POST /api/v1/payments/webhooks/stripe
```

Flutter does not call this endpoint.

Backend handles:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `setup_intent.succeeded`
- `setup_intent.setup_failed`
- `setup_intent.canceled`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

Backend updates:

- `vendors.subscriptionStatus`
- `vendors.activeSubscriptionTierId`
- `vendor_subscriptions.status`
- `vendor_subscriptions.currentPeriodEnd`
- `vendor_subscriptions.canceledAt`

---

## 7. Founding member logic

Founding offer config is returned from:

```http
GET /api/v1/vendors/plans
```

Current backend default:

```txt
Founding window: August 5, 2026 – October 4, 2026
Official launch: October 5, 2026
Paid plans: 3 months free trial
Founding subscription discount: 50% after trial for configured period
Founding commission rates locked forever
```

Admin can control founding offer:

```http
GET   /api/v1/admin/vendor-founding-offer
PATCH /api/v1/admin/vendor-founding-offer
```

Admin can manually mark/unmark vendor founding:

```http
PATCH /api/v1/admin/vendors/:vendorId/founding-member
```

Flutter normally reads founding display data from `GET /api/v1/vendors/plans`.

---

## 8. Admin subscription tier APIs

These are admin-side APIs, not vendor app APIs unless Flutter is building admin UI too.

### List tiers

```http
GET /api/v1/admin/vendor-subscription-tiers
```

Optional:

```http
GET /api/v1/admin/vendor-subscription-tiers?includeInactive=true
```

### Create tier

```http
POST /api/v1/admin/vendor-subscription-tiers
```

Request:

```json
{
  "code": "GROWTH",
  "name": "Growth",
  "subtitle": "Growth plan",
  "monthlyPriceCents": 2900,
  "foundingMonthlyPriceCentsAfterTrial": 1450,
  "normalCommissionRate": 0.1,
  "foundingCommissionRate": 0.08,
  "bookingEnabled": true,
  "maxStaffAccounts": 3,
  "maxIncludedTrucks": 2,
  "additionalTruckMonthlyPriceCents": 1500,
  "analyticsLevel": "FULL",
  "sortOrder": 40,
  "trialDays": 90,
  "features": {
    "eventBookings": true,
    "staffAccounts": 3,
    "analytics": "FULL"
  },
  "included": ["Event bookings", "3 staff accounts", "Full analytics"],
  "notIncluded": ["Priority support"]
}
```

Backend internally creates Stripe Product/Price. Admin does not send Stripe IDs.

### Update tier

```http
PATCH /api/v1/admin/vendor-subscription-tiers/:tierId
```

If `monthlyPriceCents` changes:

- backend creates a new internal Stripe price;
- backend archives old internal Stripe price;
- future subscriptions use the new price.

### Disable tier

```http
DELETE /api/v1/admin/vendor-subscription-tiers/:tierId
```

This is soft delete/disable:

- `active=false`
- `deletedAt` set
- backend archives internal Stripe product/price
- existing subscriptions are not hard deleted

---

## 9. Vendor payout setup APIs

Subscription payment and payout bank setup are separate.

Vendor subscription payment:

```txt
Vendor pays platform subscription by card
```

Vendor payout setup:

```txt
Vendor connects bank account through Stripe Connect
```

### Create or continue Stripe Connect onboarding

```http
POST /api/v1/payments/connect/accounts
```

Auth: Vendor.

Request:

```json
{
  "refreshUrl": "https://app.example.com/vendor/onboarding/refresh",
  "returnUrl": "https://app.example.com/vendor/onboarding/return",
  "country": "US"
}
```

Response:

```json
{
  "paymentAccount": {
    "stripeAccountId": "acct_xxx",
    "onboardingCompleted": false,
    "chargesEnabled": false,
    "payoutsEnabled": false
  },
  "onboardingUrl": "https://connect.stripe.com/setup/..."
}
```

### Get vendor Connect account status

```http
GET /api/v1/payments/connect/account
```

Auth: Vendor.

Vendor payout setup is ready only when:

```txt
onboardingCompleted = true
chargesEnabled = true
payoutsEnabled = true
```

---

## 10. Booking payment APIs

Customer booking payment is separate from vendor subscription.

### Create booking payment intent

```http
POST /api/v1/payments/bookings/:bookingId/payment-intent
```

Auth: Customer.

Request:

```json
{
  "idempotencyKey": "booking-payment-unique-key",
  "currency": "USD"
}
```

Backend behavior:

- validates booking belongs to customer;
- validates booking is payment-ready;
- prevents duplicate/in-progress payment;
- creates Stripe PaymentIntent;
- stores payment record;
- returns `clientSecret`.

Success response:

```json
{
  "payment": {
    "id": "payment-uuid",
    "bookingId": "booking-uuid",
    "status": "PROCESSING",
    "amount": "240.00",
    "currency": "USD"
  },
  "clientSecret": "pi_xxx_secret_xxx"
}
```

### Get payment

```http
GET /api/v1/payments/:paymentId
```

Auth: Customer or owning vendor.

### Vendor refund

```http
POST /api/v1/payments/:paymentId/refunds
```

Auth: Vendor.

---

## 11. Booking payment statuses

| Status | Meaning |
|---|---|
| `PENDING` | Backend payment record created |
| `PROCESSING` | Stripe PaymentIntent created / awaiting confirmation |
| `SUCCEEDED` | Payment succeeded |
| `FAILED` | Payment failed |
| `CANCELLED` | Payment canceled |
| `REFUNDED` | Fully refunded |
| `PARTIALLY_REFUNDED` | Partial refund completed |

Stripe webhook updates booking payment status.

---

## 12. Payout status

After booking completion approval, backend releases vendor payout through Stripe transfer.

| Status | Meaning |
|---|---|
| `PENDING` | Payout record created, not released |
| `PROCESSING` | Transfer started |
| `PAID` | Transfer succeeded |
| `FAILED` | Transfer failed |
| `CANCELLED` | Payout canceled, usually due to refund/admin issue resolution |

Vendor payout list:

```http
GET /api/v1/payments/payouts/mine
```

Auth: Vendor.

---

## 13. Feature access by subscription tier

Backend enforces paid features using active subscription tier.

Examples:

Free tier blocks:

- event booking quotes;
- staff accounts;
- vendor analytics;
- promotions/drops;
- rewards/QR redemption;
- community booking requests;
- multiple truck listings.

Paid tier still blocks paid features unless:

```txt
subscriptionStatus = TRIALING
or
subscriptionStatus = ACTIVE
```

Common blocked response:

```json
{
  "statusCode": 403,
  "message": "Starter plan is not active yet. Complete your subscription payment to unlock this feature.",
  "error": "Forbidden"
}
```

---

## 14. Main Flutter-facing sequence

```txt
1. GET /api/v1/vendors/plans
2. User selects paid tier
3. POST /api/v1/payments/vendors/me/subscription-intent with tierId
4. Backend returns customerId, ephemeral key, subscriptionId, clientSecret
5. Flutter confirms native Stripe setup/payment using its own publishable key
6. Stripe sends webhook to backend
7. Backend updates subscription status
8. Flutter refreshes vendor profile or relevant screen
9. Paid features become available when status is TRIALING or ACTIVE
```

Vendor profile:

```http
GET /api/v1/vendors/me
```

Useful fields:

```txt
activeSubscriptionTierId
activeSubscriptionTier
subscriptionStatus
stripeCustomerId
stripeSubscriptionId
subscriptions
isFoundingMember
lockedCommissionRate
trialEndsAt
foundingDiscountEndsAt
```

