# Vendor BiteDrop Credits Analytics Implementation Plan

এই ডকটা vendor-side **BiteDrop Credits** page-এর backend implementation plan।

আমার review অনুযায়ী plan-এর direction ঠিক আছে। Best approach হবে:

```http
GET   /api/v1/vendors/me/credits/analytics
PATCH /api/v1/vendors/me/credits/settings
```

মানে Flutter যেন এক API call দিয়েই page-এর সব dynamic data পায়, আর আলাদা API দিয়ে vendor credit acceptance on/off করতে পারে।

Existing redemption confirm API রাখা হবে:

```http
POST /api/v1/vendors/me/redemptions/confirm
```

---

## Final recommendation

এই page-এর জন্য best way:

1. **একটা combined read API** বানানো:

```http
GET /api/v1/vendors/me/credits/analytics
```

এটা return করবে:

- credit acceptance status;
- weekly QR scans chart;
- followers summary/chart;
- top scan/drop locations;
- credit redemption stats;
- recent redemptions.

2. **একটা settings API** বানানো:

```http
PATCH /api/v1/vendors/me/credits/settings
```

এটা vendor-এর BiteDrop Credit acceptance on/off করবে।

3. Existing credit redemption confirm API update করা:

```http
POST /api/v1/vendors/me/redemptions/confirm
```

যদি vendor credit acceptance বন্ধ করে রাখে, তাহলে redemption confirm হবে না।

এই approach ভালো কারণ:

- Flutter কে multiple API merge করতে হবে না;
- dashboard page fast এবং clean থাকবে;
- analytics calculation backend-এ consistent থাকবে;
- credit acceptance setting real business logic-এ affect করবে;
- future-এ analytics expand করা সহজ হবে।

---

## Current backend e ki ache

### 1. Existing QR/check-in analytics

Already আছে:

```http
GET /api/v1/check-ins/food-trucks/:foodTruckId/qr-analytics
```

Currently returns:

- `scanCount`
- `completedScanCount`
- `checkInCount`
- `verifiedCheckInCount`
- `conversionRate`
- `latestScans`

এটা useful, but Figma page-এর জন্য enough না। কারণ Figma page-এ weekly chart, top locations, redemption stats, followers chart দরকার।

### 2. Existing credit redemption confirm

Already আছে:

```http
POST /api/v1/vendors/me/redemptions/confirm
```

Supports:

- customer redemption QR token;
- manual 6-digit backup code;
- `VENDOR`;
- `VENDOR_STAFF`.

এই API **Redeem Credit → Scan QR / Manual Code / Redemption Complete** flow handle করে।

### 3. Existing vendor analytics

Already আছে:

```http
GET /api/v1/vendors/me/analytics
```

But এটা general vendor dashboard analytics। BiteDrop Credits page-এর exact analytics না।

---

## Ei Figma page-er jonno missing ki

এই screen-এর জন্য currently missing:

- `Currently Accepting / Not Accepting` state;
- Turn On/Off Credit Acceptance API;
- weekly QR scans chart;
- followers weekly/monthly chart;
- top drop/scan locations;
- total credit redemptions;
- total credits applied;
- average redemptions per day;
- week-over-week change;
- recent credit redemption list;
- QR/manual redemption method accurately store করা।

---

## New API 1: Get BiteDrop Credits Analytics

```http
GET /api/v1/vendors/me/credits/analytics
```

Role:

```txt
VENDOR
```

Recommended query params:

```txt
foodTruckId?: uuid
range?: week | month
timezone?: string
```

Default:

```txt
range = week
timezone = UTC
```

### foodTruckId behavior

Figma page-এ truck switcher নাই। তাই first version-এ best হবে vendor-এর সব active food truck aggregate করা।

If `foodTruckId` দেওয়া হয়:

- backend verify করবে food truck current vendor-এর কিনা;
- then শুধু ওই truck-এর data return করবে।

If `foodTruckId` না দেওয়া হয়:

