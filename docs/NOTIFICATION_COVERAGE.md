# Notification Coverage

This document explains which roles currently receive notifications, which actions create them, and which frontend/backend APIs are involved.

## Notification center APIs

All authenticated roles can use the notification center APIs. A notification belongs to a `userId`, so the role depends on the recipient user account.

```http
GET   /api/v1/notifications
GET   /api/v1/notifications/unread-count
PATCH /api/v1/notifications/:notificationId/read
PATCH /api/v1/notifications/read-all
```

Push device token APIs:

```http
POST   /api/v1/users/me/device-tokens
DELETE /api/v1/users/me/device-tokens/:id
```

Notification preference API:

```http
PATCH /api/v1/users/me/notification-preferences
```

Available preference flags:

- `nearbyDropAlerts`
- `followedTruckUpdates`
- `favoriteTruckAlerts`
- `promotionAlerts`
- `bookingAlerts`
- `paymentAlerts`
- `messageAlerts`
- `rewardAlerts`
- `checkInAlerts`
- `marketingAlerts`

## Role-wise current coverage

### Customer

Customers currently receive notifications for:

| Action                                             | Notification type                                  | Event metadata         | Push preference                                |
| -------------------------------------------------- | -------------------------------------------------- | ---------------------- | ---------------------------------------------- |
| Vendor accepts booking request                     | `BOOKING`                                          | `BOOKING_ACCEPTED`     | `bookingAlerts`                                |
| Vendor rejects booking request                     | `BOOKING`                                          | `BOOKING_REJECTED`     | `bookingAlerts`                                |
| Vendor sends booking quote                         | `BOOKING`                                          | `QUOTE_CREATED`        | `bookingAlerts`                                |
| Vendor requests completion approval                | `BOOKING`                                          | not currently set      | in-app only                                    |
| Admin resolves booking issue                       | `BOOKING`                                          | not currently set      | in-app only                                    |
| Customer payment starts                            | `PAYMENT`                                          | not currently set      | in-app only                                    |
| Customer payment succeeds                          | `PAYMENT`                                          | `PAYMENT_SUCCEEDED`    | `paymentAlerts`                                |
| Customer payment fails/updates from Stripe webhook | `PAYMENT`                                          | `PAYMENT_FAILED`       | `paymentAlerts`                                |
| Refund starts                                      | `PAYMENT`                                          | not currently set      | in-app only                                    |
| Followed/favorited truck publishes a social post   | `FOLLOWED_TRUCK_UPDATE` or `FAVORITE_TRUCK_UPDATE` | `TRUCK_POST_PUBLISHED` | `followedTruckUpdates` / `favoriteTruckAlerts` |
| Receives a message in an unmuted conversation      | `MESSAGE`                                          | `MESSAGE_CREATED`      | `messageAlerts`                                |
| Loyalty points awarded                             | `REWARD`                                           | `REWARD_EARNED`        | `rewardAlerts`                                 |
| Reward redeemed                                    | `REWARD`                                           | `REWARD_EARNED`        | `rewardAlerts`                                 |
| Vendor confirms reward credit redemption           | `REWARD`                                           | `REWARD_EARNED`        | `rewardAlerts`                                 |
| Check-in verified/rejected/not eligible            | `CHECK_IN`                                         | `CHECK_IN_VERIFIED`    | `checkInAlerts`                                |
| Customer badge awarded                             | `BADGE`                                            | not currently set      | in-app only                                    |
| Someone uses customer referral code                | `REFERRAL`                                         | not currently set      | in-app only                                    |
| Customer referral qualifies                        | `REFERRAL`                                         | not currently set      | in-app only                                    |

### Vendor owner

Vendor owners currently receive notifications for:

| Action                                                                          | Notification type | Event metadata      | Push preference |
| ------------------------------------------------------------------------------- | ----------------- | ------------------- | --------------- |
| Customer creates booking request                                                | `BOOKING`         | `BOOKING_CREATED`   | `bookingAlerts` |
| Customer accepts quote                                                          | `BOOKING`         | not currently set   | in-app only     |
| Customer approves completion/payment release                                    | `BOOKING`         | not currently set   | in-app only     |
| Customer reports booking issue                                                  | `BOOKING`         | not currently set   | in-app only     |
| Customer deposit/payment succeeds                                               | `PAYMENT`         | `PAYMENT_SUCCEEDED` | `paymentAlerts` |
| Vendor payment fails/updates from Stripe webhook, when vendor recipient is used | `PAYMENT`         | `PAYMENT_FAILED`    | `paymentAlerts` |
| Receives a message in an unmuted conversation                                   | `MESSAGE`         | `MESSAGE_CREATED`   | `messageAlerts` |
| Vendor badge awarded                                                            | `BADGE`           | not currently set   | in-app only     |
| Someone uses vendor referral code                                               | `REFERRAL`        | not currently set   | in-app only     |
| Vendor referral qualifies                                                       | `REFERRAL`        | not currently set   | in-app only     |

