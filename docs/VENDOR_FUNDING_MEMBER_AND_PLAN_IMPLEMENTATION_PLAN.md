# Vendor Founding Member and Plan Implementation Plan

এই ডকটি vendor onboarding-এর **Choose Your Plan** screen অনুযায়ী backend implementation plan। এখানে মূল requirement হলো:

- client-এর updated requirement অনুযায়ী **Founding Member** offer থাকতে হবে;
- vendor onboarding flow-তে vendor subscription/plan choose করবে;
- Founding signup/subscription window হবে **August 5, 2026 থেকে October 4, 2026** পর্যন্ত;
- **October 5, 2026** হলো official launch date; founding pricing October 4 পর্যন্ত;
- October 5 onward নতুন vendor শুধু standard pricing পাবে;
- admin থেকে offer window/editing configurable থাকতে হবে;
- Founding Member হলেও vendor plan select করবে: `FREE`, `STARTER`, `PRO`, `ELITE`;
- Founding Member benefit plan-এর উপর depend করবে, আলাদা plan হিসেবে না।

---

## 1. Product decision

Founding Member কে আলাদা `VendorPlan` বানানো হবে না।

বর্তমান plan enum থাকবে:

```txt
FREE
STARTER
PRO
ELITE
```

Founding Member হবে vendor-এর উপর একটি extra flag/benefit:

```txt
isFoundingMember = true / false
foundingJoinedAt = DateTime
lockedCommissionRate = number
foundingDiscountEndsAt = DateTime
```

Example:

```txt
selectedPlan = STARTER
isFoundingMember = true
lockedCommissionRate = 0.12
foundingDiscountEndsAt = trialEndsAt + 9 months
```

মানে vendor Starter plan-এ আছে, কিন্তু Founding Member হিসেবে forever 12% commission locked থাকবে। একই সাথে subscription pricing-এ 3 months free trial শেষে months 4–12 পর্যন্ত 50% off পাবে।

---

## 2. Founding window and deadline

Client-এর latest requirement অনুযায়ী window:

```txt
August 5, 2026 – October 4, 2026:
Founding rate available

October 5, 2026 onward:
Standard pricing only
```

Important:

- October 5, 2026 official launch date; this date is not included in the offer window.
- October 5 থেকে no more 50% off for new signups.
- October 5 থেকে no locked founding commission rate for new signups.
- 3 months free trial still applies for all vendors.
- Founding perk only applies to vendors who sign up/subscribe during the founding window.

Default setting:

```txt
foundingOfferStartAt = 2026-08-05T00:00:00Z
foundingOfferEndAt = 2026-10-04T23:59:59Z
officialLaunchAt = 2026-10-05T00:00:00Z
```

Frontend copy তে দেখাবে:

```txt
Founding vendor offer
Available August 5 – October 4, 2026
```

Terminology:

- Client wording is **Founding vendors / Founding rate**.
- Backend field naming should use `founding`, not `funding`.
- Existing doc filename has `FUNDING` to avoid breaking references, but implementation should use `founding`.

### 2.1 Source of truth

Final confirmed requirement:

```txt
August 5 – October 4 → Founding rate available
October 5 onward → Standard pricing only
```

তাই implementation source of truth হবে:

- **August 5, 2026 00:00:00 → October 4, 2026 23:59:59**: founding available;
- **October 5, 2026 00:00:00 onward**: founding unavailable, standard pricing only.

এই rule backend-এ strictly enforce হবে, যাতে October 5 থেকে নতুন signup founding benefit না পায়।

---

## 3. Plan pricing and commission config

Plan data hard-code না করে DB/config থেকে serve করা better, যেন future-এ easily extend করা যায়।

Initial config:

| Plan | Standard monthly price | Months 1–3 | Founding months 4–12 | Standard month 4+ | Normal commission | Founding locked commission | Booking access |
| --- | ---: | --- | ---: | ---: | ---: | ---: | --- |
| FREE | $0 | Free | $0 | $0 | No booking / no commission | No booking / no commission | Disabled |
| STARTER | $10 | Free trial | $5/mo | $10/mo | 15% | 12% locked forever | Enabled |
| PRO | $19 | Free trial | $9.50/mo | $19/mo | 12% | 10% locked forever | Enabled |
| ELITE | $49 | Free trial | $24.50/mo | $49/mo | 8% | 6% locked forever | Enabled |

