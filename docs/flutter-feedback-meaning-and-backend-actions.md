# Flutter Developer Feedback — Bangla Explanation

এই ডকুমেন্টে Flutter developer যে feedback দিয়েছে, সেটার আসল meaning এবং backend side-এ কী বুঝতে হবে সেটা সহজ বাংলায় explain করা হলো।

এটা সরাসরি implementation checklist না। এটা আগে বোঝার জন্য documentation, যাতে কোন issue কেন এসেছে এবং backend-এ কোথায় attention দিতে হবে সেটা clear থাকে।

## Short Summary

Flutter developer মূলত এই জিনিসগুলো বলেছে:

1. RevenueCat-এর product/entitlement/package mapping backend-এর সাথে মিলছে না।
2. RevenueCat webhook URL dashboard-এ ঠিকভাবে set আছে কিনা confirm করতে হবে।
3. App FCM token backend-এ পাঠাচ্ছে, এখন backend থেকে push notification সত্যি যাচ্ছে কিনা confirm করতে হবে।
4. Booking detail response-এ vendor/truck phone number দরকার।
5. Promotion edit করার API দরকার।
6. Community request edit করার API দরকার।
7. `GET /notifications` response shape Swagger-এ clear করা দরকার।
8. Booking create করার সময় app `startsAt/endsAt` পাঠাতে চায়, এটা backend accept করে কিনা confirm করতে হবে।
9. Truck menu item response-এ menu item `id` থাকলে app `preferredMenuItemIds` পাঠাতে পারবে।

## Current Backend Status Table

Flutter developer-এর দেওয়া feedback অনুযায়ী backend-এর current status:

| # | Flutter developer-এর point | Current backend status | Status | Backend action |
|---|---|---|---|---|
| 1 | RevenueCat product/entitlement/package mapping backend-এর সাথে match করতে হবে | Migration add করা হয়েছে, provider product values RevenueCat actual value অনুযায়ী align হবে | Done | Deploy/migrate করলে `premium_vendor`, `$rc_monthly`, correct Android product IDs apply হবে |
| 2 | RevenueCat webhook URL dashboard-এ set আছে কিনা confirm করতে হবে | Backend webhook endpoint আছে: `/api/v1/subscriptions/webhooks/revenuecat` | Partial | RevenueCat dashboard-এ same endpoint set আছে কিনা manually confirm করতে হবে |
| 3 | FCM token backend-এ যাচ্ছে এবং backend push পাঠাচ্ছে কিনা confirm করতে হবে | Device token API, DB notification, Firebase push service আছে; booking vendor updates/completion/issue notification push path improve করা হয়েছে | Partial | Firebase env server-এ set আছে কিনা এবং real device token দিয়ে end-to-end push test করতে হবে |
| 4 | Booking detail response-এ vendor/truck phone number দরকার | `GET /bookings/{bookingId}` response-এ top-level `vendorPhone` add করা হয়েছে; vendor object-এ `businessPhone` include করা হয়েছে | Done | App এখন `vendorPhone` দিয়ে Call Truck button চালাতে পারবে |
| 5 | Promotion edit API দরকার | `PATCH /api/v1/promotions/{promotionId}` add করা হয়েছে | Done | Vendor owner validation + date/percentage validation আছে |
| 6 | Community request edit API দরকার | `PATCH /api/v1/community/requests/{requestId}` add করা হয়েছে | Done | Only owner + OPEN request + no vendor offers থাকলে edit allowed |
| 7 | `GET /notifications` response shape Swagger-এ clear দরকার | Swagger example add করা হয়েছে; notification metadata-তে `entityType/entityId` auto add করা হয়েছে | Done | App notification tap করে related screen open করতে পারবে |
| 8 | Booking create-এ `startsAt/endsAt` UTC ISO পাঠানো যাবে কিনা confirm দরকার | Service already accepts `startsAt/endsAt` together and then `eventDate/eventTime/eventTimezone` required করে না | Done | Flutter app UTC ISO `startsAt/endsAt` পাঠাতে পারবে |
| 9 | Truck menu item response-এ menu item `id` দরকার | Public truck/menu response `items: true` দিয়ে menu item full object return করে, তাই `id` already included | Done | Existing menu item select করলে app `preferredMenuItemIds` পাঠাতে পারবে |

