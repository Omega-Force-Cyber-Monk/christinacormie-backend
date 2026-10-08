# Notification Navigation Contract

এই document Flutter developer-এর জন্য। Backend এখন DB notification response এবং FCM push `data`—দুই জায়গাতেই same navigation keys পাঠায়।

## Main rule

App notification tap করলে আগে এই দুইটা key ব্যবহার করবে:

```json
{
  "entityType": "BOOKING",
  "entityId": "booking-id"
}
```

এর পাশাপাশি related direct IDs-ও থাকবে, যেমন:

```json
{
  "bookingId": "booking-id",
  "foodTruckId": "food-truck-id"
}
```

## Entity type mapping

| entityType            | Main ID key                           | কোন screen/open করবে                      |
| --------------------- | ------------------------------------- | ----------------------------------------- |
| `BOOKING`             | `bookingId`                           | Booking detail/tracking screen            |
| `CONVERSATION`        | `conversationId`                      | Chat conversation screen                  |
| `COMMUNITY_REQUEST`   | `communityRequestId`                  | Community request detail screen           |
| `BOOKING_ISSUE`       | `issueId`                             | Booking issue/messages screen             |
| `PAYMENT`             | `paymentId`                           | Payment/booking payment detail screen     |
| `REFUND`              | `refundId`                            | Refund/payment detail screen              |
| `VENDOR_VERIFICATION` | `verificationRequestId`               | Vendor verification/admin review screen   |
| `VENDOR`              | `vendorId`                            | Vendor profile/admin vendor detail screen |
| `FOOD_TRUCK`          | `foodTruckId`                         | Food truck profile screen                 |
| `PROMOTION`           | `promotionId`                         | Promotion detail screen                   |
| `REWARD_REDEMPTION`   | `rewardRedemptionId` / `redemptionId` | Reward redemption detail/history screen   |
| `REWARD`              | `rewardRuleId` / `rewardId`           | Rewards screen/detail                     |
| `CHECK_IN`            | `checkInId`                           | Check-in detail/history screen            |
| `BADGE`               | `badgeId`                             | Badge/rewards profile screen              |
| `POST`                | `postId`                              | Community/social post screen              |
| `REVIEW`              | `reviewId`                            | Review/moderation screen                  |
| `REPORT`              | `reportId`                            | Admin report/moderation screen            |
| `REFERRAL`            | `referralId` / `referralCode`         | Referral screen                           |

## Example DB response

```json
{
  "id": "notification-id",
  "type": "BOOKING",
  "title": "New booking request",
  "bookingId": "booking-id",
  "foodTruckId": "food-truck-id",
  "metadata": {
    "eventType": "BOOKING_CREATED",
    "entityType": "BOOKING",
    "entityId": "booking-id",
    "bookingId": "booking-id",
    "foodTruckId": "food-truck-id"
  }
}
```

## Example FCM push data

```json
{
  "notificationId": "notification-id",
  "type": "BOOKING",
  "eventType": "BOOKING_CREATED",
  "entityType": "BOOKING",
  "entityId": "booking-id",
  "bookingId": "booking-id",
  "foodTruckId": "food-truck-id"
}
```

## Important

- `GET /api/v1/notifications` returns an array.
- Old notifications that were created before this update will also receive `metadata.entityType` and `metadata.entityId` at response time when possible.
- FCM `data` values are always string values, which is required by Firebase.
- Chat/message notifications are throttled per recipient/thread. If multiple messages are sent in the same conversation or booking issue within the cooldown window, the message is still saved and emitted in realtime, but extra DB/push notifications are skipped to avoid notification spam.