Free plan discovery/profile/community basic access পাবে, কিন্তু booking accept/send quote/payment flow পাবে না।

Billing rule:

- Everyone gets 3 months free trial.
- Founding vendors get 50% off subscription price for months 4–12.
- After month 12, founding vendors pay standard subscription price.
- Founding vendors keep locked commission rate forever.
- Standard vendors pay standard subscription price from month 4 and use normal plan commission rate.
- Free plan is always free and does not need a trial, even if UI button says “Start free trial”.
- Booking commissions apply only to bookings made through the platform.
- No commission applies to Free plan because bookings are disabled.

---

## 4. Suggested database changes

### 4.1 Vendor table

Add fields:

```prisma
isFoundingMember       Boolean   @default(false) @map("is_founding_member")
foundingJoinedAt       DateTime? @map("founding_joined_at") @db.Timestamptz(6)
trialStartedAt         DateTime? @map("trial_started_at") @db.Timestamptz(6)
trialEndsAt            DateTime? @map("trial_ends_at") @db.Timestamptz(6)
foundingDiscountEndsAt DateTime? @map("founding_discount_ends_at") @db.Timestamptz(6)
lockedCommissionRate   Decimal?  @map("locked_commission_rate") @db.Decimal(6, 3)
```

Why:

- `isFoundingMember`: vendor got the founding offer or not;
- `foundingJoinedAt`: audit/debug;
- `trialStartedAt`, `trialEndsAt`: 3 months free trial tracking;
- `foundingDiscountEndsAt`: 50% subscription discount expires after month 12;
- `lockedCommissionRate`: payment/quote always use this rate if present.

### 4.2 Platform settings table

Need admin editable config. If generic settings table already exists, use that. If not, add:

```prisma
model PlatformSetting {
  key       String   @id @db.VarChar(100)
  value     Json
  updatedAt DateTime @default(now()) @map("updated_at") @db.Timestamptz(6)

  @@map("platform_settings")
}
```

Store:

```json
{
  "key": "vendor_founding_offer",
  "value": {
    "enabled": true,
    "startAt": "2026-08-05T00:00:00.000Z",
    "endAt": "2026-10-04T23:59:59.999Z",
    "officialLaunchAt": "2026-10-05T00:00:00.000Z",
    "subscriptionDiscountPercent": 50,
    "subscriptionDiscountMonths": 9,
    "freeTrialMonths": 3
  }
}
```

### 4.3 Optional plan config table

For phase 1, plan config can be code-level constant to avoid over-engineering.

For future extension, add table:

```prisma
model VendorPlanConfig {
  plan                    VendorPlan @id
  monthlyPriceCents        Int        @map("monthly_price_cents")
  normalCommissionRate     Decimal    @map("normal_commission_rate") @db.Decimal(6, 3)
  foundingCommissionRate   Decimal?   @map("founding_commission_rate") @db.Decimal(6, 3)
  bookingEnabled           Boolean    @default(false) @map("booking_enabled")
  maxStaffAccounts         Int?       @map("max_staff_accounts")
  maxIncludedTrucks        Int?       @map("max_included_trucks")
  analyticsEnabled         Boolean    @default(false) @map("analytics_enabled")
  promotionsEnabled        Boolean    @default(false) @map("promotions_enabled")
  rewardsEnabled           Boolean    @default(false) @map("rewards_enabled")
  updatedAt                DateTime   @default(now()) @map("updated_at") @db.Timestamptz(6)

  @@map("vendor_plan_configs")
}
```

Initial implementation-এর জন্য code constant enough:

```ts
const VENDOR_PLAN_CONFIG = {
  FREE: {
    monthlyPriceCents: 0,
    normalCommissionRate: null,
    foundingCommissionRate: null,
    subscriptionDiscountPercentForFounding: 0,
    bookingEnabled: false,
    maxStaffAccounts: 0,
    maxIncludedTrucks: 1,
    analyticsEnabled: false,
    fullEarningsAnalyticsEnabled: false,
    advancedAnalyticsEnabled: false,
    promotionsEnabled: false,
    rewardsEnabled: false,
    communityBookingRequestsEnabled: false,
    featuredDiscoveryEnabled: false,
    searchBoostEnabled: false,
    featuredBadgeEnabled: false,
  },
  STARTER: {
    monthlyPriceCents: 1000,
    normalCommissionRate: 0.15,
    foundingCommissionRate: 0.12,
    subscriptionDiscountPercentForFounding: 50,
    bookingEnabled: true,
    maxStaffAccounts: 1,
    maxIncludedTrucks: 1,
    analyticsEnabled: true,
    analyticsLevel: 'BASIC',
    fullEarningsAnalyticsEnabled: false,
    advancedAnalyticsEnabled: false,
    promotionsEnabled: true,
    rewardsEnabled: true,
    communityBookingRequestsEnabled: false,
    featuredDiscoveryEnabled: false,
    searchBoostEnabled: false,
    featuredBadgeEnabled: false,
  },
  PRO: {
    monthlyPriceCents: 1900,
    normalCommissionRate: 0.12,
    foundingCommissionRate: 0.10,
    subscriptionDiscountPercentForFounding: 50,
    bookingEnabled: true,
    maxStaffAccounts: 2,
    maxIncludedTrucks: 1,
    analyticsEnabled: true,
    analyticsLevel: 'FULL',
    fullEarningsAnalyticsEnabled: true,
    advancedAnalyticsEnabled: false,
    promotionsEnabled: true,
    rewardsEnabled: true,
    communityBookingRequestsEnabled: true,
    featuredDiscoveryEnabled: true,
    searchBoostEnabled: true,
    featuredBadgeEnabled: false,
  },
  ELITE: {
    monthlyPriceCents: 4900,
    normalCommissionRate: 0.08,
    foundingCommissionRate: 0.06,
    subscriptionDiscountPercentForFounding: 50,
    bookingEnabled: true,
    maxStaffAccounts: 5,
    analyticsEnabled: true,
    analyticsLevel: 'ADVANCED',
    fullEarningsAnalyticsEnabled: true,
    advancedAnalyticsEnabled: true,
    promotionsEnabled: true,
    rewardsEnabled: true,
    maxIncludedTrucks: 3,
    additionalTruckMonthlyPriceCents: 1500,
    communityBookingRequestsEnabled: true,
    featuredDiscoveryEnabled: true,
    searchBoostEnabled: true,
    featuredBadgeEnabled: true,
  },
};
```

---

## 5. New/updated APIs

### 5.1 Public/vendor plan list API

```http
GET /api/v1/vendors/plans
```

Purpose:

- Choose plan screen load করবে;
- founding offer active কিনা জানাবে;
- each plan-এর price, standard month 4+ price, founding months 4–12 discounted price, normal commission, founding locked commission, included/not included features return করবে।

Response example:

```json
{
  "foundingOffer": {
    "enabled": true,
    "isActiveNow": true,
    "startAt": "2026-08-05T00:00:00.000Z",
    "endAt": "2026-10-04T23:59:59.999Z",
    "officialLaunchAt": "2026-10-05T00:00:00.000Z",
    "displayText": "Founding vendor offer available August 5 – October 4, 2026"
  },
  "trial": {
    "freeTrialMonths": 3,
    "foundingDiscountPercent": 50,
    "foundingDiscountMonths": 9
  },
  "plans": [
    {
      "plan": "FREE",
      "name": "Free",
      "monthlyPriceCents": 0,
      "foundingMonthlyPriceCentsAfterTrial": 0,
      "normalCommissionRate": null,
      "foundingCommissionRate": null,
      "bookingEnabled": false,
      "included": [
        "Listed on discovery map",
        "Full profile with photos",
        "Full menu with photos",
        "Customer reviews and ratings",
        "Community tab access",
        "Followers can follow your truck",
        "Follower count visible"
      ],
      "notIncluded": [
        "Live drops",
        "QR check-in and rewards",
        "Push notifications to followers",
        "Message followers",
        "Analytics",
        "Event bookings",
        "Staff accounts"
      ]
    },
    {
      "plan": "STARTER",
      "name": "Starter",
      "monthlyPriceCents": 1000,
      "foundingMonthlyPriceCentsAfterTrial": 500,
      "normalCommissionRate": 0.15,
      "foundingCommissionRate": 0.12,
      "bookingEnabled": true,
      "included": [
        "Everything in Free",
        "Live drops with real-time map",
        "Drop promotions and deals",
        "QR check-in and credit redemption",
        "Push notifications to followers",
        "Message followers broadcast",
        "Event booking requests",
        "Send quotes and accept bookings",
        "Basic analytics",
        "1 staff account"
      ],
      "notIncluded": [
        "Featured on discovery section",
        "Search relevance boost",
        "Full earnings analytics",
        "Community booking requests",
        "Multiple truck listings",
        "Advanced analytics",
        "Priority support",
        "Featured badge on profile"
      ]
    }
  ]
}
```