### Count Summary

| Status | Count | Items |
|---|---:|---|
| Done | 7 | RevenueCat mapping, booking phone, promotion edit API, community request edit API, notifications response/entity data, booking `startsAt/endsAt`, menu item id |
| Partial / needs confirmation | 2 | RevenueCat webhook dashboard setup, real FCM push end-to-end test |
| Not done / needs backend update | 0 | — |

## ২. RevenueCat config backend-এর সাথে মিলছে না

### Developer কী বলতে চাচ্ছে?

App RevenueCat থেকে subscription purchase করার পর কিছু value পায়:

- entitlement id
- package id
- product id

Backend-এর `GET /api/v1/subscriptions/plans` response-এ provider product mapping আছে। এই backend mapping RevenueCat dashboard-এর actual setup-এর সাথে exact match করতে হবে।

যদি match না করে, তাহলে user app থেকে subscription কিনলেও backend বুঝতে পারবে না user কোন plan কিনেছে।

তখন problem হবে:

```text
User subscribe করেছে, কিন্তু backend তাকে paid vendor না ধরে FREE/default হিসেবে রেখে দিতে পারে।
```

### Current backend কীভাবে match করে?

Backend RevenueCat sync/webhook থেকে এই values দেখে plan match করার চেষ্টা করে:

```text
productId
entitlementId
revenueCatPackageId
```

Meaning:

```text
RevenueCat থেকে পাওয়া product/package/entitlement value
→ backend provider product table-এর value-এর সাথে match হতে হবে
→ তাহলেই backend বুঝবে STARTER/PRO/ELITE কোন plan active করতে হবে
```

### Flutter developer যে mismatch বলেছে

| জিনিস | Backend-এ এখন আছে | RevenueCat-এ আসলে আছে |
|---|---|---|
| Entitlement | `vendor_subscription` | `premium_vendor` |
| Starter package | `starter_monthly` | `$rc_monthly` |
| Pro / Elite package | `pro_monthly` / `elite_monthly` | Same, ঠিক আছে |
| Android product | `vendor_starter_monthly` etc | `com.bitedrop.app.vendor.starter:starter-monthly` etc |
| iOS product | `com.bitedrop.app.vendor.starter.monthly` etc | Same, ঠিক আছে |

### Backend-এ কী করতে হবে?

Backend provider product data RevenueCat dashboard-এর actual value অনুযায়ী update করতে হবে।

Important:

```text
entitlementId = premium_vendor
STARTER package = $rc_monthly
Android product IDs = com.bitedrop.app.vendor.starter:starter-monthly etc
```

আর RevenueCat dashboard-এ webhook URL set আছে কিনা confirm করতে হবে:

```http
POST /api/v1/subscriptions/webhooks/revenuecat
```

### কেন এটা important?

Correct flow:

```text
Flutter app purchase complete করে
→ Flutter backend sync API call করে
   অথবা RevenueCat webhook backend-এ hit করে
→ Backend RevenueCat subscriber data পড়ে
→ Backend entitlement/product/package match করে
→ Backend vendor subscription STARTER/PRO/ELITE হিসেবে active করে
```

Mapping ভুল হলে:

```text
Purchase successful হলেও backend subscription active করতে পারবে না।
```

## ৩. Push notification backend থেকে পাঠানো

### Developer কী বলতে চাচ্ছে?

Flutter app এখন login/app open করার সময় backend-এ FCM token পাঠাচ্ছে:

```http
POST /api/v1/users/me/device-tokens
```

Example body:

```json
{
  "token": "fcm-token",
  "platform": "IOS"
}
```

বা:

```json
{
  "token": "fcm-token",
  "platform": "ANDROID"
}
```

এখন Flutter developer জানতে চাচ্ছে:

```text
Backend কি শুধু notification DB-তে save করছে,
নাকি actual FCM push-ও user-এর device token-এ পাঠাচ্ছে?
```

