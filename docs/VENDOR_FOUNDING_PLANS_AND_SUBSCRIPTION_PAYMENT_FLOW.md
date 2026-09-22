# Vendor Founding Plans + Subscription Payment Flow

এই document-এর goal হলো vendor subscription system clear করা:

- Founding vendor কীভাবে কাজ করবে
- Free / Starter / Pro / Elite plan-এর সাথে founding benefit কীভাবে combine হবে
- কোন plan-এ কী feature থাকবে
- এই system-এর pros / cons কী
- Web, iOS app, Android app payment কীভাবে handle হবে
- Backend কী status maintain করবে

এটা implementation-এর আগে alignment document হিসেবে use করা যাবে।

---

## 1. Core Business Rule

Vendor onboarding-এর সময় vendor একটা subscription plan choose করবে।

Available plan:

- Free
- Starter
- Pro
- Elite

Founding vendor কোনো আলাদা plan না। এটা একটা promotional benefit / pricing flag।

মানে:

- Founding + Free
- Founding + Starter
- Founding + Pro
- Founding + Elite

এই combination possible।

---

## 2. Founding Window

Client requirement অনুযায়ী founding offer launch date-এর আগে পর্যন্ত available থাকবে।

Current agreed launch date:

```text
October 5
```

Recommended configurable window:

```text
Founding starts: August 5
Founding ends: October 4, 11:59 PM
Standard pricing starts: October 5
```

Rule:

- August 5 থেকে October 4 এর মধ্যে signup/subscription করলে founding benefit পাবে।
- October 5 থেকে নতুন signup করলে founding benefit পাবে না।
- Admin panel থেকে এই date window edit করা যাবে।

Backend should not hardcode this date permanently.

---

## 3. Founding Benefit

Founding vendor benefit:

- First 3 months free trial
- Month 4–12: 50% off subscription price
- Commission rate locked forever
- Founding badge/flag can be shown in admin/vendor profile if needed

Important:

Founding benefit plan-এর উপর apply হবে। Plan নিজে change হবে না।

Example:

| Vendor selected plan | Signup date | Final state |
|---|---:|---|
| Free | Before Oct 5 | Founding + Free |
| Starter | Before Oct 5 | Founding + Starter |
| Pro | Before Oct 5 | Founding + Pro |
| Elite | Before Oct 5 | Founding + Elite |
| Starter | On/After Oct 5 | Standard Starter |
| Pro | On/After Oct 5 | Standard Pro |

---

## 4. Plan Feature Concept

Exact features can be adjusted by admin later, but initial concept:

### Free

Included:

- Listed on discovery map
- Full vendor profile
- Menu/photos
- Customer reviews and ratings
- Community tab access
- Followers can follow truck
- Follower count visible

Not included / blocked:

- Live drops
- QR check-in and rewards
- Push notifications to followers
- Message followers
- Analytics
- Event bookings
- Staff accounts

Commission:

- No booking commission because bookings are disabled

### Starter

Included:

- Everything in Free
- Live drops with real-time map
- Drop promos and deals
- QR check-in and credit redemption
- Push notifications to followers
- Message followers / broadcast
- Event booking requests
- Send quotes and accept bookings
- Basic analytics
- 1 staff account

Not included:

- Featured on discovery
- Search boost
- Full earnings analytics
- Community booking requests

Standard commission:

- 15%

Founding locked commission:

- 12%

### Pro

Included:

- Everything in Starter
- Community booking requests
- Featured on discovery section
- Search relevance boost
- Full earnings and analytics
- 2 staff accounts

Not included:

- Multiple truck listings
- Advanced analytics
- Priority support
- Featured badge on profile

Standard commission:

- 12%

Founding locked commission:

- 10%

### Elite

Included:

- Everything in Pro
- Up to 3 truck listings included
- Additional trucks available as paid add-on
- Up to 5 staff accounts
- Advanced analytics and reports
- Featured badge on profile
- Priority customer support
- Early access to new features
- Eligible for BiteDrop social media feature
- Each truck requires own verification

Standard commission:

- 8%

Founding locked commission:

- 6%

---

## 5. Feature Access Rule

Backend should check feature access using active plan + founding flag.

Example fields:

```text
planCode: free | starter | pro | elite
isFoundingVendor: true | false
subscriptionStatus: active | trialing | past_due | canceled | expired
commissionRate: number
features: string[]
limits: object
```

Feature access should not depend only on frontend.

Backend should block restricted actions:

- booking quote/action if plan does not allow booking
- staff creation if plan staff limit exceeded
- analytics if plan does not allow analytics
- promotions if plan does not allow promotions
- rewards/QR redemption if plan does not allow it

---

## 6. Pros and Cons

### Pros

- Founding offer can work with every plan.
- Admin can keep same plan structure and only apply founding benefit.
- Easy to show UI:
  - `Founding + Starter`
  - `Founding + Pro`
  - `Standard Pro`
- Commission locking becomes clear and auditable.
- Vendor can upgrade later without losing founding identity if business rule allows.
- Backend can calculate access from one common subscription state.

### Cons / Things to decide