### 5.2 Complete onboarding update

Existing:

```http
POST /api/v1/vendors/me/onboarding/complete
```

Request should accept:

```json
{
  "selectedPlan": "STARTER",
  "claimFoundingMember": true
}
```

Rules:

- If `claimFoundingMember = true`, backend checks admin-configured founding offer window.
- If offer active, vendor gets `isFoundingMember = true`.
- Backend sets `trialEndsAt = signup/subscription date + 3 months`.
- Backend sets `foundingDiscountEndsAt = signup/subscription date + 12 months`.
- Backend sets `lockedCommissionRate` from selected plan founding commission.
- If offer expired or disabled, return `400` with clear message:

```json
{
  "statusCode": 400,
  "message": "Founding member offer is not available right now",
  "error": "Bad Request"
}
```

### 5.3 Admin update founding offer settings

```http
GET /api/v1/admin/vendor-founding-offer
PATCH /api/v1/admin/vendor-founding-offer
```

Patch body:

```json
{
  "enabled": true,
  "startAt": "2026-08-05T00:00:00.000Z",
  "endAt": "2026-10-04T23:59:59.999Z",
  "officialLaunchAt": "2026-10-05T00:00:00.000Z"
}
```

Purpose:

- Admin can extend/reduce founding offer window;
- admin can disable offer anytime;
- this avoids code deploy just to change deadline.

### 5.4 Admin manually mark vendor as founding member

```http
PATCH /api/v1/admin/vendors/:vendorId/founding-member
```

Body:

```json
{
  "isFoundingMember": true,
  "lockedCommissionRate": 0.1,
  "reason": "Client-approved early vendor"
}
```

Purpose:

- If vendor joined during August 5–October 4 but frontend failed to claim;
- manual correction;
- admin override.

This should create audit log.

---

## 6. Where this will trigger

### 6.1 Choose Your Plan screen

Frontend calls:

```http
GET /api/v1/vendors/plans
```

Backend returns:

- founding offer active/inactive;
- correct October 4, 2026 deadline and October 5, 2026 launch date;
- plan cards;
- included/not included features;
- founding commission rates.

If active:

- show “Grab founding rates now”;
- show founding commission on paid plans;
- show 50% off months 4–12 after 3 months free trial.

If inactive:

- hide founding CTA;
- show standard pricing only;
- still show 3 months free trial.

---

### 6.2 Vendor onboarding completion

When vendor submits onboarding:

```http
POST /api/v1/vendors/me/onboarding/complete
```

Backend:

1. saves selected plan;
2. if `claimFoundingMember = true`, validates offer active;
3. sets trial dates;
4. sets `isFoundingMember`;
5. sets `foundingDiscountEndsAt`;
6. sets `lockedCommissionRate`.

---

### 6.2.1 Vendor subscription creation

When vendor selects a paid plan, backend should prepare Stripe subscription terms based on whether vendor is founding or standard.

Founding paid vendor:

```txt
Months 1–3: free trial
Months 4–12: 50% off selected plan subscription
Month 13 onward: standard selected plan price
Commission: founding commission locked forever
```

Standard paid vendor:

```txt
Months 1–3: free trial
Month 4 onward: standard selected plan price
Commission: normal selected plan commission
```

Free vendor:

```txt
No paid Stripe subscription required initially
Booking disabled
No commission applies
```

If a Free founding vendor upgrades later:

- if they claimed founding during August 5–October 4, keep `isFoundingMember = true`;
- apply founding locked commission rate for the newly selected paid plan;
- apply 50% subscription discount only if product/client confirms upgrade timing eligibility.

Recommended initial rule:

- founding identity is locked during the founding window;
- subscription 50% discount applies when they first subscribe to paid plan, but only within a reasonable product-defined conversion flow;
- this edge case should be confirmed before final billing implementation.

