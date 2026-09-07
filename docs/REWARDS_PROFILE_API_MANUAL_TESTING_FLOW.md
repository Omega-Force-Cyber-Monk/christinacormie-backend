# Rewards/Profile API Manual Testing Flow

Use this document to manually test the latest rewards, QR check-in, profile summary, credit redemption, and point-award fixes.

## Base Setup

Base URL:

```text
http://localhost:3000
```

Swagger:

```http
GET /api/v1/docs
```

Required tokens:

```text
{{customerToken}}          Customer JWT
{{anotherCustomerToken}}   Second customer JWT, only needed for referral testing
{{vendorToken}}            Vendor JWT
{{adminToken}}             Admin JWT, only needed for referral qualification
```

Required IDs:

```text
{{foodTruckId}}     Active food truck ID
{{qrCode}}          Fixed food truck QR code
{{bookingId}}       Booking ID from booking create API
{{quoteId}}         Quote ID from vendor quote API
{{redemptionToken}} Token returned by redemption code API
{{backupCode}}      6-digit code returned by redemption code API
{{referralId}}      Referral ID returned by referral apply API
```

## Points Per Action

| Action | Expected Points |
| --- | ---: |
| QR code check-in | `+10` |
| Leave a verified review | `+25` |
| Follow a food truck | `+5` |
| Make a booking | `+100` |
| Community post/request | `+10` |
| Refer a friend | `+500` |
| Daily app streak | `+5` |
| Complete profile setup | `+50` |
| Birthday bonus | `+50` |

## Main Validation Rule

After every reward action, call:

```http
GET /api/v1/rewards/me/profile-summary
Authorization: Bearer {{customerToken}}
```

Use this API to verify:

- `loyalty.availablePoints`
- `loyalty.lifetimePoints`
- `loyalty.availableCreditAmount`
- `loyalty.currentTier`
- `loyalty.nextTier`
- `pointsPerAction`
- `recentActivity`

## 1. Get Customer Rewards/Profile Page

```http
GET /api/v1/rewards/me/profile-summary
Authorization: Bearer {{customerToken}}
```

Expected shape:

```json
{
  "profile": {
    "id": "customer-user-id",
    "name": "Alex Rivera",
    "email": "customer@example.com",
    "avatarUrl": null,
    "level": 1
  },
  "loyalty": {
    "availablePoints": 0,
    "lifetimePoints": 0,
    "redeemedPoints": 0,
    "availableCreditAmount": 0,
    "maxRedeemPerVisit": 5,
    "currentTier": {
      "slug": "foodie",
      "name": "Foodie",
      "requiredPoints": 0,
      "creditAmount": 0,
      "level": 1
    },
    "nextTier": {
      "slug": "explorer",
      "name": "Explorer",
      "requiredPoints": 500,
      "creditAmount": 5,
      "level": 2,
      "pointsRemaining": 500
    },
    "progress": {
      "current": 0,
      "target": 10000,
      "percentage": 0
    }
  },
  "tiers": [],
  "pointsPerAction": [],
  "recentActivity": [],
  "actions": {
    "canRedeem": false,
    "canInviteFriends": true,
    "canRequestTruck": true,
    "canManageSettings": true,
    "canOpenSupport": false
  }
}
```

## 2. Get Vendor Fixed QR Code

Use this if you do not already know `{{qrCode}}`.

```http
GET /api/v1/vendors/me/qr-code
Authorization: Bearer {{vendorToken}}
```

Save:

```text
qrCode -> {{qrCode}}
foodTruckId -> {{foodTruckId}}
```

## 3. QR Check-In Points

### 3.1 First Successful Check-In

```http
POST /api/v1/qr/{{qrCode}}/check-ins
Authorization: Bearer {{customerToken}}
Content-Type: application/json

{
  "latitude": 37.7749,
  "longitude": -122.4194,
  "locationAccuracyMeters": 10
}
```

Expected:

```json
{
  "experienceState": "NEW_USER",
  "pointsEarned": 10,
  "message": "Check-in complete! Earned +10 points."
}
```

Then verify profile summary:

```http
GET /api/v1/rewards/me/profile-summary
Authorization: Bearer {{customerToken}}
```

Expected point change:

```text
availablePoints +10
lifetimePoints +10
recentActivity includes QR/check-in activity
```

### 3.2 Repeat QR Check-In

Call the same check-in API again with same customer.

Expected:

```json
{
  "experienceState": "NOT_ELIGIBLE_FOR_CHECK_IN_POINTS",
  "pointsEarned": 0,
  "message": "You are not eligible for check-in points right now. First-time QR check-in points can only be earned once."
}
```

Expected point change:

```text
No new +10 points
```

## 4. Follow Food Truck Points

### 4.1 Follow Food Truck

```http
POST /api/v1/social/food-trucks/{{foodTruckId}}/follow
Authorization: Bearer {{customerToken}}
```

