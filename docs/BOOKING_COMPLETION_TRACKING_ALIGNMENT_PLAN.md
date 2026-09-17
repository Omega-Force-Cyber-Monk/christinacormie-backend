# Booking Completion & Tracking Status Alignment Plan

This document is for aligning the booking/order tracking flow before implementation.

Scope:

- Customer “Track order” page
- Vendor “My Orders / Booking timeline” page
- Completion request
- Customer approval
- Issue reporting
- Payment release after customer approval
- Admin booking-management message thread for reported issues

---

## 1. Final Product Flow

### Customer timeline

1. Booking confirmed
2. Deposit
3. Event day
4. Request Pending
5. Payment released

### Vendor timeline

1. Booking confirmed
2. Deposit
3. Event day
4. Completion request sent
5. Completed

---

## 2. Business Logic We Agreed

Vendor sends quotation.

Customer accepts quotation.

Customer pays the initial required payment / deposit.

After deposit payment succeeds:

- Customer timeline:
  - Booking confirmed = active/done
  - Deposit = active/done
- Vendor timeline:
  - Booking confirmed = active/done
  - Deposit = active/done

On event day:

- Both customer and vendor timeline show Event day as active.

After the event:

- Vendor sends completion request.
- Customer sees “Requested for completion”.
- Customer timeline shows Request Pending.
- Vendor timeline shows Completion request sent.

Then customer has two choices:

- Approve
- Report an issue

If customer approves:

- Booking becomes completed.
- Customer timeline shows Payment released.
- Vendor timeline shows Completed.
- Vendor payment is released.

If customer reports issue:

- Completion stays pending/disputed.
- Payment is not released yet.
- A normal message/thread is created under booking management.
- Admin can see the message from booking management.
- Socket.IO is not needed for this issue flow.
- Admin can reply with normal HTTP message APIs.

---

## 3. Current Implementation Status

### Already exists

Booking APIs:

```http
GET /api/v1/bookings/mine
GET /api/v1/bookings/vendor/mine
GET /api/v1/bookings/:bookingId
POST /api/v1/bookings
POST /api/v1/bookings/:bookingId/quotes
PATCH /api/v1/bookings/quotes/:quoteId/accept
```

Community offer APIs:

```http
GET /api/v1/community/posts/mine
GET /api/v1/community/requests/:requestId/offers
PATCH /api/v1/community/offers/:offerId/accept
```

Payment APIs:

```http
POST /api/v1/payments/bookings/:bookingId/payment-intent
GET /api/v1/payments/:paymentId
GET /api/v1/payments/payouts/mine
```

Current booking status enum already has:

```ts
PENDING
QUOTED
ACCEPTED
PAYMENT_PENDING
CONFIRMED
IN_PROGRESS
COMPLETED
CANCELLED
REJECTED
EXPIRED
```

### Partially exists

| Requirement | Current state |
|---|---|
| Booking details page | `GET /api/v1/bookings/:bookingId` exists |
| Quote breakdown | Booking details include `quotes` / `vendorOffer` |
| Booking confirmed | Payment success changes booking to `CONFIRMED` |
| Status history | `statusHistory` exists |
| Deposit paid | Payment exists, but booking details response does not clearly expose deposit/payment timeline |
| Event day | Can be derived from `startsAt`, but no explicit event-day state |

### Missing

| Missing item | Why needed |
|---|---|
| Vendor completion request API | Vendor needs to request job completion |
| Customer approve completion API | Customer needs to release payment |
| Customer report issue API | Customer needs to stop release if problem exists |
| Admin booking issue messages | Admin needs to see customer/vendor messages inside booking management |
| Dedicated tracking API | Frontend needs clear 5-step timeline without guessing |
| Completion request fields | Need to store request status and dates |
| Payment release fields | Need to know when vendor payout was released |
| Real hold-until-completion payment logic | Current payment flow is not fully aligned with “release after approval” |

---

## 4. Important Payment Alignment

Product requirement:

> Customer deposit/payment should stay held until the order is completed. Vendor should receive the releasable amount only after customer approves completion.

Current backend payment flow:

- Customer pays deposit.
- Payment succeeds.
- Booking becomes `CONFIRMED`.
- Payout record is created as `PENDING`.

Potential issue:

- Current Stripe implementation uses destination-style payment behavior.
- If Stripe transfer happens immediately after payment success, it does not fully match “hold until customer approval”.

Needed payment behavior:

1. Customer pays deposit to platform.
2. Backend stores payment as `SUCCEEDED`.
3. Backend keeps vendor payout as `PENDING`.
4. Customer approves completion.
5. Backend releases vendor payout.
6. Booking becomes `COMPLETED`.
7. Timeline updates.

Implementation note:

- We should update payment logic carefully.
- The safer implementation direction is platform charge first, then vendor transfer later after approval.
- Before coding payment release, confirm final Stripe Connect approach.