---

### 6.3 Quote/payment commission calculation

Current code mostly uses:

```txt
PLATFORM_COMMISSION_RATE
```

Need update:

```txt
commission rate = vendor.lockedCommissionRate
               OR selected plan normal commission rate
               OR fallback env commission rate
```

This affects:

- booking quote breakdown;
- deposit minimum validation;
- payment commission record;
- platform fee;
- vendor payout amount.

Example:

```txt
Starter normal: 15%
Starter founding: 12%
Pro normal: 12%
Pro founding: 10%
Elite normal: 8%
Elite founding: 6%
```

---

### 6.4 Feature access/blocking

Each vendor action should check selected plan + approval status.

Current approval gate already exists in many places:

```txt
vendor.status === APPROVED
vendor.isVerified === true
```

Need add plan gate:

```txt
vendor selected plan allows this feature?
```

---

## 7. Benefits by plan

Note: pasted UI pricing doc-এর Starter section-এ কিছু Pro-level items duplicated/mixed আছে:

- Featured on discovery
- Search boost
- Full earnings analytics
- Community booking requests

কিন্তু একই doc-এর Pro plan আবার clearly বলে Pro includes those features. তাই hierarchy অনুযায়ী clean interpretation:

- Starter = Drops + Bookings + basic analytics + 1 staff;
- Pro = Starter + community booking requests + featured/search/full analytics + 2 staff;
- Elite = Pro + 3 trucks + advanced analytics + priority/featured badge.

### FREE

Can:

- create vendor account;
- save onboarding info;
- submit verification;
- show public profile/discovery basics after approval;
- full profile with photos;
- full menu with photos;
- customer reviews and ratings;
- community tab access;
- receive followers;
- follower count visible.

Blocked:

- event bookings;
- send/accept quotes;
- live drops;
- QR check-in/rewards;
- push notifications to followers;
- message followers;
- analytics;
- staff accounts;
- promotions.

Backend blocks:

- booking vendor actions;
- quote creation;
- QR/reward redemption;
- vendor analytics;
- staff creation;
- promotions.

---

### STARTER

Can:

- everything in Free;
- live drops;
- drop promotions and deals;
- QR check-in and credit redemption;
- push notifications to followers;
- message followers broadcast;
- event booking requests;
- send quotes and accept bookings;
- basic analytics;
- 1 staff account.

Blocked:

- featured discovery placement;
- search boost;
- full earnings analytics;
- community booking requests;
- multiple truck listings;
- advanced analytics;
- priority support;
- featured badge on profile.

Commission:

- normal: 15%;
- founding member: 12% locked forever.

---

### PRO

Can:

- everything in Starter;
- community booking requests;
- featured discovery section;
- search relevance boost;
- full earnings and analytics;
- 2 staff accounts.

Blocked:

- multiple truck listings;
- advanced analytics;
- priority support;
- featured badge on profile.

Commission:

- normal: 12%;
- founding member: 10% locked forever.

---

### ELITE

Can:

- everything in Pro;
- up to 3 truck listings included;
- additional trucks for $15/month each;
- up to 5 staff accounts;
- advanced analytics and reports;
- featured badge on profile;
- priority customer support;
- early access to new features;
- eligible for BiteDrop social media feature.
- each truck requires its own verification.

Extra truck rule:

- Elite includes up to 3 truck listings.
- Additional trucks cost $15/month per truck beyond 3.
- The pasted UI doc does not specify whether the 50% founding subscription discount applies to additional truck fees.
- Recommended initial rule: founding discount applies only to base subscription fee, not additional truck fees, unless client confirms otherwise.

Commission:

- normal: 8%;
- founding member: 6% locked forever.

---

## 8. Blocks and guard map