- vendor-এর সব active/non-deleted food truck aggregate করবে।

---

## Recommended response

```json
{
  "creditAcceptance": {
    "enabled": true,
    "statusLabel": "Currently Accepting",
    "updatedAt": "2026-09-19T10:00:00.000Z"
  },
  "qrScans": {
    "totalThisWeek": 585,
    "chart": [
      { "label": "Mon", "count": 45 },
      { "label": "Tue", "count": 60 },
      { "label": "Wed", "count": 55 },
      { "label": "Thu", "count": 90 },
      { "label": "Fri", "count": 75 },
      { "label": "Sat", "count": 120 },
      { "label": "Sun", "count": 140 }
    ]
  },
  "followers": {
    "total": 1240,
    "changeThisMonth": 260,
    "chart": [
      { "label": "W1", "count": 980 },
      { "label": "W2", "count": 1060 },
      { "label": "W3", "count": 1120 },
      { "label": "W4", "count": 1240 }
    ]
  },
  "topDropLocations": [
    {
      "label": "4th & Mission, SF",
      "scanCount": 156,
      "latitude": 37.782,
      "longitude": -122.405
    }
  ],
  "creditRedemptions": {
    "totalRedeemedCount": 125,
    "totalCreditApplied": 625,
    "averagePerDay": 17.9,
    "changeVsLastWeekPercent": 18,
    "recent": [
      {
        "id": "redemption-uuid",
        "customerName": "Maria Chen",
        "method": "QR_SCAN",
        "amount": 5,
        "createdAt": "2026-09-19T14:14:00.000Z"
      }
    ]
  }
}
```

### Static content backend থেকে না দিলেও হবে

Figma page-এর এই sections static:

- How Credit Redemption Works
- Why This Grows Your Business
- Redemption Method Details

Recommendation: এগুলো Flutter-এ static রাখা ভালো। Backend থেকে dynamic করার দরকার নাই initially।

---

## New API 2: Update Credit Acceptance Setting

```http
PATCH /api/v1/vendors/me/credits/settings
```

Role:

```txt
VENDOR
```

Body:

```json
{
  "creditAcceptanceEnabled": true
}
```

Success:

```json
{
  "message": "Credit acceptance updated successfully",
  "creditAcceptance": {
    "enabled": true,
    "statusLabel": "Currently Accepting",
    "updatedAt": "2026-09-19T10:00:00.000Z"
  }
}
```

If off:

```json
{
  "message": "Credit acceptance updated successfully",
  "creditAcceptance": {
    "enabled": false,
    "statusLabel": "Not Accepting",
    "updatedAt": "2026-09-19T10:00:00.000Z"
  }
}
```

---

## Credit acceptance off hole behavior

Vendor যদি BiteDrop Credits off করে:

- analytics page show হবে;
- QR/check-in system বন্ধ হবে না;
- customer rewards/profile system বন্ধ হবে না;
- কিন্তু vendor redemption confirm করতে পারবে না।

Update korte hobe:

```txt
RewardsService.confirmVendorRedemption()
```

If disabled:

```json
{
  "statusCode": 403,
  "message": "This vendor is not accepting BiteDrop Credits right now",
  "error": "Forbidden"
}
```

---

## Database changes

### 1. Vendor table e credit acceptance state

Add to `Vendor`:

```prisma
creditAcceptanceEnabled   Boolean   @default(true) @map("credit_acceptance_enabled")
creditAcceptanceUpdatedAt DateTime? @map("credit_acceptance_updated_at") @db.Timestamptz(6)
```

Why vendor-level?

- Figma page vendor business-level setting দেখাচ্ছে;
- current redemption confirm vendor দিয়ে resolve হয়;
- vendor staff redemption confirm করে vendor-এর behalf-এ;
- simpler and cleaner for first version.

Food-truck-level setting future-এ লাগতে পারে, but now না। If later product wants per-truck credit acceptance, then `FoodTruck` table-এ field add করা যাবে।