### কোন কোন event-এ notification expected?

Developer specifically এই event গুলো বলেছে:

```text
new booking request
quote sent
booking accept/reject
completion request/approve
new chat message
vendor approve/reject
```

### Backend-এ কী confirm করতে হবে?

প্রতিটা event flow-তে notification service call হচ্ছে কিনা check করতে হবে।

Expected behavior:

```text
1. notifications table-এ notification save হবে
2. ওই user-এর active FCM device token-এ push যাবে
```

### Firebase env দরকার

Server `.env`-এ এগুলো ঠিকভাবে set থাকতে হবে:

```env
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

যদি এগুলো missing/wrong হয়:

```text
Notification DB-তে save হতে পারে,
কিন্তু actual mobile push fail করতে পারে।
```

## ৪. Booking detail response-এ truck/vendor phone number দরকার

### Developer কী বলতে চাচ্ছে?

Customer app-এ “Call Truck” button আছে।

কিন্তু:

```http
GET /api/v1/bookings/{bookingId}
```

এই API response-এ vendor/truck phone number নেই।

তাই app জানে না কোন phone number-এ call করবে।

### Backend-এ কী add করতে হবে?

Booking detail response-এ phone field দিতে হবে।

Recommended:

```json
{
  "vendorPhone": "+12025550199"
}
```

অথবা nested:

```json
{
  "foodTruck": {
    "businessPhone": "+12025550199"
  }
}
```

Best practical option:

```text
Top-level এ vendorPhone দাও,
আর সম্ভব হলে vendor/foodTruck object-এর ভিতরেও phone রাখো।
```

### Phone কোথা থেকে আসবে?

Vendor table-এ business phone থাকে:

```text
vendors.business_phone
```

## ৫. Promotion edit API দরকার

### Developer কী বলতে চাচ্ছে?

বর্তমানে app promotion create করতে পারে এবং list দেখতে পারে।

Existing routes:

```http
POST /api/v1/promotions
GET /api/v1/promotions/food-trucks/{foodTruckId}
```

কিন্তু existing promotion edit করার API নেই।

Needed route:

```http
PATCH /api/v1/promotions/{promotionId}
```

### App কী কী edit করতে চায়?

```text
title
discount/value
startsAt
endsAt
active on/off
```

### Backend validation দরকার

Backend-এ check করতে হবে:

```text
Authenticated vendor ওই promotion-এর food truck-এর owner কিনা
startsAt < endsAt
percentage discount হলে 100-এর বেশি না
এক vendor যেন অন্য vendor-এর promotion edit করতে না পারে
```

## ৬. Community request edit API দরকার

### Developer কী বলতে চাচ্ছে?

Customer নিজের community request দেখতে পারে:

```http
GET /api/v1/community/requests/{requestId}
```

কিন্তু নিজের request edit করতে পারে না।

Needed route:

```http
PATCH /api/v1/community/requests/{requestId}
```

### Backend-এ কী করতে হবে?

Request owner/customer যেন নিজের request edit করতে পারে।

Validation দরকার:

```text
Only creator/customer can edit own request
Deleted request edit করা যাবে না
Probably only OPEN request edit করা যাবে
যদি already quote/offer থাকে, edit allow হবে কিনা decide করতে হবে
```

Recommended:

```text
যদি request-এর ওপর vendor quote/offer already চলে আসে,
তাহলে edit block করা safer।
```

## ৭. GET /notifications response shape clear না

### Developer কী বলতে চাচ্ছে?

Swagger-এ এই API-এর clear example নেই:

```http
GET /api/v1/notifications
```

Flutter app জানতে চায় response কেমন:

Option 1:

```json
[
  {
    "id": "notification-id"
  }
]
```

Option 2:

```json
{
  "items": [],
  "total": 0
}
```

App দুটোই handle করতে পারবে, কিন্তু backend থেকে exact shape জানানো দরকার।

### Backend-এ কী করতে হবে?

Swagger example add করতে হবে।

আর প্রতিটা notification-এ navigation data দেওয়া ভালো:

```json
{
  "data": {
    "entityType": "BOOKING",
    "entityId": "booking-id"
  }
}
```

অথবা:

```json
{
  "entityType": "BOOKING",
  "entityId": "booking-id"
}
```

### কেন দরকার?

User notification tap করলে app জানবে:

```text
এই notification কোন screen খুলবে?
Booking detail?
Chat?
Vendor approval?
Quote?
```

Entity data না থাকলে app proper screen navigate করতে পারবে না।

## ৮. Booking create করার সময় startsAt/endsAt পাঠানো

### Developer কী বলতে চাচ্ছে?

App এইভাবে booking create করতে চায়:

```json
{
  "startsAt": "2026-10-20T18:00:00.000Z",
  "endsAt": "2026-10-20T21:00:00.000Z"
}
```

আগের style:

```json
{
  "eventDate": "2026-10-20",
  "eventTime": "18:00",
  "eventTimezone": "America/Chicago"
}
```

### কেন app startsAt/endsAt পাঠাতে চায়?

Flutter developer বলছে app থেকে reliable IANA timezone পাওয়া difficult।

So UTC ISO পাঠানো safer:

```text
startsAt/endsAt already exact date-time represent করে।
```

### Backend status

`CreateBookingDto`-তে already আছে:

```text
startsAt
endsAt
```

তাই app `startsAt/endsAt` পাঠাতে পারার কথা।

### Backend-এ কী confirm করতে হবে?

Booking service-এ confirm করতে হবে:

```text
startsAt/endsAt দিলে eventDate/eventTime/eventTimezone required না।
```

যদি already কাজ করে, Flutter developer-কে বলা যাবে:

```text
Yes, booking create করার সময় startsAt এবং endsAt UTC ISO পাঠাতে পারো।
```

## ৯. Booking-এর জন্য menu item id

### Developer কী বলতে চাচ্ছে?

App এখন selected foods name হিসেবে পাঠাচ্ছে:

```json
{
  "customMenuItems": ["Birria Tacos", "Vegetarian platter"]
}
```

কিন্তু backend booking DTO support করে:

```json
{
  "preferredMenuItemIds": ["uuid-1", "uuid-2"]
}
```

যদি truck profile/menu response-এ menu item-এর `id` থাকে, তাহলে app name পাঠানোর বদলে actual menu item ID পাঠাতে পারবে।

### Backend-এ কী check করতে হবে?

Truck profile/menu response-এ menu item এইভাবে আসছে কিনা check করতে হবে:

```json
{
  "id": "menu-item-id",
  "name": "Birria Tacos"
}
```

যদি `id` থাকে:

```text
Flutter app preferredMenuItemIds পাঠাবে।
```

যদি `id` না থাকে:

```text
Menu item response-এ id add করতে হবে।
```

### Recommended behavior

```text
Existing menu item select করলে → preferredMenuItemIds
Customer custom food request লিখলে → customMenuItems
```

## Priority

### High Priority

```text
RevenueCat mapping fix
RevenueCat webhook URL confirm
Booking detail response-এ phone number add
Promotion edit API add
Community request edit API add
Push notification event verification
```

### Medium Priority

```text
Notification response Swagger example
Menu item id confirmation
Booking startsAt/endsAt confirmation
```

## Flutter Developer-কে short reply

```text
Thanks for the detailed notes. I reviewed all points.

RevenueCat mapping needs to be aligned with the actual RevenueCat entitlement/package/product IDs. We will update the backend provider product values and confirm the webhook URL.

For push notifications, the app is already sending device tokens, so we will verify that each backend event saves a notification and sends FCM push.

For booking details, we will add vendor/truck phone number so the Call Truck button can work.

We also need to add PATCH APIs for promotions and community requests.

For booking create, startsAt/endsAt UTC ISO is supported in the DTO, and we will confirm the service accepts it without eventDate/eventTime.

For menu items, we will confirm whether the truck profile/menu response includes item IDs and let you know whether to send preferredMenuItemIds or customMenuItems.
```