---

## 5. Proposed Backend Data Changes

### Option A — minimal fields on `Booking`

Add fields:

```ts
completionRequestedAt DateTime?
completionRequestedById String?
completionApprovedAt DateTime?
completionApprovedById String?
paymentReleasedAt DateTime?
completionIssueReportedAt DateTime?
completionIssueReason String?
```

Pros:

- Simple.
- Enough for current UI.

Cons:

- Only supports one issue report.
- Less flexible if admin dispute workflow comes later.

### Option B — recommended

Add fields on `Booking`:

```ts
completionRequestedAt DateTime?
completionRequestedById String?
completionApprovedAt DateTime?
completionApprovedById String?
paymentReleasedAt DateTime?
```

Add separate issue table:

```ts
BookingIssue {
  id
  bookingId
  reportedById
  message
  status // OPEN, RESOLVED, DISMISSED
  createdAt
  resolvedAt
}
```

Add normal booking issue message table:

```ts
BookingIssueMessage {
  id
  issueId
  senderId
  senderRole // CUSTOMER, VENDOR, ADMIN
  message
  createdAt
  readAt
}
```

Pros:

- Clean.
- Supports issue history.
- Better for admin/support later.
- Does not require Socket.IO.
- Admin can load and reply through booking management panel.

Cons:

- Slightly more work.

Recommendation:

Use Option B. It is still simple and avoids messy future changes.

---

## 6. Proposed APIs

### 6.1 Get tracking timeline

```http
GET /api/v1/bookings/:bookingId/tracking
```

Use:

- Customer Track order page
- Vendor My Orders page

Response idea:

```json
{
  "bookingId": "booking-id",
  "roleView": "CUSTOMER",
  "currentStep": "EVENT_DAY",
  "completion": {
    "requestedAt": null,
    "approvedAt": null,
    "paymentReleasedAt": null,
    "hasOpenIssue": false
  },
  "steps": [
    {
      "key": "BOOKING_CONFIRMED",
      "label": "Booking confirmed",
      "status": "DONE",
      "completedAt": "2026-09-10T10:00:00.000Z"
    },
    {
      "key": "DEPOSIT",
      "label": "Deposit",
      "status": "DONE",
      "completedAt": "2026-09-10T10:03:00.000Z"
    },
    {
      "key": "EVENT_DAY",
      "label": "Event day",
      "status": "CURRENT",
      "completedAt": null
    },
    {
      "key": "REQUEST_PENDING",
      "label": "Request Pending",
      "status": "PENDING",
      "completedAt": null
    },
    {
      "key": "PAYMENT_RELEASED",
      "label": "Payment released",
      "status": "PENDING",
      "completedAt": null
    }
  ]
}
```

For vendor, same API can return vendor labels:

```json
{
  "roleView": "VENDOR",
  "steps": [
    { "key": "BOOKING_CONFIRMED", "label": "Booking confirmed", "status": "DONE" },
    { "key": "DEPOSIT", "label": "Deposit", "status": "DONE" },
    { "key": "EVENT_DAY", "label": "Event day", "status": "CURRENT" },
    { "key": "COMPLETION_REQUEST_SENT", "label": "Completion request sent", "status": "PENDING" },
    { "key": "COMPLETED", "label": "Completed", "status": "PENDING" }
  ]
}
```

### 6.2 Vendor request completion

```http
PATCH /api/v1/bookings/:bookingId/request-completion
```

Allowed:

- Vendor who owns the booking.

Rules:

- Booking must be `CONFIRMED` or `IN_PROGRESS`.
- Event day/time should have started or passed.
- Completion request cannot already exist.
- No open issue should exist.

Effect:

- Set `completionRequestedAt`.
- Set `completionRequestedById`.
- Add booking status history reason: `Completion requested`.
- Notify customer.

### 6.3 Customer approve completion

```http
PATCH /api/v1/bookings/:bookingId/approve-completion
```

Allowed:

- Customer who owns the booking.

Rules:

- Completion request must exist.
- No open issue should block approval.
- Booking should not already be completed.

Effect:

- Set `completionApprovedAt`.
- Set `completionApprovedById`.
- Set booking status to `COMPLETED`.
- Set `completedAt`.
- Release vendor payment/payout.
- Set `paymentReleasedAt`.
- Add booking status history.
- Notify vendor.

### 6.4 Customer report issue

```http
POST /api/v1/bookings/:bookingId/issues
```

Body:

```json
{
  "message": "Vendor did not complete the agreed service."
}
```

Allowed:

- Customer who owns the booking.

Rules:

- Completion request should exist.
- Booking should not already be completed.

Effect:

- Create `BookingIssue`.
- Create first `BookingIssueMessage` with the customer message.
- Keep payment/payout unreleased.
- Make the issue visible in admin booking management.
- Notify admin/support if notification is needed.

