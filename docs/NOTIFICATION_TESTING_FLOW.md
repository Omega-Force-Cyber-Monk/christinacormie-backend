# BiteDrop Notification Testing Flow

This guide covers the first-phase notification system across backend, Flutter, and web.

Today reference date:

```text
August 12, 2026
```

Notification scope covered here:

```text
BOOKING_CREATED
BOOKING_ACCEPTED
BOOKING_REJECTED
QUOTE_CREATED
PAYMENT_SUCCEEDED
PAYMENT_FAILED
TRUCK_POST_PUBLISHED
REWARD_EARNED
CHECK_IN_VERIFIED
```

## 1. Testing Goals

Verify these independently and together:

- notification row is created in DB
- notification list API shows the item
- unread count increments and decreases correctly
- mark single read works
- mark all read works
- device token registration works
- push is sent when preference allows it
- push is skipped when push preference disables it
- Flutter receives push and routes correctly
- web receives push and routes correctly

## 2. Base Requirements

Before testing notifications:

1. App is running.
2. Database migrations are applied.
3. Firebase Admin env vars are configured on backend:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`
4. At least these users exist:
   - customer
   - vendor
   - admin
5. Vendor has:
   - approved vendor profile
   - active food truck
   - valid live location
6. For web push:
   - site runs on HTTPS
   - Firebase web config is set
   - service worker is registered

## 3. Core Notification APIs

Backend notification APIs:

```http
GET /api/v1/notifications
GET /api/v1/notifications/unread-count
PATCH /api/v1/notifications/:notificationId/read
PATCH /api/v1/notifications/read-all
```

Device token APIs:

```http
POST /api/v1/users/me/device-tokens
DELETE /api/v1/users/me/device-tokens/:id
```

Example device token registration:

```json
{
  "token": "fcm-token-value",
  "platform": "WEB",
  "deviceId": "chrome-macbook-user-1"
}
```

## 4. Backend-Only Verification

Use this section first before testing on Flutter or web.

### 4.1 What To Verify

- DB notification row is created
- `metadata` is correct for the event
- `GET /notifications` returns the row
- `GET /notifications/unread-count` increments
- `PATCH /notifications/:id/read` updates one item
- `PATCH /notifications/read-all` clears unread count
- no push token should not break the business action
- invalid push token should not break the business action

### 4.2 Recommended Backend Trigger Coverage

Test at least these:

- booking created
- booking accepted
- payment succeeded
- vendor post published
- reward earned
- verified check-in

### 4.3 Expected Metadata Examples

Booking notification:

```json
{
  "eventType": "BOOKING_CREATED",
  "bookingId": "uuid",
  "foodTruckId": "uuid",
  "status": "PENDING"
}
```

Payment notification:

```json
{
  "eventType": "PAYMENT_SUCCEEDED",
  "paymentId": "uuid",
  "bookingId": "uuid",
  "status": "SUCCEEDED"
}
```

Truck post notification:

```json
{
  "eventType": "TRUCK_POST_PUBLISHED",
  "foodTruckId": "uuid",
  "postId": "uuid"
}
```

Reward notification:

```json
{
  "eventType": "REWARD_EARNED",
  "transactionId": "uuid",
  "sourceType": "CHECK_IN",
  "sourceId": "uuid"
}
```

Check-in notification:

```json
{
  "eventType": "CHECK_IN_VERIFIED",
  "checkInId": "uuid",
  "foodTruckId": "uuid",
  "status": "VERIFIED"
}
```

## 5. Manual API Test Order

Use this exact order.

### 5.1 Setup

1. Login customer.
2. Login vendor.
3. Login admin.
4. Register customer device token if available.
5. Register vendor device token if available.
6. Confirm both users have default notification preferences enabled.

### 5.2 Device Token Registration Test

Customer:

```http
POST /api/v1/users/me/device-tokens
```

```json
{
  "token": "customer-fcm-test-token",
  "platform": "WEB",
  "deviceId": "customer-web-test"
}
```

Vendor:

```http
POST /api/v1/users/me/device-tokens
```

```json
{
  "token": "vendor-fcm-test-token",
  "platform": "ANDROID",
  "deviceId": "vendor-android-test"
}
```

Expected result:

- token row is saved
- `isActive` is true
- repeated registration reactivates or updates existing token

## 6. Booking Notification Flow

### 6.1 Booking Created

Date example:

```text
August 20, 2026
```

1. Customer creates booking.
2. Vendor should receive `BOOKING_CREATED`.

Check:

```http
GET /api/v1/notifications
GET /api/v1/notifications/unread-count
```

Expected:

- vendor notification list contains a new item
- type is `BOOKING`
- metadata `eventType` is `BOOKING_CREATED`
- unread count increments by 1

### 6.2 Booking Accepted

1. Vendor accepts booking.
2. Customer should receive `BOOKING_ACCEPTED`.

Expected:

- customer sees new notification
- metadata `eventType` is `BOOKING_ACCEPTED`
- booking id matches created booking

### 6.3 Booking Rejected

1. Create another booking.
2. Vendor rejects it.
3. Customer should receive `BOOKING_REJECTED`.

Expected:

- customer notification exists
- metadata `eventType` is `BOOKING_REJECTED`

### 6.4 Quote Created

1. Create new booking.
2. Vendor creates quote.
3. Customer should receive `QUOTE_CREATED`.

Expected:

- customer notification exists
- metadata `eventType` is `QUOTE_CREATED`

## 7. Payment Notification Flow

### 7.1 Payment Succeeded

1. Move booking to payment-ready flow.
2. Create payment intent.
3. Trigger Stripe success webhook for the payment intent.

Expected:

- customer gets payment notification
- vendor gets payment notification if implemented for vendor
- metadata `eventType` is `PAYMENT_SUCCEEDED`
- payment id matches the payment record

### 7.2 Payment Failed

1. Use a payment intent failure scenario.
2. Trigger Stripe failed payment event.

Expected:

- customer gets payment update
- metadata `eventType` is `PAYMENT_FAILED`
- business flow remains stable

## 8. Vendor Post Notification Flow

Date example:

```text
August 12, 2026
```

1. Customer follows truck.
2. Vendor creates a published post.

Expected:

- follower receives notification
- metadata `eventType` is `TRUCK_POST_PUBLISHED`
- notification contains `foodTruckId` and `postId`

Important:

- only `PUBLISHED` posts should trigger
- drafts should not trigger

## 9. Reward And Check-In Notification Flow

### 9.1 Verified Check-In

1. Customer scans QR.
2. Customer completes check-in within valid distance.

Expected:

- customer gets check-in notification
- metadata `eventType` is `CHECK_IN_VERIFIED`
- `status` is `VERIFIED`

### 9.2 Reward Earned

1. Same verified check-in or another reward trigger awards points.

Expected:

- customer gets reward notification
- metadata `eventType` is `REWARD_EARNED`
- related source fields are present

## 10. Read And Unread Testing

After creating at least 2 notifications:

1. Call:

```http
GET /api/v1/notifications/unread-count
```

2. Mark one notification:

```http
PATCH /api/v1/notifications/:notificationId/read
```

3. Check unread count again.
4. Mark all read:

```http
PATCH /api/v1/notifications/read-all
```

5. Check unread count again.

Expected:

- unread count decreases after one read
- unread count becomes `0` after read-all
- read timestamps are populated

## 11. Preference-Based Testing

### 11.1 Disable Booking Push

1. Update customer or vendor notification preferences:

```http
PATCH /api/v1/users/me/notification-preferences
```

```json
{
  "bookingAlerts": false
}
```

2. Trigger booking event again.

Expected:

- in-app notification row should still exist if the system keeps business-critical notifications
- push should be skipped
- business action should succeed normally

### 11.2 Disable Reward Push

1. Set:

```json
{
  "rewardAlerts": false
}
```

2. Trigger reward event.

Expected:

- in-app notification may still exist
- push should be skipped

## 12. Failure Case Testing

### 12.1 No Token Registered

1. Remove all active device tokens.
2. Trigger a notification event.

Expected:

- DB notification is created
- no crash
- business flow continues

### 12.2 Invalid Token Registered

1. Register obviously invalid token.
2. Trigger notification.

Expected:

- DB notification is created
- push send may fail
- token can become inactive later
- business flow continues

### 12.3 Permission Denied On Client

Expected:

- no device token registration
- in-app notification list still works
- unread count still works

### 12.4 Duplicate Event

If a flow already protects against duplicates:

- trigger same exact reward/check-in condition twice

Expected:

- duplicate points should not be awarded if idempotency exists
- notification duplication should match current business rules

## 13. Flutter Test Flow

### 13.1 Setup

1. Login user in Flutter.
2. Allow notification permission.
3. Obtain FCM token.
4. Register token with backend.

Expected:

- backend stores token for that user

### 13.2 Foreground Test

1. Keep app open in foreground.
2. Trigger booking/payment/post/reward/check-in event.

Expected:

- push arrives in foreground
- local app handler runs
- in-app notification screen also shows the same DB notification

### 13.3 Background Test

1. Move app to background.
2. Trigger one event.
3. Tap push notification.

Expected:

- system notification is shown
- tapping opens the app
- app routes to the correct screen or nearest fallback screen

### 13.4 Flutter Fallback Rule

If push is not received:

- call `GET /api/v1/notifications`
- confirm the notification still exists in backend list

## 14. Web Test Flow

### 14.1 Setup

1. Open web app on HTTPS.
2. Allow browser notification permission.
3. Ensure service worker is registered.
4. Obtain FCM web token using VAPID key.
5. Register token with backend.

Expected:

- backend stores web token
- platform is `WEB`

### 14.2 Foreground Web Test

1. Keep web app open in active tab.
2. Trigger a notification event.

Expected:

- foreground message handler fires
- in-app notification UI updates from backend API

### 14.3 Background Web Test

1. Keep site open in another tab or background.
2. Trigger a notification event.
3. Click browser push.

Expected:

- browser notification is shown
- click opens or focuses the web app
- route opens to relevant page if implemented

### 14.4 Web Browser Cautions

- Safari web push behavior may differ from Chrome
- background delivery may vary by browser and OS rules
- local non-HTTPS environments usually do not behave like production web push

## 15. Practical Test Checklist

### Backend Checklist

- register/login test users
- register device token
- trigger booking created
- trigger booking accepted
- trigger payment success
- trigger vendor post publish
- trigger reward/check-in
- verify `GET /notifications`
- verify unread count
- verify mark one read
- verify mark all read

### Flutter Checklist

- permission granted
- token received
- token saved in backend
- foreground push received
- background push received
- tap routing works
- notification list API matches push content

### Web Checklist

- HTTPS enabled
- service worker active
- token received
- token saved in backend
- foreground web push path works
- background browser push works
- click routing works
- notification center matches backend API

## 16. Expected Results Summary

- core business action succeeds even if push fails
- DB notification exists for tested events
- unread count is accurate
- read status updates correctly
- push is only attempted when token exists and preference allows it
- no token or invalid token does not break booking/payment/check-in/post flow

## 17. Common Failure Diagnosis

| Problem | Likely Cause | What To Check |
|---|---|---|
| No notification in API | trigger not fired or row not created | service trigger path, notification table, business action status |
| Notification exists but no push | no token, invalid token, preference disabled, Firebase env missing | device tokens table, preferences, Firebase env vars |
| Unread count wrong | read status not updated | `isRead`, `readAt`, mark-read endpoints |
| Flutter gets nothing | permission denied, FCM token missing, app background handler missing | Firebase setup, token registration, app handlers |
| Web gets nothing | HTTPS missing, service worker missing, browser permission denied | browser permission, service worker, VAPID token registration |
| Tap opens wrong place | metadata missing or routing map incomplete | notification metadata, client route handling |

## 18. Minimal Recommendation

Run notification testing in this order:

1. backend in-app notification only
2. device token registration
3. Flutter foreground push
4. Flutter background push
5. web foreground push
6. web background push

This keeps debugging simple and avoids mixing backend and client issues too early.
