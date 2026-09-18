# System Payment & Escrow Payout — Manual API Testing Flow

This document provides a step-by-step manual testing guide for the complete Stripe payment and escrow payout lifecycle implemented according to [systempaymentimplementationplan.md](file:///Users/softvence/arif/project/christinacormie-backend/implementation%20plan/systempaymentimplementationplan.md).

---

## 1. Overview & Architecture Summary

* **Escrow Architecture**:
  1. Customer pays upfront $\rightarrow$ Platform main Stripe balance receives and holds 100% of the funds.
  2. Funds stay in escrow on the platform account while the booking is `CONFIRMED`.
  3. Platform keeps its commission (e.g. 15% or 20%).
  4. Vendor payout remains `PENDING`.
  5. Upon completion approval (or Admin resolution in vendor favor), platform initiates a **Stripe Transfer** of vendor net earnings to the vendor's Stripe Connected account.
  6. If disputed and resolved in customer favor, platform initiates a **Stripe Refund** back to the customer's original card, and the vendor payout is cancelled.

---

## 2. Environment & Prerequisites

### Base URL
```text
http://localhost:3000
```

### Swagger Documentation
```text
http://localhost:3000/api/v1/docs
```

### Required Test Roles & Tokens
You will need 3 accounts:
1. **Admin User**:
   * Token: `{{adminToken}}` (Role: `ADMIN`)
2. **Vendor User**:
   * Token: `{{vendorToken}}` (Role: `VENDOR`, must have an approved vendor profile `vendor.status = 'APPROVED'`)
3. **Customer User**:
   * Token: `{{customerToken}}` (Role: `CUSTOMER`)

---

## 3. Step-by-Step API Testing Flow

---

### Step 1: Vendor Stripe Connect Onboarding (Vendor)

Before any customer payment can be accepted for a vendor, the vendor must connect Stripe for payouts.

#### 1.1 Initiate Stripe Connect Account
* **Method**: `POST`
* **URL**: `/api/v1/payments/connect/accounts`
* **Headers**:
  * `Authorization: Bearer {{vendorToken}}`
  * `Content-Type: application/json`
* **Body**:
  ```json
  {
    "country": "US",
    "refreshUrl": "http://localhost:3000/vendor/stripe/refresh",
    "returnUrl": "http://localhost:3000/vendor/stripe/return"
  }
  ```
* **Expected Response (201 Created)**:
  ```json
  {
    "paymentAccount": {
      "id": "e5b6c7d8-...",
      "vendorId": "12441f40-...",
      "stripeAccountId": "acct_1Qxxxxxx",
      "onboardingCompleted": false,
      "chargesEnabled": false,
      "payoutsEnabled": false,
      "disabledReason": null
    },
    "onboardingUrl": "https://connect.stripe.com/setup/s/..."
  }
  ```

#### 1.2 Check Vendor Payment Account Status
* **Method**: `GET`
* **URL**: `/api/v1/payments/connect/account`
* **Headers**:
  * `Authorization: Bearer {{vendorToken}}`
* **Expected Response (200 OK)**:
  ```json
  {
    "id": "e5b6c7d8-...",
    "vendorId": "12441f40-...",
    "stripeAccountId": "acct_1Qxxxxxx",
    "onboardingCompleted": true,
    "chargesEnabled": true,
    "payoutsEnabled": true,
    "disabledReason": null
  }
  ```
> [!NOTE]
> For local testing without opening the Stripe web URL:
> In your local database or via Stripe webhook `account.updated`, ensure `onboardingCompleted = true`, `chargesEnabled = true`, and `payoutsEnabled = true`.

---

### Step 2: Booking Request & Quote Acceptance

#### 2.1 Customer Creates Booking Request
* **Method**: `POST`
* **URL**: `/api/v1/bookings`
* **Headers**:
  * `Authorization: Bearer {{customerToken}}`
  * `Content-Type: application/json`
* **Body**:
  ```json
  {
    "foodTruckId": "{{foodTruckId}}",
    "bookingType": "EVENT",
    "eventType": "CORPORATE",
    "eventName": "Company Anniversary Party",
    "eventDescription": "Taco catering for staff celebration",
    "startsAt": "2026-11-20T18:00:00.000Z",
    "endsAt": "2026-11-20T21:00:00.000Z",
    "guestCount": 60,
    "address": "500 E 4th St, Austin, TX 78701",
    "contactPhone": "+12025550143",
    "budgetAmount": 1000,
    "paymentPreference": "DEPOSIT_ONLY"
  }
  ```
* **Expected Response (201 Created)**:
  * Returns `booking` with `status: "REQUESTED"`. Note down `booking.id` as `{{bookingId}}`.

#### 2.2 Vendor Submits Custom Quote
* **Method**: `POST`
* **URL**: `/api/v1/bookings/{{bookingId}}/quotes`
* **Headers**:
  * `Authorization: Bearer {{vendorToken}}`
  * `Content-Type: application/json`
* **Body**:
  ```json
  {
    "pricingModel": "FLAT_FEE",
    "baseServiceFee": 1000,
    "transportFee": 50,
    "paymentPreference": "DEPOSIT_ONLY",
    "depositPercent": 25,
    "depositAmount": 262.50,
    "message": "Full catering setup with 3 taco selections."
  }
  ```
* **Expected Response (201 Created)**:
  * Returns `quote` with `status: "PENDING"`. Note down `quote.id` as `{{quoteId}}`.
  * `booking.status` becomes `"QUOTED"`.

#### 2.3 Customer Accepts Quote
* **Method**: `PATCH`
* **URL**: `/api/v1/bookings/{{bookingId}}/quotes/{{quoteId}}/accept`
* **Headers**:
  * `Authorization: Bearer {{customerToken}}`
* **Expected Response (200 OK)**:
  * Booking transitions to `status: "PAYMENT_PENDING"`.
  * Now customer can make deposit payment.

---

### Step 3: Customer Payment Intent (Upfront Deposit)

#### 3.1 Customer Initiates Payment
* **Method**: `POST`
* **URL**: `/api/v1/payments/bookings/{{bookingId}}/payment-intent`
* **Headers**:
  * `Authorization: Bearer {{customerToken}}`
  * `Content-Type: application/json`
* **Body**:
  ```json
  {
    "currency": "USD",
    "idempotencyKey": "pay-test-booking-{{bookingId}}-001"
  }
  ```

#### Safety Validations Checked Automatically:
1. If Vendor Stripe Connect is missing or incomplete:
   * **Returns 400 Bad Request**:
     `"Vendor payout setup is incomplete. The vendor must connect Stripe before customer payment can be accepted."`
2. If Booking is not `PAYMENT_PENDING`:
   * **Returns 400 Bad Request**: `"Booking is not ready for payment"`

#### Expected Success Response (201 Created):
```json
{
  "payment": {
    "id": "{{paymentId}}",
    "bookingId": "{{bookingId}}",
    "payerUserId": "{{customerId}}",
    "vendorId": "{{vendorId}}",
    "amount": "262.50",
    "currency": "USD",
    "status": "PROCESSING",
    "stripePaymentIntentId": "pi_3Qxxxxxx",
    "createdAt": "2026-09-18T11:00:00.000Z"
  },
  "clientSecret": "pi_3Qxxxxxx_secret_yyyy"
}
```
> [!IMPORTANT]
> The PaymentIntent is created directly under the **Platform's main Stripe account**. No money is sent directly to the vendor at this stage.

---

### Step 4: Stripe Payment Success Webhook

When customer card payment completes successfully, Stripe dispatches a webhook to the platform.

#### 4.1 Triggering the Webhook
* **Method**: `POST`
* **URL**: `/api/v1/payments/webhooks/stripe`
* **Headers**:
  * `stripe-signature: <Stripe-Signature-Header>`
  * `Content-Type: application/json`
* **Via Stripe CLI (Recommended)**:
  ```bash
  stripe trigger payment_intent.succeeded
  ```
  *(Or trigger webhook event matching `stripePaymentIntentId`)*

#### Backend State Changes After Webhook:
1. `Payment.status` becomes **`SUCCEEDED`**.
2. `Booking.status` becomes **`CONFIRMED`**.
3. `Commission` record created:
   * Platform calculates commission (e.g. 20% = $52.50) and vendor net amount ($210.00).
4. `Payout` record created:
   * `Payout.status`: **`PENDING`** (amount = $210.00).
   * Funds stay held in platform Stripe escrow balance.

---

### Step 5: Completion & Payout Release (Happy Path)

#### 5.1 Vendor Requests Booking Completion
* **Method**: `PATCH`
* **URL**: `/api/v1/bookings/{{bookingId}}/request-completion`
* **Headers**:
  * `Authorization: Bearer {{vendorToken}}`
* **Expected Response (200 OK)**:
  * Booking sets `completionRequestedAt` timestamp and `completionRequestedById`.
  * Customer receives notification to approve completion or report an issue.

#### 5.2 Customer Approves Completion
* **Method**: `PATCH`
* **URL**: `/api/v1/bookings/{{bookingId}}/approve-completion`
* **Headers**:
  * `Authorization: Bearer {{customerToken}}`
* **Backend Execution**:
  1. Backend executes **Stripe Transfer** (`stripe.transfers.create`):
     * Platform Stripe balance $\rightarrow$ Vendor Connected Account (`stripeAccountId`).
  2. `Payout.status` becomes **`PAID`** with `stripeTransferId`.
  3. `Booking.status` becomes **`COMPLETED`**.
  4. `Booking.paymentReleasedAt` is timestamped.
* **Expected Response (200 OK)**:
  ```json
  {
    "message": "Booking completed and payment released successfully",
    "booking": {
      "id": "{{bookingId}}",
      "status": "COMPLETED",
      "paymentReleasedAt": "2026-09-18T11:15:00.000Z"
    }
  }
  ```

---

### Step 6: Dispute / Issue Reporting Flow (Dispute Path)

If the event had problems, customer reports an issue instead of approving completion.

#### 6.1 Customer Reports an Issue
* **Method**: `POST`
* **URL**: `/api/v1/bookings/{{bookingId}}/issues`
* **Headers**:
  * `Authorization: Bearer {{customerToken}}`
  * `Content-Type: application/json`
* **Body**:
  ```json
  {
    "message": "Vendor did not bring the requested equipment and arrived 1 hour late."
  }
  ```
* **Expected Response (201 Created)**:
  * Issue created with `status: "OPEN"`. Note down `issue.id` as `{{issueId}}`.
  * `Payout` is frozen in `PENDING` state.
  * Customer completion approval is blocked (`409 Conflict`).

#### 6.2 Issue Chat / Messaging (Optional)
* **Post message**: `POST /api/v1/bookings/{{bookingId}}/issues/{{issueId}}/messages`
  * **Headers**: `Authorization: Bearer {{vendorToken}}` (or customer / admin)
  * **Body**: `{"message": "We offered additional desserts as compensation at the venue."}`
* **List messages**: `GET /api/v1/bookings/{{bookingId}}/issues/{{issueId}}/messages`

---

### Step 7: Admin Issue Resolution Decisions

Admin investigates the dispute and resolves it with one of two supported decisions:

#### Option A: Admin Resolves in Vendor Favor (`RELEASE_PAYOUT`)
* **Method**: `PATCH`
* **URL**: `/api/v1/admin/bookings/{{bookingId}}/issues/{{issueId}}/resolve`
* **Headers**:
  * `Authorization: Bearer {{adminToken}}`
  * `Content-Type: application/json`
* **Body**:
  ```json
  {
    "decision": "RELEASE_PAYOUT",
    "resolutionNote": "Evidence shows vendor completed the catering as agreed. Payout released."
  }
  ```
* **Result**:
  * Releases Stripe Transfer to Vendor Connected Account.
  * `Payout.status`: **`PAID`**.
  * `Booking.status`: **`COMPLETED`**.
  * `Issue.status`: **`RESOLVED`**.

---

#### Option B: Admin Resolves in Customer Favor (`FULL_REFUND`)
* **Method**: `PATCH`
* **URL**: `/api/v1/admin/bookings/{{bookingId}}/issues/{{issueId}}/resolve`
* **Headers**:
  * `Authorization: Bearer {{adminToken}}`
  * `Content-Type: application/json`
* **Body**:
  ```json
  {
    "decision": "FULL_REFUND",
    "resolutionNote": "Customer complaint verified. Full refund authorized."
  }
  ```
* **Result**:
  * Calls Stripe Refund API on original `PaymentIntent`.
  * Refund is returned to customer original payment method.
  * `Payout.status`: **`CANCELLED`** (no transfer to vendor).
  * `Booking.status`: **`CANCELLED`**.
  * `Issue.status`: **`RESOLVED`**.

---

### Step 8: Admin Retry Failed Payout (Error Recovery)

If a Stripe Transfer failed (e.g. temporary Stripe API outage or connected account requirement error):

* **Method**: `POST`
* **URL**: `/api/v1/admin/payouts/{{payoutId}}/retry`
* **Headers**:
  * `Authorization: Bearer {{adminToken}}`
* **Rules**:
  * Only payouts in `FAILED` status can be retried.
  * Vendor Stripe Connected account must be active (`payoutsEnabled: true`).
  * Uses idempotency key `booking-payout-{{bookingId}}` to prevent duplicate transfers.
* **Expected Response (200 OK)**:
  * Payout status updated to `PAID` with new `stripeTransferId`.

---

## 4. Quick Verification Checklist

| Step | Action | Method & Path | Expected Status |
| :--- | :--- | :--- | :--- |
| 1 | Vendor Stripe Connect | `POST /api/v1/payments/connect/accounts` | 201 Created |
| 2 | Check Vendor Payout Ready | `GET /api/v1/payments/connect/account` | 200 OK (`payoutsEnabled: true`) |
| 3 | Create Booking | `POST /api/v1/bookings` | 201 Created (`REQUESTED`) |
| 4 | Submit Quote | `POST /api/v1/bookings/:id/quotes` | 201 Created (`QUOTED`) |
| 5 | Accept Quote | `PATCH /api/v1/bookings/:id/quotes/:qid/accept` | 200 OK (`PAYMENT_PENDING`) |
| 6 | Create PaymentIntent | `POST /api/v1/payments/bookings/:id/payment-intent` | 201 Created (`PROCESSING`) |
| 7 | Payment Webhook | `POST /api/v1/payments/webhooks/stripe` | 200 OK (`CONFIRMED`, Payout `PENDING`) |
| 8a | Request Completion | `PATCH /api/v1/bookings/:id/request-completion` | 200 OK (`completionRequestedAt`) |
| 8b | Approve Completion | `PATCH /api/v1/bookings/:id/approve-completion` | 200 OK (`COMPLETED`, Payout `PAID`) |
| 9 | Report Issue (Dispute) | `POST /api/v1/bookings/:id/issues` | 201 Created (`OPEN`, Payout held) |
| 10a | Admin Resolve (Vendor Favor) | `PATCH /api/v1/admin/bookings/:id/issues/:iid/resolve` | 200 OK (`RELEASE_PAYOUT`) |
| 10b | Admin Resolve (Customer Favor) | `PATCH /api/v1/admin/bookings/:id/issues/:iid/resolve` | 200 OK (`FULL_REFUND`) |
| 11 | Admin Retry Payout | `POST /api/v1/admin/payouts/:id/retry` | 200 OK (`PAID`) |