### Vendor staff

Vendor staff can use the notification center because they are authenticated users. Current automatic notifications are limited to user-specific flows:

| Action                                        | Notification type | Event metadata    | Push preference |
| --------------------------------------------- | ----------------- | ----------------- | --------------- |
| Receives a message in an unmuted conversation | `MESSAGE`         | `MESSAGE_CREATED` | `messageAlerts` |

Current booking/payment/vendor-business notifications are sent to the vendor owner user, not all staff members.

### Admin

Admins can use the notification center APIs as authenticated users. The backend now creates admin notifications for the main operational actions that require review or attention:

| Action                                        | Notification type | Event metadata                  | Priority |
| --------------------------------------------- | ----------------- | ------------------------------- | -------- |
| Vendor submits verification documents         | `ADMIN`           | `VENDOR_VERIFICATION_SUBMITTED` | `HIGH`   |
| Customer reports a booking issue              | `ADMIN`           | `BOOKING_ISSUE_REPORTED`        | `HIGH`   |
| Customer/vendor sends a booking issue message | `ADMIN`           | `BOOKING_ISSUE_MESSAGE_CREATED` | `MEDIUM` |
| Stripe payment fails                          | `ADMIN`           | `PAYMENT_ATTENTION_REQUIRED`    | `HIGH`   |
| Stripe refund fails                           | `ADMIN`           | `PAYMENT_ATTENTION_REQUIRED`    | `HIGH`   |
| Review is reported                            | `ADMIN`           | `CONTENT_REPORT_SUBMITTED`      | `MEDIUM` |
| Community post is reported                    | `ADMIN`           | `CONTENT_REPORT_SUBMITTED`      | `MEDIUM` |

Vendor verification and photo shoot requests may also send operational emails to `VENDOR_REVIEW_NOTIFICATION_EMAIL` where configured.

## Notification types in schema

The Prisma enum currently supports:

- `GENERAL`
- `NEARBY_DROP`
- `FOLLOWED_TRUCK_UPDATE`
- `FAVORITE_TRUCK_UPDATE`
- `NEW_TRUCK_IN_AREA`
- `PROMOTION`
- `BOOKING`
- `PAYMENT`
- `MESSAGE`
- `REVIEW`
- `REWARD`
- `REFERRAL`
- `CHECK_IN`
- `BADGE`
- `ADMIN`

Not every enum value currently has an implemented trigger.

## Implemented event metadata values

The backend currently defines these event metadata values:

- `BOOKING_CREATED`
- `BOOKING_ACCEPTED`
- `BOOKING_REJECTED`
- `QUOTE_CREATED`
- `PAYMENT_SUCCEEDED`
- `PAYMENT_FAILED`
- `TRUCK_POST_PUBLISHED`
- `REWARD_EARNED`
- `CHECK_IN_VERIFIED`
- `MESSAGE_CREATED` is used by messaging notifications as a string in `pushData`.
- `VENDOR_VERIFICATION_SUBMITTED`
- `BOOKING_ISSUE_REPORTED`
- `BOOKING_ISSUE_MESSAGE_CREATED`
- `PAYMENT_ATTENTION_REQUIRED`
- `CONTENT_REPORT_SUBMITTED`

## Current gaps / not yet implemented triggers

These notification types or scenarios exist conceptually but do not currently have full automatic trigger coverage:

- `NEARBY_DROP`
- `NEW_TRUCK_IN_AREA`
- `PROMOTION`
- `REVIEW`
- Some `ADMIN` scenarios such as photo shoot request and new food truck lead
- Push delivery for some notifications created through `createNotification()` directly, because that creates in-app DB notification only
- Vendor staff fan-out for booking/payment/vendor-business notifications
- Dedicated notification when a review is submitted or vendor responds to a review

## Frontend routing guidance

Use notification payload fields to route:

- `bookingId` → booking detail/tracking screen
- `foodTruckId` or food truck slug from included relation → food truck profile
- `postId` → social post detail/feed position
- `conversationId` → messaging conversation
- `metadata.paymentId` → payment/booking detail
- `metadata.redemptionId` or reward metadata → rewards screen
- `metadata.checkInId` → check-in/rewards screen

Backend DB notifications are the source of truth. Firebase push is only instant delivery.