### 2. RewardRedemption e redemption method

Currently exact QR vs manual confirmation method store হচ্ছে না। Figma recent redemptions-এ method দেখায়:

- QR Scan
- Manual Code
- Self-Service

Accurate data লাগলে DB field add করা best:

```prisma
enum RewardRedemptionMethod {
  QR_SCAN
  MANUAL_CODE
  SELF_SERVICE
}
```

Add to `RewardRedemption`:

```prisma
redemptionMethod RewardRedemptionMethod? @map("redemption_method")
```

When confirm API called:

- `dto.redemptionToken` থাকলে `QR_SCAN`
- `dto.manualCode` থাকলে `MANUAL_CODE`

`SELF_SERVICE` future-এর জন্য রাখা যেতে পারে।

---

## Analytics data source mapping

### Credit acceptance

Source:

```txt
vendors.credit_acceptance_enabled
vendors.credit_acceptance_updated_at
```

### QR scans chart

Source:

```txt
qr_scans
```

Current schema has:

```txt
QrScan.scannedAt
QrScan.foodTruckId
QrScan.scanLocation
```

Filter:

```txt
foodTruck.vendorId = currentVendor.id
scannedAt between range start and range end
```

Group:

```txt
day of week
```

Output must always include all labels:

```txt
Mon, Tue, Wed, Thu, Fri, Sat, Sun
```

If no data, count `0`.

### Followers chart

Source:

```txt
food_truck_follows
```

Current schema already has:

```txt
FoodTruckFollow.createdAt
```

So no schema change needed for followers.

Calculation:

- `total` = current follower count across vendor food trucks;
- `changeThisMonth` = follows created since month start;
- chart = weekly count or cumulative count.

Recommendation:

- return cumulative chart because Figma graph looks like total followers growing.

### Top drop locations

Source:

```txt
qr_scans.scan_location
```

Current schema has `QrScan.scanLocation` as geography.

Issue:

- exact human-readable address may not exist.

Recommended first version:

- group scan coordinates by rounded lat/lng bucket;
- return `latitude`, `longitude`, `scanCount`;
- label fallback:

```txt
Lat 37.78, Lng -122.40
```

Better future version:

- store a `locationLabel` when vendor creates drop or updates live location;
- then analytics can show `"4th & Mission, SF"` style label.

### Credit redemption stats

Source:

```txt
reward_redemptions
```

Current schema has:

```txt
vendorId
foodTruckId
rewardValue
status
redeemedAt
usedAt
userId
```

Filter:

```txt
vendorId = currentVendor.id
status = COMPLETED
usedAt within selected range
```

Calculations:

- `totalRedeemedCount` = count completed redemptions;
- `totalCreditApplied` = sum `rewardValue`;
- `averagePerDay` = count / number of days in selected range;
- `changeVsLastWeekPercent` = compare current period with previous same period;
- `recent` = latest completed redemptions ordered by `usedAt desc`.

Recent item customer name:

```txt
user.profile.displayName
or firstName + lastName
or email fallback
```

---

## Backend implementation steps

### Step 1. Prisma schema update

Add Vendor fields:

```txt
creditAcceptanceEnabled
creditAcceptanceUpdatedAt
```

Add RewardRedemption method:

```txt
RewardRedemptionMethod enum
redemptionMethod
```

Migration create:

```bash
npx prisma migrate dev --schema prisma/schema --name vendor_bitedrop_credits_analytics
```

Server deploy:

```bash
npx prisma migrate deploy --schema prisma/schema
```

Important:

```txt
No migrate reset.
```

### Step 2. DTO add

Create:

```txt
src/modules/vendors/dto/update-credit-settings.dto.ts
src/modules/vendors/dto/vendor-credit-analytics-query.dto.ts
```

`UpdateCreditSettingsDto`:

```ts
creditAcceptanceEnabled: boolean;
```

`VendorCreditAnalyticsQueryDto`:

```ts
foodTruckId?: string;
range?: 'week' | 'month';
timezone?: string;
```

### Step 3. Repository methods add

Recommended methods:

```txt
updateVendorCreditSettings(vendorId, enabled)
getVendorCreditSettings(vendorId)
getVendorQrScanChart(vendorId, foodTruckIds, start, end)
getVendorFollowerSummary(vendorId, foodTruckIds, start, end)
getVendorTopScanLocations(vendorId, foodTruckIds, start, end)
getVendorCreditRedemptionSummary(vendorId, start, end)
getVendorRecentCreditRedemptions(vendorId, limit)
```

Complex analytics-এর জন্য raw SQL use করা better, especially:

- day-of-week grouping;
- geography lat/lng extraction;
- previous period comparison.

### Step 4. Service methods add

Add to `VendorsService`:

```txt
getMyCreditAnalytics(userId, query)
updateMyCreditSettings(userId, dto)
```

Both should:

- ensure user has vendor profile;
- ensure vendor is `APPROVED`;
- ensure vendor is verified;
- if `foodTruckId` provided, ensure it belongs to vendor.

### Step 5. Redemption confirm update

Update:

```txt
RewardsService.confirmVendorRedemption()
```

Add checks:

```txt
if vendor.creditAcceptanceEnabled === false:
  throw ForbiddenException('This vendor is not accepting BiteDrop Credits right now')
```

Also set method:

```txt
dto.redemptionToken -> QR_SCAN
dto.manualCode -> MANUAL_CODE
```

Repository `completeVendorRedemption()` should accept method and save it.

### Step 6. Controller routes add

Add to `VendorsController`:

```http
GET /api/v1/vendors/me/credits/analytics
PATCH /api/v1/vendors/me/credits/settings
```

Add Swagger examples for:

- success response;
- unapproved vendor error;
- wrong food truck error;
- disabled redemption error.

---

## Manual testing checklist

1. Approved vendor can load credits analytics.
2. Unapproved vendor gets 403.
3. Vendor can turn credit acceptance off.
4. Analytics now returns `enabled: false`.
5. Redemption confirm fails while disabled.
6. Vendor can turn credit acceptance on.
7. Redemption confirm succeeds while enabled.
8. `QR_SCAN` method saves when `redemptionToken` is used.
9. `MANUAL_CODE` method saves when `manualCode` is used.
10. Weekly QR chart returns Mon-Sun even with zero data.
11. Followers chart returns safe zeros if no followers.
12. Top locations returns empty array if no scans.
13. Recent redemptions returns customer name, method, amount, createdAt.
14. Wrong vendor foodTruckId returns 403.

---

## Final API checklist for Figma page

| UI section | API |
| --- | --- |
| Currently Accepting / Not Accepting | `GET /api/v1/vendors/me/credits/analytics` |
| Turn On/Off Credit Acceptance | `PATCH /api/v1/vendors/me/credits/settings` |
| QR Scans weekly chart | `GET /api/v1/vendors/me/credits/analytics` |
| Followers chart | `GET /api/v1/vendors/me/credits/analytics` |
| Top Drop Locations | `GET /api/v1/vendors/me/credits/analytics` |
| Credit Redemptions cards | `GET /api/v1/vendors/me/credits/analytics` |
| Recent Redemptions | `GET /api/v1/vendors/me/credits/analytics` |
| Scan customer QR / manual code | existing `POST /api/v1/vendors/me/redemptions/confirm` |

---

## Final decision

এই plan implement করা ঠিক হবে।

Important corrections already included:

- follower chart-এর জন্য `createdAt` already আছে, new field লাগবে না;
- QR/manual method accurate করার জন্য `redemptionMethod` add করা দরকার;
- credit acceptance vendor-level রাখা best for first version;
- page data এক combined API দিয়ে দেওয়া better;
- static explanation cards Flutter-এ থাকলেই enough;
- redemption confirm must respect credit acceptance setting.