| Feature | FREE | STARTER | PRO | ELITE | Backend guard location |
| --- | --- | --- | --- | --- | --- |
| Discovery profile | Yes | Yes | Yes | Yes | food-trucks/discovery |
| Event bookings | No | Yes | Yes | Yes | bookings service |
| Send quote | No | Yes | Yes | Yes | bookings quote service |
| QR check-in/rewards | No | Yes | Yes | Yes | check-ins/rewards service |
| BiteDrop credits redemption | No | Yes | Yes | Yes | rewards service |
| Staff accounts | 0 | 1 | 2 | 5 | vendors staff service |
| Analytics | No | Basic | Full | Advanced | vendors/admin analytics |
| Drop promotions/deals | No | Yes | Yes | Yes | promotions service |
| Community booking requests | No | No | Yes | Yes | community service |
| Featured discovery/search boost | No | No | Yes | Yes | discovery/search service |
| Full earnings analytics | No | No | Yes | Yes | vendors/admin analytics |
| Advanced analytics/reports | No | No | No | Yes | vendors/admin analytics |
| Featured badge on profile | No | No | No | Yes | food-trucks/profile |
| Multiple trucks | 1 max | 1 max | 1 max | 3 included, then $15/mo each | food-trucks service |

Exact additional truck discount rule should be confirmed with client. Initial recommendation: no founding discount on additional truck fees.

---

## 9. Error handling standard

Plan blocking should not return generic 500.

Use clear 403:

```json
{
  "statusCode": 403,
  "message": "Your current plan does not include event bookings. Upgrade to Starter or higher.",
  "error": "Forbidden"
}
```

Founding offer expired:

```json
{
  "statusCode": 400,
  "message": "Founding member offer ended on October 4, 2026. Standard pricing applies from October 5, 2026.",
  "error": "Bad Request"
}
```

Staff limit reached:

```json
{
  "statusCode": 403,
  "message": "Your current plan allows 1 staff account. Upgrade to Pro or Elite to add more staff.",
  "error": "Forbidden"
}
```

Free plan quote block:

```json
{
  "statusCode": 403,
  "message": "Free plan vendors cannot send booking quotes. Upgrade to Starter or higher.",
  "error": "Forbidden"
}
```

---

## 10. Implementation phases

### Phase 1 — Plan/founding foundation

- Add vendor founding fields;
- Add platform settings for founding window;
- Add plan config constant;
- Add `GET /api/v1/vendors/plans`;
- Update onboarding complete to accept `claimFoundingMember`;
- Lock commission rate when founding member joins.

### Phase 2 — Commission integration

- Replace global-only `PLATFORM_COMMISSION_RATE` with vendor-aware commission resolver;
- Update quote financial calculation;
- Update payment commission calculation;
- Update response examples/docs.

### Phase 3 — Feature gating

- Add shared plan guard/helper:

```ts
assertVendorPlanFeature(vendor, 'EVENT_BOOKINGS')
```

- Apply to:
  - quote creation;
  - booking vendor actions;
  - staff creation;
  - analytics;
  - promotions;
  - rewards/QR redemption;
  - additional food truck creation.

### Phase 4 — Admin control

- Add admin founding offer settings API;
- Add admin manual founding member override;
- Add audit logs.

### Phase 5 — Swagger/manual testing docs

- Add Swagger examples;
- Add manual curl testing doc;
- Add frontend handoff.

---

## 11. Testing checklist

### Founding active

- Set founding offer active until October 4, 2026;
- Vendor selects Starter + `claimFoundingMember = true`;
- Expected:
  - `isFoundingMember = true`;
  - `lockedCommissionRate = 0.12`;
  - `trialEndsAt` set to 3 months after join;
  - `foundingDiscountEndsAt` set to 12 months after join.

### Founding expired

- Set founding offer end date before today or test on/after October 5, 2026;
- Vendor sends `claimFoundingMember = true`;
- Expected:
  - 400;
  - clear error message;
  - vendor not marked founding member.

### Free plan booking block

- Vendor selected plan Free;
- Try send quote;
- Expected:
  - 403;
  - upgrade message.

### Staff limit

- Starter vendor already has 1 active staff;
- Try add another staff;
- Expected:
  - 403;
  - plan limit message.

### Commission calculation

- Starter normal vendor quote $1000;
- Expected commission: $150.

- Starter founding vendor quote $1000;
- Expected commission: $120.

- Elite founding vendor quote $1000;
- Expected commission: $60.

---

## 12. Final recommendation

Implement this as:

```txt
Plan = subscription tier
Founding Member = founding-window subscription discount + locked commission benefit
```

This is better than making `FOUNDING` a separate plan because:

- vendor still needs Free/Starter/Pro/Elite features;
- founding only changes subscription discount and locked commission benefits;
- future extension is easier;
- admin can manually control offer window;
- payment commission can reliably use locked rate forever.