Expected point change:

```text
+5 once for this food truck
```

### 4.2 Unfollow Then Follow Again

```http
DELETE /api/v1/social/food-trucks/{{foodTruckId}}/follow
Authorization: Bearer {{customerToken}}
```

Then:

```http
POST /api/v1/social/food-trucks/{{foodTruckId}}/follow
Authorization: Bearer {{customerToken}}
```

Expected point change:

```text
No duplicate +5
```

## 5. Profile Completion Points

Profile completion gives `+50` once when required fields exist:

```text
name/displayName
email
dateOfBirth
```

```http
PATCH /api/v1/users/me/profile
Authorization: Bearer {{customerToken}}
Content-Type: application/json

{
  "displayName": "Alex Rivera",
  "email": "customer@example.com",
  "dateOfBirth": "1994-09-07"
}
```

Expected point change:

```text
+50 first time only
```

Call same API again.

Expected:

```text
No duplicate +50
```

## 6. Daily App Streak Points

```http
POST /api/v1/rewards/me/daily-streak
Authorization: Bearer {{customerToken}}
```

First call expected:

```json
{
  "awarded": true,
  "pointsEarned": 5,
  "message": "Daily app streak points added."
}
```

Second call same day expected:

```json
{
  "awarded": false,
  "message": "Daily app streak points already claimed today."
}
```

Expected point change:

```text
+5 once per calendar day
```

## 7. Birthday Bonus Points

Birthday bonus gives `+50` once per year only on the customer's birthday.

For manual testing, set `dateOfBirth` month/day to today's month/day first.

Example for September 7:

```http
PATCH /api/v1/users/me/profile
Authorization: Bearer {{customerToken}}
Content-Type: application/json

{
  "dateOfBirth": "1994-09-07"
}
```

Then claim:

```http
POST /api/v1/rewards/me/birthday-bonus
Authorization: Bearer {{customerToken}}
```

First call expected:

```json
{
  "awarded": true,
  "pointsEarned": 50,
  "message": "Birthday bonus points added."
}
```

Second call same year expected:

```json
{
  "awarded": false,
  "message": "Birthday bonus already claimed this year."
}
```

If date of birth is not today, expected:

```json
{
  "statusCode": 400,
  "message": "Birthday bonus is only available on your birthday"
}
```

## 8. Community Post/Request Points

```http
POST /api/v1/community/requests
Authorization: Bearer {{customerToken}}
Content-Type: application/json

{
  "requestType": "EVENT",
  "eventType": "CORPORATE_EVENT",
  "title": "Need a taco truck",
  "description": "Office lunch food truck request",
  "eventDate": "2026-10-25T00:00:00.000Z",
  "startTime": "12:00",
  "endTime": "14:00",
  "guestCount": 50,
  "address": "500 Castro St, San Francisco, CA",
  "contactPhone": "+15551234567",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "allowPublicComments": true
}
```

Expected point change:

```text
+10 for created public community request
```

## 9. Direct Booking Points

### 9.1 Customer Creates Booking

```http
POST /api/v1/bookings
Authorization: Bearer {{customerToken}}
Content-Type: application/json

{
  "foodTruckId": "{{foodTruckId}}",
  "bookingType": "EVENT",
  "eventType": "CORPORATE_EVENT",
  "eventName": "Office Lunch",
  "eventDescription": "Lunch event",
  "startsAt": "2026-10-25T12:00:00.000Z",
  "endsAt": "2026-10-25T14:00:00.000Z",
  "guestCount": 50,
  "address": "500 Castro St, San Francisco, CA",
  "contactPhone": "+15551234567",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "paymentPreference": "NO_PREFERENCE"
}
```

Save response:

```text
id -> {{bookingId}}
```

### 9.2 Vendor Accepts Booking

```http
PATCH /api/v1/bookings/{{bookingId}}/accept
Authorization: Bearer {{vendorToken}}
Content-Type: application/json

{
  "reason": "Confirmed availability"
}
```

Expected point change for customer:

```text
+100 once for this booking
```

## 10. Quote Booking Points

Use this if your booking goes through quote flow.

### 10.1 Vendor Creates Quote

```http
POST /api/v1/bookings/{{bookingId}}/quotes
Authorization: Bearer {{vendorToken}}
Content-Type: application/json

{
  "pricingModel": "FLAT_FEE",
  "selectedMenuItems": ["Tacos", "Drinks"],
  "baseServiceFee": 500,
  "transportFee": 25,
  "subtotal": 525,
  "outsideRadiusFee": 0,
  "serviceFee": 0,
  "taxAmount": 0,
  "discountAmount": 0,
  "paymentPreference": "NO_PREFERENCE",
  "depositAmount": 0,
  "depositPercent": 0,
  "totalAmount": 525,
  "message": "We can serve this event",
  "expiresAt": "2026-10-01T12:00:00.000Z"
}
```