### 6.5 List booking issue messages

```http
GET /api/v1/bookings/:bookingId/issues/:issueId/messages
```

Allowed:

- Booking customer
- Booking vendor
- Admin

Use:

- Admin opens “Message with Sarah Chen” or “Message with vendor”.
- Customer/vendor can also see their issue conversation if frontend needs it.

Response idea:

```json
{
  "issue": {
    "id": "issue-id",
    "bookingId": "booking-id",
    "status": "OPEN"
  },
  "messages": [
    {
      "id": "message-id",
      "senderRole": "CUSTOMER",
      "senderName": "Sarah Chen",
      "message": "Hi, I have a question about my booking.",
      "createdAt": "2026-05-23T10:30:00.000Z"
    },
    {
      "id": "message-id-2",
      "senderRole": "ADMIN",
      "senderName": "Admin",
      "message": "Hello! I'd be happy to help.",
      "createdAt": "2026-05-23T10:35:00.000Z"
    }
  ]
}
```

### 6.6 Send booking issue message

```http
POST /api/v1/bookings/:bookingId/issues/:issueId/messages
```

Body:

```json
{
  "message": "I can't reach my client."
}
```

Allowed:

- Booking customer
- Booking vendor
- Admin

Effect:

- Creates a normal DB message.
- No Socket.IO required.
- Admin booking management can refresh/load messages normally.

### 6.7 Admin resolve issue

```http
PATCH /api/v1/admin/bookings/:bookingId/issues/:issueId/resolve
```

Allowed:

- Admin only.

Effect:

- Mark issue `RESOLVED`.
- The frontend can show “Issue resolved”.
- This does not automatically release payment unless we decide it should.

---

## 7. Timeline State Mapping

### Customer mapping

| UI Step | Backend condition |
|---|---|
| Booking confirmed | booking.status is `CONFIRMED`, `IN_PROGRESS`, or `COMPLETED` |
| Deposit | deposit payment status is `SUCCEEDED` |
| Event day | current time >= booking.startsAt |
| Request Pending | completionRequestedAt exists and completionApprovedAt is null |
| Payment released | paymentReleasedAt exists |

### Vendor mapping

| UI Step | Backend condition |
|---|---|
| Booking confirmed | booking.status is `CONFIRMED`, `IN_PROGRESS`, or `COMPLETED` |
| Deposit | deposit payment status is `SUCCEEDED` |
| Event day | current time >= booking.startsAt |
| Completion request sent | completionRequestedAt exists |
| Completed | booking.status is `COMPLETED` |

---

## 8. Track Order Page Data Source

The page needs two API calls or one combined response.

### Current possible approach

```http
GET /api/v1/bookings/:bookingId
GET /api/v1/bookings/:bookingId/tracking
```

`GET /bookings/:bookingId` gives:

- customer/vendor/truck
- event date/time
- location
- guest count
- quote breakdown
- selected menu items
- status history

`GET /bookings/:bookingId/tracking` gives:

- clean timeline
- role-specific labels
- completion request state
- issue state
- payment release state

### Better future approach

Add `tracking` object inside booking details response.

But for frontend simplicity and backend clarity, separate tracking API is cleaner.

---

## 9. Open Decisions Before Coding

Need final confirmation:

1. Should vendor be allowed to request completion only after event start time?

Recommended: yes.

2. If customer does not approve after X hours/days, should payment auto-release?

Current decision: not now.

3. Should issue report notify admin/support immediately?

Current decision: issue should be visible from admin booking management. Push/email notification can be optional.

4. Should payment release be real Stripe transfer at approval time?

Recommended: yes, if product requires hold-until-completion.

5. Should timeline be returned role-wise from one API?

Recommended: yes.

6. Should issue messages use Socket.IO?

Decision: no. Normal HTTP message APIs are enough for this booking-management issue flow.

7. Should admin resolving an issue auto-release payment?

Current decision: not confirmed. Safer default: no automatic release. Customer approve or a separate admin action should release payment.

---

## 10. Final Implementation Order

Do implementation in this order:

1. Add Prisma fields/table for completion and issues.
2. Add booking issue message table.
3. Update booking details/admin booking details include issue summary/unread count if needed.
4. Add tracking timeline service method.
5. Add `GET /bookings/:bookingId/tracking`.
6. Add vendor request completion API.
7. Add customer approve completion API.
8. Add customer report issue API.
9. Add issue message list/send APIs.
10. Add admin resolve issue API.
11. Update payment release/payout logic.
12. Add Swagger examples and proper error messages.
13. Add manual testing docs.
11. Run:

```bash
npx prisma validate --schema prisma/schema
npx prisma generate --schema prisma/schema
npm run build
npm test -- --runInBand
```

Migration rule:

```bash
npx prisma migrate deploy --schema prisma/schema
```

Never run on shared/production DB:

```bash
npx prisma migrate reset
```
