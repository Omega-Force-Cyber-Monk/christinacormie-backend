# BiteDrop — E2E Testing Feature List & Roadmap

This document outlines the complete list of features, topics, and end-to-end (E2E) test steps for the BiteDrop backend. Each feature represents an isolated E2E test suite (`test/<feature>.e2e-spec.ts`).

---

## 📋 Core Feature List (High-Level Topics)

1. **Auth & Identity** (`auth`)
2. **Vendor Staff Management & Permissions** (`staff`)
3. **Food Trucks & Location Drops** (`food-trucks`)
4. **Direct Profile Booking Flow** (`bookings-direct`)
5. **Community Event Requests & Offers** (`community`)
6. **Smart QR Check-In, Loyalty & Rewards** (`check-ins-rewards`)
7. **Payments, Stripe & Subscriptions** (`payments`)
8. **In-App Messaging & Real-Time Chat** (`messaging`)
9. **Notifications & Push Delivery** (`notifications`)
10. **Social Feed & Engagements** (`social`)
11. **Reviews & Ratings** (`reviews`)
12. **Admin Verification & Controls** (`admin`)

---

## 🧪 Detailed Feature Test Scenarios & Steps

### 1. Auth & Identity (`test/auth.e2e-spec.ts`)
- **Step 1: Customer Registration** ➔ Registers customer, verifies status is `PENDING`, verifies 6-digit OTP email generated.
- **Step 2: Email Verification** ➔ Submits OTP, verifies status transitions to `ACTIVE`, receives access and refresh tokens.
- **Step 3: Vendor Registration** ➔ Registers vendor with business name and phone, receives OTP.
- **Step 4: Login & Token Refresh** ➔ Logs in with email/password, refreshes access token using refresh token.
- **Step 5: Password Reset Flow** ➔ Requests password reset code, verifies code, sets new password, logs in with new password.

---