- If a Founding + Free vendor upgrades after October 5, should they still get founding discount/commission?
  - Recommended: yes, if they created account during founding window and admin did not revoke founding status.

- If a founding vendor downgrades then upgrades again, should locked commission remain?
  - Recommended: yes, founding status should stay with vendor unless admin manually removes it.

- If payment fails after trial, should features be blocked immediately?
  - Recommended: status becomes `past_due`; allow short grace period if business wants.

- Free plan has no paid subscription, so founding benefit is mostly reserved for future upgrade.

- Apple/Google subscriptions require product IDs and RevenueCat/Store configuration. Backend alone cannot create app store subscriptions.

---

## 7. Payment Architecture

Because this product has both web and mobile app, RevenueCat should be the central subscription entitlement system.

Payment provider will still be different by platform, but backend should receive one unified subscription lifecycle through RevenueCat.

### Web

Use RevenueCat Web with Stripe connected inside RevenueCat.

```text
Web frontend
  → RevenueCat Web Purchase Link / RevenueCat Web SDK
  → Stripe payment inside RevenueCat Web
  → RevenueCat entitlement becomes active
  → RevenueCat webhook
  → Backend updates vendor subscription
```

### iOS App

Use Apple In-App Purchase through RevenueCat.

```text
iOS Flutter app
  → RevenueCat SDK
  → Apple In-App Purchase
  → RevenueCat webhook
  → Backend updates vendor subscription
```

### Android App

Use Google Play Billing through RevenueCat.

```text
Android Flutter app
  → RevenueCat SDK
  → Google Play Billing
  → RevenueCat webhook
  → Backend updates vendor subscription
```

Important:

- Apple Pay / Google Pay are not the same as app subscription billing.
- Mobile app digital subscription must use Apple In-App Purchase and Google Play Billing.
- RevenueCat helps manage Apple/Google purchase verification and lifecycle events.
- RevenueCat Web can use Stripe for web subscription payment.
- Stripe still processes card payments, but RevenueCat becomes the central entitlement/status layer.
- Backend should not maintain two separate subscription lifecycle systems if RevenueCat can cover web + app.

---

## 8. Unified Backend Subscription State

Backend should not care whether vendor paid from web, iOS, or Android when checking access.

Backend should maintain one unified subscription status.

Example:

```json
{
  "vendorId": "vendor_uuid",
  "planCode": "pro",
  "isFoundingVendor": true,
  "provider": "revenuecat",
  "platform": "ios",
  "status": "active",
  "trialEndsAt": "2027-01-05T00:00:00.000Z",
  "currentPeriodEndsAt": "2027-02-05T00:00:00.000Z",
  "willRenew": true,
  "commissionRate": 10
}
```

Provider examples:

- `stripe`
- `revenuecat`

Platform examples:

- `web`
- `ios`
- `android`

Status examples:

- `trialing`
- `active`
- `past_due`
- `canceled`
- `expired`
- `refunded`
- `grace_period`

---

## 9. Recommended Database Concept

### subscription_plans

Stores admin-managed plan definition.

```text
id
code
name
description
monthlyPrice
standardCommissionRate
foundingCommissionRate
trialDays
features
limits
active
sortOrder
```

### subscription_provider_products

Maps internal plan to RevenueCat/App Store/Google/Stripe-backed web product IDs.

```text
id
planId
provider
platform
productId
entitlementId
revenueCatOfferingId
revenueCatPackageId
stripeProductId
stripePriceId
active
```

Notes:

- For web, Stripe product/price can be connected through RevenueCat Web Billing / Stripe Billing.
- For app, RevenueCat maps App Store / Google Play products to the same entitlement.
- This table should store RevenueCat entitlement/offering/package/product mapping per plan.
- This avoids hardcoding product IDs in code.
- Flutter should use RevenueCat offerings/packages for app purchases.
- Web can use RevenueCat Web Purchase Links first, then RevenueCat Web SDK later if custom UI is needed.
- Backend should use this mapping to convert RevenueCat `product_id` / entitlement to internal plan.

### vendor_subscriptions

Stores vendor's current and historical subscription.

```text
id
vendorId
planId
provider
platform
status
startedAt
trialEndsAt
currentPeriodStartsAt
currentPeriodEndsAt
willRenew
externalCustomerId
externalSubscriptionId
latestTransactionId
originalTransactionId
revenueCatAppUserId
rawProviderStatus
createdAt
updatedAt
```

### subscription_events

Stores webhook events for debugging and idempotency.

```text
id
provider
eventId
vendorId
eventType
payload
receivedAt
processedAt
```

---

## 10. RevenueCat Flow

Flutter app uses RevenueCat SDK.

Backend needs:

- RevenueCat secret API key
- RevenueCat webhook signing secret / authorization secret
- Webhook endpoint

Flutter app needs:

- RevenueCat public SDK key for iOS
- RevenueCat public SDK key for Android

Important:

- RevenueCat `app_user_id` must be our backend vendor/user id.
- Flutter must call RevenueCat login/identify with the backend authenticated user id.
- If RevenueCat sends an unknown `app_user_id`, backend should not create random users. It should log and ignore/fail safely.