Save response:

```text
id -> {{quoteId}}
```

### 10.2 Customer Accepts Quote

```http
PATCH /api/v1/bookings/quotes/{{quoteId}}/accept
Authorization: Bearer {{customerToken}}
Content-Type: application/json

{
  "paymentWindowMinutes": 30
}
```

Expected point change:

```text
+100 once for this booking
```

## 11. Credit Redemption

### 11.1 Create Redemption Code

Customer must have enough tier-based credit.

```http
POST /api/v1/rewards/me/redemption-codes
Authorization: Bearer {{customerToken}}
Content-Type: application/json

{
  "amount": 5,
  "foodTruckId": "{{foodTruckId}}"
}
```

Expected:

```json
{
  "redemptionId": "redemption-id",
  "redemptionToken": "rdm_123456_xxxx",
  "backupCode": "123456",
  "amount": 5,
  "pointsSpent": 500,
  "status": "PENDING"
}
```

Save:

```text
redemptionToken -> {{redemptionToken}}
backupCode -> {{backupCode}}
```

Expected point change:

```text
availablePoints -500 immediately
redeemedPoints +500 immediately
```

### 11.2 Over Max Per Visit

```http
POST /api/v1/rewards/me/redemption-codes
Authorization: Bearer {{customerToken}}
Content-Type: application/json

{
  "amount": 10,
  "foodTruckId": "{{foodTruckId}}"
}
```

Expected:

```json
{
  "statusCode": 400,
  "message": "Maximum redemption per visit is $5."
}
```

### 11.3 Vendor Confirms by Manual Code

```http
POST /api/v1/vendors/me/redemptions/confirm
Authorization: Bearer {{vendorToken}}
Content-Type: application/json

{
  "manualCode": "{{backupCode}}"
}
```

Expected:

```json
{
  "success": true,
  "amountApplied": 5,
  "customerName": "Alex Rivera",
  "remainingCustomerBalance": 0,
  "message": "Redemption Complete. $5.00 credit applied for Alex Rivera."
}
```

### 11.4 Vendor Confirms by QR Token

Alternative to manual code:

```http
POST /api/v1/vendors/me/redemptions/confirm
Authorization: Bearer {{vendorToken}}
Content-Type: application/json

{
  "redemptionToken": "{{redemptionToken}}"
}
```

Expected:

```text
Same success response as manual code.
```

### 11.5 Confirm Same Code Again

Call vendor confirm again with same `manualCode` or `redemptionToken`.

Expected:

```json
{
  "statusCode": 404,
  "message": "Invalid or expired redemption code"
}
```

### 11.6 Wrong Vendor Confirmation

Use a different vendor token for a redemption code generated with `foodTruckId` belonging to another vendor.

Expected:

```json
{
  "statusCode": 400,
  "message": "This redemption code was generated for another food truck"
}
```

## 12. Referral Points

### 12.1 Customer Creates Referral Code

```http
POST /api/v1/referrals/codes
Authorization: Bearer {{customerToken}}
Content-Type: application/json

{
  "programType": "CUSTOMER",
  "code": "ALEX500",
  "maximumUses": 50,
  "expiresAt": "2026-12-31T23:59:59.000Z"
}
```

### 12.2 Another Customer Applies Referral Code

```http
POST /api/v1/referrals/apply
Authorization: Bearer {{anotherCustomerToken}}
Content-Type: application/json

{
  "code": "ALEX500"
}
```

Save response:

```text
id -> {{referralId}}
```

### 12.3 Admin Qualifies Referral

```http
PATCH /api/v1/admin/referrals/{{referralId}}/qualify
Authorization: Bearer {{adminToken}}
```

Expected point change for original referrer:

```text
+500
```

## 13. Review Points

Current limitation:

```text
Review still requires bookingId and booking.status = COMPLETED.
Direct review after QR check-in is not implemented yet.
```

If you already have a completed booking:

```http
POST /api/v1/reviews
Authorization: Bearer {{customerToken}}
Content-Type: application/json

{
  "bookingId": "{{bookingId}}",
  "rating": 5,
  "title": "Great food",
  "content": "Amazing service and food."
}
```

Expected point change:

```text
+25
```

## 14. Final Full Page Check

```http
GET /api/v1/rewards/me/profile-summary
Authorization: Bearer {{customerToken}}
```

Confirm:

- points match all completed actions
- `availableCreditAmount` respects current tier cap
- `maxRedeemPerVisit` is `5`
- tiers are correct
- recent activity shows meaningful entries
- duplicate actions did not add duplicate points

## Known Limitation

The only remaining known mismatch with the Figma flow is direct review after QR check-in.

Current backend review model requires:

```text
bookingId
booking.status = COMPLETED
```

To fully match Figma, backend needs a separate implementation where customer can review a food truck after verified check-in, using `checkInId` or `foodTruckId`.