### 2. Vendor Staff Management & Permissions (`test/staff.e2e-spec.ts`)
- **Step 1: Vendor Adds Staff** ➔ Vendor owner creates staff with email and 4-digit PIN (`POST /api/v1/vendors/me/staff`).
- **Step 2: Staff PIN Login** ➔ Staff member logs in with email and PIN (`POST /api/v1/auth/staff/login`), receives `VENDOR_STAFF` token.
- **Step 3: Staff Permitted APIs (200 OK)**:
  - `GET /api/v1/vendors/me` (Profile of employer vendor)
  - `GET /api/v1/vendors/me/qr-code` (QR code of food truck)
  - `GET /api/v1/food-trucks/mine` (Lists employer's food trucks)
  - `GET /api/v1/bookings/vendor/mine` (Lists bookings)
  - `GET /api/v1/bookings/vendor/requests/counts` (Badge counts)
  - `POST /api/v1/vendors/me/redemptions/confirm` (Confirms credit redemption)
- **Step 4: Staff Restricted APIs (403 Insufficient permissions)**:
  - Verifies staff cannot delete staff or manage subscriptions (`403`).
- **Step 5: Staff PIN Reset & Deletion** ➔ Vendor owner resets staff PIN, verifies old PIN rejected, deletes staff member.

---

### 3. Food Trucks & Location Drops (`test/food-trucks.e2e-spec.ts`)
- **Step 1: Create Draft Truck Profile** ➔ Vendor creates a new draft truck.
- **Step 2: Setup Menu Categories & Items** ➔ Adds cuisines, menu categories, and dishes with prices.
- **Step 3: Operating Hours & Service Area** ➔ Sets weekly schedule and service radius.
- **Step 4: Live Location Drop** ➔ Publishes a live location drop with GPS coordinates and validity duration.
- **Step 5: Discovery & Search** ➔ Customer searches nearby trucks within radius, filters by cuisine.

---

### 4. Direct Profile Booking Flow (`test/bookings-direct.e2e-spec.ts`)
- **Step 1: Customer Creates Direct Booking** ➔ Customer submits 5-step booking wizard from truck profile (`status: PENDING`, `communityRequestId: null`).
- **Step 2: Vendor List Filtering**:
  - `GET /api/v1/bookings/vendor/mine?tab=REQUESTS&source=DIRECT` returns the pending booking with full customer profile (`displayName`, `avatarUrl`).
  - Verifies no community bookings leak into this tab.
- **Step 3: Vendor Submits Quote** ➔ Vendor sends quotation with base fee, transport fee, and min 20% deposit (`status: QUOTED`).
- **Step 4: Customer Accepts Quote** ➔ Customer accepts quote (`status: PAYMENT_PENDING`).
- **Step 5: Booking Confirmation & Completion** ➔ Transitions to `CONFIRMED` upon deposit payment, vendor requests completion on event day, customer approves.

---

### 5. Community Event Requests & Offers (`test/community.e2e-spec.ts`)
- **Step 1: Customer Posts Event Request** ➔ Customer creates a Need-a-Truck post with date, guest count, budget, and location.
- **Step 2: Vendor Browses Community Feed** ➔ Vendor views `GET /api/v1/community/posts?tab=REQUESTS`.
- **Step 3: Vendor Submits Proposal Offer** ➔ Vendor sends custom quote offer for the community post.
- **Step 4: Customer Accepts Offer** ➔ Customer accepts the vendor's offer (`status: ACCEPTED`).
- **Step 5: Automatic Booking Conversion** ➔ Verifies an underlying `Booking` record is created linking `communityRequestId` and `vendorOfferId`.
- **Step 6: Data Isolation Verification** ➔ Verifies this community booking appears in `?source=COMMUNITY` but is excluded from `?source=DIRECT`.

---

### 6. Smart QR Check-In, Loyalty & Rewards (`test/check-ins-rewards.e2e-spec.ts`)
- **Step 1: Customer QR Scan Check-In** ➔ Customer scans truck QR code with valid GPS coordinates.
- **Step 2: Geofence Validation** ➔ Checks rejection if customer GPS is outside truck radius.
- **Step 3: Cooldown Check** ➔ Checks that scanning again within 12 hours gives `ALREADY_CHECKED_IN_TODAY` and zero points.
- **Step 4: Loyalty Points Accumulation** ➔ Verifies +10 points awarded and tier progress updated.
- **Step 5: Points to BiteDrop Credits Redemption** ➔ Customer generates a redemption voucher for $5.00 credit.
- **Step 6: Vendor/Staff Confirms Redemption** ➔ Staff confirms redemption via `POST /api/v1/vendors/me/redemptions/confirm`.

---

### 7. Payments, Stripe & Subscriptions (`test/payments.e2e-spec.ts`)
- **Step 1: Vendor Subscription Intent** ➔ Vendor selects `STARTER`, `PRO`, or `ELITE` plan, receives Stripe native client secret.
- **Step 2: Subscription Webhook Processing** ➔ Simulates Stripe `customer.subscription.created` webhook, updates DB tier to paid status.
- **Step 3: Booking Payment Intent** ➔ Customer creates payment intent for booking deposit.
- **Step 4: Commission Split Verification** ➔ Verifies 20% platform commission and 80% vendor net allocation.
- **Step 5: Founding Member Rates** ➔ Verifies founding member discount and locked commission rate logic.

---

### 8. In-App Messaging & Real-Time Chat (`test/messaging.e2e-spec.ts`)
- **Step 1: Initiate Conversation** ➔ Customer messages vendor regarding a booking or inquiry.
- **Step 2: Send & Receive Messages** ➔ Vendor responds, verifies unread badge increments.
- **Step 3: Mark Messages Read** ➔ Recipient marks conversation read, badge resets to 0.

---

### 9. Notifications & Push Delivery (`test/notifications.e2e-spec.ts`)
- **Step 1: Register Device Token** ➔ Mobile app registers FCM device token.
- **Step 2: Event Triggers** ➔ Triggers booking request, quote received, offer accepted, reward earned.
- **Step 3: In-App Notification Feed** ➔ Verifies notifications list with correct deep-link payload.

---

### 10. Social Feed & Engagements (`test/social.e2e-spec.ts`)
- **Step 1: Create Social Post** ➔ Customer/Vendor publishes a photo and caption.
- **Step 2: Add 1-Level Comments** ➔ Users comment on post.
- **Step 3: Reactions & Likes** ➔ Users react with emoji reactions.

---

### 11. Reviews & Ratings (`test/reviews.e2e-spec.ts`)
- **Step 1: Submit Post-Booking Review** ➔ Customer submits rating (1-5 stars) and review text after event completion.
- **Step 2: Aggregate Rating Calculation** ➔ Verifies food truck average rating and total review count update.
- **Step 3: Vendor Reply** ➔ Vendor posts a public response to the review.

---

### 12. Admin Verification & Controls (`test/admin.e2e-spec.ts`)
- **Step 1: Vendor Document Verification** ➔ Admin reviews and approves vendor onboarding documents.
- **Step 2: Tier & Commission Settings** ➔ Admin updates platform fee percentages or tier settings.
- **Step 3: User Suspension/Block** ➔ Admin blocks malicious account, verifies immediate token invalidation.