Recommended backend webhook:

```http
POST /api/v1/subscriptions/webhooks/revenuecat
```

Recommended process:

```text
RevenueCat sends webhook
  → Backend verifies signature/secret
  → Backend extracts app_user_id
  → Backend calls RevenueCat REST API for latest subscriber state
  → Backend maps product/entitlement to internal plan
  → Backend updates vendor subscription
  → Backend stores raw event
```

Why fetch latest state from RevenueCat?

- Webhook can arrive late
- Webhook can arrive out of order
- Duplicate webhook can happen
- Latest RevenueCat state is safer source of truth

Recommended additional backend sync endpoint:

```http
POST /api/v1/subscriptions/revenuecat/sync
```

Purpose:

- Flutter calls this after successful app purchase or restore.
- Backend fetches latest RevenueCat subscriber state immediately.
- This reduces delay if webhook arrives late.
- Webhook still remains the long-term source for renew/cancel/expire updates.

Recommended cancellation rule:

- `CANCELLATION` should usually set `willRenew = false`.
- Access should continue until `currentPeriodEndsAt` / RevenueCat expiry date.
- Only `EXPIRATION`, refund, or expired entitlement should remove access.
- Billing issue can become `past_due` / `grace_period` depending on RevenueCat state.

---

## 11. RevenueCat Web + Stripe Flow

For web subscription payment:

```text
Vendor selects plan on web
  → Web opens RevenueCat Web Purchase Link or RevenueCat Web SDK checkout
  → Stripe processes card payment inside RevenueCat Web
  → RevenueCat activates entitlement
  → RevenueCat webhook confirms subscription state
  → Backend updates vendor subscription
```

Recommended backend webhook:

```http
POST /api/v1/subscriptions/webhooks/revenuecat
```

Backend should not need a separate Stripe subscription webhook for vendor subscription status if RevenueCat Web is used.

RevenueCat should notify backend for:

- initial purchase
- renewal
- cancellation
- expiration
- billing issue
- product change / upgrade / downgrade
- refund or revoked entitlement if provided by RevenueCat state

Stripe may still exist for other backend payment flows, for example booking payments, Connect payouts, or non-subscription payments.

---

## 12. Trial + Founding Discount Flow

### During founding window

```text
Vendor signs up before October 5
  → selects Free/Starter/Pro/Elite
  → backend marks isFoundingVendor = true
  → first 3 months free
  → month 4-12 50% off paid plan
  → founding commission rate locked
```

### After founding window

```text
Vendor signs up on/after October 5
  → selects Free/Starter/Pro/Elite
  → isFoundingVendor = false
  → first 3 months free still applies
  → month 4 onward standard price
  → standard commission rate
```

---

## 13. Admin Control

Admin should be able to manage:

- subscription plans
- price
- commission rates
- founding offer start/end date
- plan features
- plan limits
- active/inactive status
- provider product mapping
- manually mark/remove founding vendor if needed

Admin should not need code deployment for simple plan/price/feature edits.

---

## 14. Vendor UI Flow

### Onboarding

```text
Choose plan
  → show founding offer if within founding window
  → vendor selects plan
  → mobile app opens RevenueCat purchase
  → web opens RevenueCat Web purchase powered by Stripe
  → backend receives RevenueCat webhook
  → vendor subscription becomes active/trialing
```

### Vendor dashboard

Backend should return:

```json
{
  "plan": "pro",
  "isFoundingVendor": true,
  "subscriptionStatus": "trialing",
  "trialEndsAt": "2027-01-05T00:00:00.000Z",
  "commissionRate": 10,
  "features": ["bookings", "analytics", "staff_accounts"],
  "limits": {
    "staffAccounts": 2,
    "truckListings": 1
  }
}
```

---

## 15. Important Decisions Before Implementation

Need final confirmation:

1. Founding Free vendor later upgrades after October 5 — will they keep founding benefit?
   - Recommended: yes.

2. Founding benefit can be removed manually by admin?
   - Recommended: yes, admin override should exist.

3. Payment failed after trial — immediate block or grace period?
   - Recommended: grace period status first, then block after expiry.

4. RevenueCat will be used for both iOS and Android app subscription?
   - Recommended: yes.

5. Web subscription uses RevenueCat Web with Stripe connected inside RevenueCat?
   - Recommended: yes.

6. Admin controls plan pricing/features in DB?
   - Recommended: yes.

---

## 16. Final Recommended Direction

Use this architecture:

```text
Admin DB plans
  ↓
Vendor chooses plan
  ↓
Web pays through RevenueCat Web powered by Stripe
App pays through Apple/Google via RevenueCat
  ↓
RevenueCat webhook
  ↓
Backend unified subscription table
  ↓
Feature guards + commission calculation
```

This keeps:

- App Store/Play Store rules compliant
- Web Stripe payment still possible through RevenueCat Web
- One central entitlement system for web + iOS + Android
- Backend feature access consistent
- Admin plan management flexible
- Founding offer auditable and extendable
