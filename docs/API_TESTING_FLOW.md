# BiteDrop API Testing Flow

This guide explains the practical order for testing the APIs. Test in this order because later modules depend on IDs, tokens, statuses, and records created by earlier modules.

Related docs:

```text
Notification end-to-end testing: docs/NOTIFICATION_TESTING_FLOW.md
Frontend notification integration handoff: docs/FRONTEND_NOTIFICATION_INTEGRATION_PROMPT.md
```

Base URL:

```text
http://localhost:3000
```

Swagger:

```text
GET /
GET /api/v1/docs
```

Use these variables in Postman/Insomnia:

```text
{{baseUrl}} = http://localhost:3000
{{customerEmailVerificationCode}}
{{vendorEmailVerificationCode}}
{{customerDeviceTokenId}}
{{vendorDeviceTokenId}}
{{customerToken}}
{{vendorToken}}
{{adminToken}}
{{customerId}}
{{vendorUserId}}
{{vendorId}}
{{foodTruckId}}
{{foodTruckSlug}}
{{qrCode}}
{{qrScanId}}
{{postId}}
{{promotionId}}
{{communityRequestId}}
{{vendorOfferId}}
{{bookingId}}
{{quoteId}}
{{paymentId}}
{{reviewId}}
{{rewardRuleId}}
{{badgeId}}
{{referralCode}}
{{referralId}}
{{notificationId}}
{{leaderboardId}}
```

Headers for protected APIs:

```text
Authorization: Bearer {{token}}
Content-Type: application/json
```

## 0. Before Testing

1. Make sure the app is running.
2. Make sure database migrations are applied.
3. Make sure PostGIS is enabled in PostgreSQL/Neon:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

4. You need three users:
   - Customer user
   - Vendor user
   - Admin user

There is no public admin registration flow. Use a seeded admin account or assign `ADMIN` role in the database.

## 1. Auth First

These APIs create your tokens. Nothing else should be tested before this.

### 1.1 Register Customer

```http
POST {{baseUrl}}/api/v1/auth/register/customer
```

```json
{
  "email": "customer1@example.com",
  "password": "Password123!",
  "dateOfBirth": "1998-05-20",
  "phone": "+12025550143",
  "firstName": "John",
  "lastName": "Customer",
  "displayName": "John Customer",
  "timezone": "America/New_York"
}
```

Save:

```text
email -> customer1@example.com
status -> PENDING
```

Important:

```text
Registration no longer returns accessToken immediately.
It now creates a pending account and sends/logs a 6-digit verification code.
```

### 1.2 Verify Customer Email

```http
POST {{baseUrl}}/api/v1/auth/verify-email
```

```json
{
  "email": "customer1@example.com",
  "code": "{{customerEmailVerificationCode}}"
}
```

Save:

```text
accessToken -> {{customerToken}}
refreshToken
user.id -> {{customerId}}
```

If code expires, test resend:

```http
POST /api/v1/auth/resend-verification-code
```

```json
{
  "email": "customer1@example.com"
}
```

### 1.3 Register Vendor

```http
POST {{baseUrl}}/api/v1/auth/register/vendor
```

Minimal required payload:

```json
{
  "email": "vendor1@example.com",
  "phone": "+12025550199",
  "password": "Password123!"
}
```

Optional signup payload fields:

```json
{
  "email": "vendor1@example.com",
  "phone": "+12025550199",
  "password": "Password123!",
  "businessName": "Tasty Tacos Food Truck",
  "businessEmail": "contact@tastytacos.com",
  "businessPhone": "+12025550199",
  "description": "Best gourmet tacos in town",
  "websiteUrl": "https://tastytacos.example.com",
  "firstName": "Jane",
  "lastName": "Vendor",
  "displayName": "Jane Vendor",
  "timezone": "America/New_York"
}
```

Save:

```text
email -> vendor1@example.com
status -> PENDING
```

### 1.4 Verify Vendor Email

```http
POST {{baseUrl}}/api/v1/auth/verify-email
```

```json
{
  "email": "vendor1@example.com",
  "code": "{{vendorEmailVerificationCode}}"
}
```

Save:

```text
accessToken -> {{vendorToken}}
refreshToken
user.id -> {{vendorUserId}}
vendor.id -> {{vendorId}}
```

If code expires, test resend:

```http
POST /api/v1/auth/resend-verification-code
```

```json
{
  "email": "vendor1@example.com"
}
```

### 1.5 Login Admin

```http
POST {{baseUrl}}/api/v1/auth/login
```

```json
{
  "email": "admin@example.com",
  "password": "Password123!"
}
```

Save:

```text
accessToken -> {{adminToken}}
```

### 1.6 Token Refresh And Logout

Test after login works.

```http
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
```

Dependency:

```text
refresh requires refreshToken.
logout requires auth token.
```

## 2. User Profile, Interests And Preferences

Use `{{customerToken}}` and `{{vendorToken}}`.

```http
GET /api/v1/users/me
GET /api/v1/users/interest-cuisines
PATCH /api/v1/users/me/interests
POST /api/v1/users/me/device-tokens
DELETE /api/v1/users/me/device-tokens/{{deviceTokenId}}
PATCH /api/v1/users/me/profile
PATCH /api/v1/users/me/settings
PATCH /api/v1/users/me/notification-preferences
PATCH /api/v1/users/me/deactivate
```

Recommended first-login onboarding flow for customer:

1. Login or verify email.
2. Call `GET /api/v1/users/interest-cuisines`.
3. Show the cuisine list in UI.
4. Submit selected items to `PATCH /api/v1/users/me/interests`.
5. Confirm saved values from `GET /api/v1/users/me`.

Example interest save body:

```json
{
  "cuisineIds": [
    "{{cuisineId1}}",
    "{{cuisineId2}}"
  ]
}
```

Example device token registration:

```json
{
  "token": "customer-fcm-test-token",
  "platform": "WEB",
  "deviceId": "customer-web-test"
}
```

Recommended notification setup after login:

1. Login or verify email.
2. Register a device token with `POST /api/v1/users/me/device-tokens`.
3. Trigger a business event later in the flow.
4. Check `GET /api/v1/notifications`.
5. Check `GET /api/v1/notifications/unread-count`.

Example notification preferences:

```json
{
  "nearbyDropAlerts": true,
  "followedTruckUpdates": true,
  "favoriteTruckAlerts": true,
  "promotionAlerts": true,
  "bookingAlerts": true,
  "paymentAlerts": true,
  "messageAlerts": true,
  "rewardAlerts": true,
  "checkInAlerts": true,
  "marketingAlerts": false
}
```

Admin user status management:

```http
PATCH /api/v1/admin/users/{{customerId}}/account-status
```

```json
{
  "status": "ACTIVE"
}
```

## 3. Vendor Onboarding

Use `{{vendorToken}}` first, then `{{adminToken}}`.

### 3.1 Get Vendor Profile

```http
GET /api/v1/vendors/me
```

Save:

```text
id -> {{vendorId}}
```

### 3.2 Update Vendor Business Profile

```http
PATCH /api/v1/vendors/me
```

```json
{
  "businessName": "Tasty Tacos Food Truck",
  "businessEmail": "contact@tastytacos.com",
  "businessPhone": "+12025550199",
  "description": "Authentic tacos and fresh salsa",
  "websiteUrl": "https://tastytacos.example.com"
}
```

Before document submission, make sure the vendor state exists on the user profile. The verification requirement set is detected from `user.profile.state`.

```http
PATCH /api/v1/users/me/profile
```

Texas example:

```json
{
  "city": "Austin",
  "state": "TX",
  "country": "USA"
}
```

### 3.3 Submit Verification Documents

Call `GET /api/v1/vendors/me` first. The response now includes `verificationRequirements` so the frontend can show the correct document list automatically.

```http
POST /api/v1/vendors/me/verification-requests
```

Texas vendor required documents:

```json
{
  "documents": [
    {
      "type": "DSHS_MOBILE_FOOD_VENDOR_LICENSE",
      "url": "https://example.com/dshs-license.pdf"
    },
    {
      "type": "FOOD_MANAGER_CERTIFICATION",
      "url": "https://example.com/food-manager-certification.pdf"
    },
    {
      "type": "CERTIFICATE_OF_INSURANCE",
      "url": "https://example.com/certificate-of-insurance.pdf"
    }
  ],
  "notes": "Ready for approval"
}
```

Non-Texas vendor required documents:

```json
{
  "documents": [
    {
      "type": "STATE_OR_LOCAL_FOOD_VENDOR_PERMIT",
      "url": "https://example.com/state-food-permit.pdf"
    },
    {
      "type": "FOOD_MANAGER_CERTIFICATION",
      "url": "https://example.com/food-manager-certification.pdf"
    },
    {
      "type": "CERTIFICATE_OF_INSURANCE",
      "url": "https://example.com/certificate-of-insurance.pdf"
    }
  ],
  "notes": "Ready for approval"
}
```

Expected response includes:

```text
message = Thank you for submitting your documents. Our team will review and get back to you shortly.
vendor.status = PENDING_APPROVAL
```

### 3.4 Admin Reviews Vendor

```http
GET /api/v1/admin/vendors/pending-approval
GET /api/v1/admin/verification-requests
PATCH /api/v1/admin/vendors/{{vendorId}}/approve
PATCH /api/v1/admin/vendors/{{vendorId}}/reject
```

Approve should make vendor verified and can generate QR codes for existing trucks. If no truck exists yet, QR code will be generated later after approval flow has a truck to attach to.

Reject body:

```json
{
  "rejectionReason": "Documents are not readable"
}
```

## 4. Food Truck Core Setup

Use `{{vendorToken}}`.

Important dependency:

```text
Bookings, discovery, promotions, posts, QR/check-in, and leaderboards all need a food truck.
```

### 4.1 Get Cuisine List

```http
GET /api/v1/food-trucks/cuisines
```

Save cuisine IDs if the API returns them.

### 4.2 Create Draft Truck

```http
POST /api/v1/food-trucks/draft
```

```json
{
  "name": "Tasty Tacos Express",
  "description": "Authentic gourmet street tacos and fresh salsas",
  "profileImageUrl": "https://cdn.example.com/tasty-profile.jpg",
  "coverImageUrl": "https://cdn.example.com/tasty-cover.jpg",
  "minimumBookingAmount": 300,
  "maximumGuestCapacity": 100
}
```

Save:

```text
id -> {{foodTruckId}}
slug -> {{foodTruckSlug}}
```

### 4.3 Update Draft Truck

```http
PATCH /api/v1/food-trucks/{{foodTruckId}}/draft
```

### 4.4 Basic Menu Setup

```http
POST /api/v1/food-trucks/{{foodTruckId}}/menus/basic
```

Then test:

```http
POST /api/v1/food-trucks/{{foodTruckId}}/menus/{{menuId}}/categories
PATCH /api/v1/food-trucks/{{foodTruckId}}/menu-categories/{{categoryId}}
POST /api/v1/food-trucks/{{foodTruckId}}/menu-categories/{{categoryId}}/items
PATCH /api/v1/food-trucks/{{foodTruckId}}/menu-items/{{itemId}}
```

### 4.5 Service Area

```http
PATCH /api/v1/food-trucks/{{foodTruckId}}/service-area
```

```json
{
  "name": "Austin Downtown",
  "centerAddress": "100 Congress Ave, Austin, TX 78701",
  "latitude": 30.2672,
  "longitude": -97.7431,
  "radiusKm": 20,
  "outsideRadiusAllowed": true,
  "outsideRadiusFee": 50
}
```

This is required before testing bookings and service-area validation.

### 4.6 Guest Capacity

```http
PATCH /api/v1/food-trucks/{{foodTruckId}}/guest-capacity
```

```json
{
  "maximumGuestCapacity": 100
}
```

### 4.7 Operating Status

```http
PATCH /api/v1/food-trucks/{{foodTruckId}}/operating-status
```

```json
{
  "operatingStatus": "OPEN"
}
```

### 4.8 Live Location

```http
PATCH /api/v1/food-trucks/{{foodTruckId}}/location
```

```json
{
  "latitude": 30.2672,
  "longitude": -97.7431,
  "address": "100 Congress Ave, Austin, TX 78701",
  "validForMinutes": 180
}
```

This is required before nearby discovery, active drops, and QR check-in location verification.

### 4.9 Create Drop

```http
POST /api/v1/food-trucks/{{foodTruckId}}/drops
```

Test public drop APIs after this:

```http
GET /api/v1/food-trucks/drops/nearby?latitude=30.2672&longitude=-97.7431&radiusKm=10
GET /api/v1/food-trucks/drops/today
```

### 4.10 Images And Availability

```http
POST /api/v1/food-trucks/{{foodTruckId}}/images
PATCH /api/v1/food-trucks/{{foodTruckId}}/images/{{imageId}}
DELETE /api/v1/food-trucks/{{foodTruckId}}/images/{{imageId}}
POST /api/v1/food-trucks/{{foodTruckId}}/availability-exceptions
PATCH /api/v1/food-trucks/{{foodTruckId}}/availability-exceptions/{{exceptionId}}
```

### 4.11 Public Profile

```http
GET /api/v1/food-trucks/profile/{{foodTruckSlug}}
```

## 5. Discovery

Use public access unless the endpoint requires auth.

Dependency:

```text
Truck should have live location and active/open status for best results.
```

```http
GET /api/v1/discovery/nearby?latitude=30.2672&longitude=-97.7431&radiusKm=10
GET /api/v1/discovery/trending
```

Also test filters if supported:

```text
openOnly=true
cuisineId={{cuisineId}}
search=Tacos
city=Austin
```

## 6. Social, Follow, Favorite, Feed

Use `{{customerToken}}` for customer actions and `{{vendorToken}}` for vendor posts.

### 6.1 Customer Follows/Favorites Truck

```http
POST /api/v1/social/food-trucks/{{foodTruckId}}/follow
PATCH /api/v1/social/food-trucks/{{foodTruckId}}/follow/notifications
POST /api/v1/social/food-trucks/{{foodTruckId}}/favorite
```

Notification toggle body:

```json
{
  "notificationsEnabled": true
}
```

### 6.2 Vendor Creates Post

```http
POST /api/v1/social/posts
```

```json
{
  "foodTruckId": "{{foodTruckId}}",
  "content": "We are live downtown today!",
  "status": "PUBLISHED",
  "isPromotion": false,
  "isFollowerOnly": false,
  "media": []
}
```

Save:

```text
id -> {{postId}}
```

This should create followed/favorite truck notifications.

### 6.3 Customer Interacts With Post

```http
POST /api/v1/social/posts/{{postId}}/like
POST /api/v1/social/posts/{{postId}}/comments
POST /api/v1/social/posts/{{postId}}/save
GET /api/v1/social/feed/following
```

Comment body:

```json
{
  "content": "Looks great!"
}
```

Cleanup:

```http
DELETE /api/v1/social/food-trucks/{{foodTruckId}}/follow
DELETE /api/v1/social/food-trucks/{{foodTruckId}}/favorite
```

## 7. Promotions

Use `{{vendorToken}}` to create and analytics. Use `{{customerToken}}` to redeem.

```http
POST /api/v1/promotions
```

```json
{
  "foodTruckId": "{{foodTruckId}}",
  "title": "20% OFF Summer Special",
  "description": "Get 20% off your order.",
  "type": "PERCENTAGE",
  "value": 20,
  "couponCode": "SUMMER20",
  "minimumSpend": 25,
  "maximumDiscount": 10,
  "isFollowerOnly": false,
  "usageLimit": 100,
  "startsAt": "2026-08-01T00:00:00.000Z",
  "endsAt": "2026-08-31T23:59:59.000Z",
  "isActive": true
}
```

Save:

```text
id -> {{promotionId}}
```

Then test:

```http
GET /api/v1/promotions/food-trucks/{{foodTruckId}}
POST /api/v1/promotions/{{promotionId}}/redeem
GET /api/v1/promotions/{{promotionId}}/analytics
```

Redemption should prevent duplicate redemption by the same user.

## 8. Community Requests

Use `{{customerToken}}` to create request. Use `{{vendorToken}}` to offer.

### 8.1 Public Request

```http
POST /api/v1/community/requests
```

```json
{
  "requestType": "NEIGHBORHOOD",
  "title": "Need tacos for block party",
  "description": "Looking for a truck for 75 guests.",
  "eventDate": "2026-08-25T00:00:00.000Z",
  "startTime": "17:00",
  "endTime": "20:00",
  "eventTimezone": "America/Chicago",
  "guestCount": 75,
  "budgetMin": 300,
  "budgetMax": 800,
  "address": "2500 Maple Ave, Austin, TX 78702",
  "latitude": 30.2672,
  "longitude": -97.7431,
  "preferredCuisines": ["Mexican", "Tacos"],
  "allowPublicComments": true,
  "expiresAt": "2026-08-24T23:59:59.000Z"
}
```

Save:

```text
id -> {{communityRequestId}}
```

### 8.2 Private Truck Request

```http
POST /api/v1/community/food-trucks/{{foodTruckId}}/requests
```

### 8.3 Media, Comments, Reactions

```http
POST /api/v1/community/requests/{{communityRequestId}}/media
POST /api/v1/community/requests/{{communityRequestId}}/comments
POST /api/v1/community/requests/{{communityRequestId}}/reactions
```

### 8.4 Vendor Offer

```http
POST /api/v1/community/requests/{{communityRequestId}}/offers
```

```json
{
  "foodTruckId": "{{foodTruckId}}",
  "message": "We can serve this event.",
  "quotedAmount": 650,
  "serviceFee": 50,
  "expiresAt": "2026-08-24T23:59:59.000Z"
}
```

Save:

```text
id -> {{vendorOfferId}}
```

Then test:

```http
PATCH /api/v1/community/offers/{{vendorOfferId}}/accept
PATCH /api/v1/community/offers/{{vendorOfferId}}/reject
PATCH /api/v1/community/offers/{{vendorOfferId}}/withdraw
POST /api/v1/community/new-food-truck-leads
```

## 9. Requests, Quotes, And Orders

Use `{{customerToken}}` for customer request creation and offer acceptance. Use `{{vendorToken}}` for vendor quote submission.

Dependency:

```text
Truck must be active.
Vendor should already be approved and onboarded.
```

### 9.1 Create Need-A-Truck Request

```http
POST /api/v1/community/requests
```

```json
{
  "requestType": "EVENT",
  "eventType": "CORPORATE_EVENT",
  "title": "Corporate Lunch Catering Request",
  "description": "Lunch for employees",
  "eventDate": "2026-08-25T00:00:00.000Z",
  "startTime": "18:00",
  "endTime": "21:00",
  "eventTimezone": "America/Chicago",
  "guestCount": 50,
  "address": "100 Congress Ave, Austin, TX 78701",
  "contactPhone": "+12025550143",
  "latitude": 30.2672,
  "longitude": -97.7431,
  "budgetMin": 500,
  "budgetMax": 800,
  "preferredMenuItems": [
    "Tacos",
    "Caesar Salad Cups"
  ],
  "media": [
    {
      "mediaUrl": "https://res.cloudinary.com/demo/image/upload/v1/bitedrop/bookings/reference-1.jpg",
      "mediaType": "IMAGE"
    }
  ],
  "allowPublicComments": true
}
```

Save:

```text
id -> {{communityRequestId}}
```

This should create the customer request that vendors can quote against.

### 9.2 Vendor Creates Quote

```http
POST /api/v1/community/requests/{{communityRequestId}}/offers
```

```json
{
  "foodTruckId": "{{foodTruckId}}",
  "pricingModel": "FLAT_FEE",
  "selectedMenuItems": [
    "Burger",
    "Caesar Salad Cups",
    "Garlic Breadsticks"
  ],
  "baseServiceFee": 1200,
  "transportFee": 50,
  "serviceFee": 0,
  "taxAmount": 30,
  "discountAmount": 0,
  "quotedAmount": 1280,
  "paymentPreference": "DEPOSIT_ONLY",
  "depositAmount": 240,
  "depositPercent": 20,
  "noteToClient": "Menu includes setup and serving station.",
  "message": "Quote for full catering service",
  "expiresAt": "2026-08-25T16:00:00.000Z"
}
```

Save:

```text
quote.id -> {{quoteId}}
```

### 9.3 Customer Accepts Quote And Booking Is Created

```http
PATCH /api/v1/community/offers/{{quoteId}}/accept
```

This should:

```text
mark offer ACCEPTED
mark request MATCHED
create booking/order in PAYMENT_PENDING
create a booking hold
```

Save:

```text
booking.id -> {{bookingId}}
```

## 10. Payments

Use Stripe test credentials if configured.

### 10.1 Vendor Connect Account

```http
POST /api/v1/payments/connect/accounts
GET /api/v1/payments/connect/account
GET /api/v1/payments/payouts/mine
```

Connect body:

```json
{
  "country": "US"
}
```

### 10.2 Customer Creates Payment Intent

```http
POST /api/v1/payments/bookings/{{bookingId}}/payment-intent
```

```json
{
  "idempotencyKey": "booking-{{bookingId}}-payment-1",
  "currency": "USD"
}
```

Save:

```text
payment.id -> {{paymentId}}
clientSecret
```

### 10.3 Payment Detail And Refund

```http
GET /api/v1/payments/{{paymentId}}
POST /api/v1/payments/{{paymentId}}/refunds
```

Refund body:

```json
{
  "amount": 100,
  "reason": "requested_by_customer"
}
```

### 10.4 Stripe Webhook

```http
POST /api/v1/payments/webhooks/stripe
```

This endpoint expects raw Stripe webhook body and signature. Test with Stripe CLI later.

Payment success should:

```text
booking -> CONFIRMED
payment -> SUCCEEDED
commission -> created
payout -> pending
notifications -> customer and vendor
```

## 11. Reviews

Use `{{customerToken}}` to create report. Use `{{vendorToken}}` to respond. Use `{{adminToken}}` to moderate.

Dependency:

```text
Booking must be COMPLETED before review creation. If there is no complete endpoint yet, manually set booking status in DB only for testing review eligibility.
```

```http
POST /api/v1/reviews
```

```json
{
  "bookingId": "{{bookingId}}",
  "rating": 5,
  "title": "Great tacos",
  "content": "Food and setup were excellent."
}
```

Save:

```text
id -> {{reviewId}}
```

Then test:

```http
PATCH /api/v1/reviews/{{reviewId}}/vendor-response
POST /api/v1/reviews/{{reviewId}}/reports
PATCH /api/v1/reviews/reports/{{reportId}}
PATCH /api/v1/reviews/{{reviewId}}/moderation
PATCH /api/v1/admin/reviews/{{reviewId}}/moderation
```

## 12. QR And Check-In

Dependency:

```text
Vendor must be approved.
Food truck must have QR code.
Food truck must have current live location.
Customer must be near truck location.
```

Get QR code from vendor approval response or DB/admin detail.

```http
GET /api/v1/qr/{{qrCode}}/profile
POST /api/v1/qr/{{qrCode}}/scans
POST /api/v1/qr/{{qrCode}}/scans/authenticated
POST /api/v1/qr/{{qrCode}}/check-ins
GET /api/v1/check-ins/food-trucks/{{foodTruckId}}/qr-analytics
```

Scan body:

```json
{
  "anonymousSessionId": "session-123",
  "latitude": 30.2672,
  "longitude": -97.7431,
  "openedProfile": true
}
```

Save authenticated scan:

```text
id -> {{qrScanId}}
```

Check-in body:

```json
{
  "qrScanId": "{{qrScanId}}",
  "latitude": 30.2672,
  "longitude": -97.7431,
  "locationAccuracyMeters": 25,
  "deviceId": "iphone-test-device"
}
```

This should:

```text
create check-in
verify distance
prevent duplicate check-in
award loyalty points if verified
create notification
increment foodTruck.totalCheckIns
```

## 13. Rewards, Badges, Referrals

Use admin for configuration. Use customer/vendor for normal flows.

### 13.1 Loyalty Account

```http
GET /api/v1/rewards/me/loyalty
GET /api/v1/rewards/rules
GET /api/v1/badges
GET /api/v1/rewards/me/badges
GET /api/v1/rewards/me/vendor-badges
```

### 13.2 Admin Reward Rule

```http
POST /api/v1/admin/rewards/rules
PATCH /api/v1/admin/rewards/rules/{{rewardRuleId}}
```

Example points rule:

```json
{
  "name": "Check-in points",
  "triggerType": "CHECK_IN",
  "rewardType": "POINTS",
  "rewardValue": 10,
  "isActive": true
}
```

Example redeemable reward:

```json
{
  "name": "$5 Food Credit",
  "triggerType": "REDEMPTION",
  "rewardType": "CREDIT",
  "pointsRequired": 100,
  "rewardValue": 5,
  "maximumUsesPerUser": 1,
  "isActive": true
}
```

### 13.3 Redeem Reward

```http
POST /api/v1/rewards/redeem
```

```json
{
  "rewardRuleId": "{{rewardRuleId}}"
}
```

### 13.4 Badges

```http
POST /api/v1/admin/badges
POST /api/v1/admin/users/{{customerId}}/badges
POST /api/v1/admin/vendors/{{vendorId}}/badges
```

Create badge:

```json
{
  "name": "First Check-In",
  "slug": "first-check-in",
  "description": "Awarded after first verified check-in",
  "ownerType": "CUSTOMER",
  "glowColor": "#00AA55",
  "criteria": {
    "checkIns": 1
  },
  "isActive": true
}
```

Save:

```text
id -> {{badgeId}}
```

Award badge:

```json
{
  "badgeId": "{{badgeId}}",
  "awardedReason": "Manual admin award for testing"
}
```

### 13.5 Referrals

Customer or vendor creates a referral code:

```http
POST /api/v1/referrals/codes
GET /api/v1/referrals/codes
```

```json
{
  "programType": "CUSTOMER",
  "code": "JOHNREF",
  "maximumUses": 10,
  "expiresAt": "2026-12-31T23:59:59.000Z"
}
```

Save:

```text
code -> {{referralCode}}
```

Different user applies code:

```http
POST /api/v1/referrals/apply
```

```json
{
  "code": "{{referralCode}}"
}
```

Save:

```text
id -> {{referralId}}
```

Admin qualifies referral:

```http
PATCH /api/v1/admin/referrals/{{referralId}}/qualify
```

This should award referral points and create notifications.

## 14. Notifications

Use any authenticated user after actions above generate notifications.

Important:

```text
Push notifications depend on device token registration.
In-app notifications come from the database and APIs below.
```

Register device/browser token first if you want to test push-enabled flow:

```http
POST /api/v1/users/me/device-tokens
```

Customer example:

```json
{
  "token": "customer-fcm-test-token",
  "platform": "WEB",
  "deviceId": "customer-web-test"
}
```

Vendor example:

```json
{
  "token": "vendor-fcm-test-token",
  "platform": "ANDROID",
  "deviceId": "vendor-android-test"
}
```

```http
GET /api/v1/notifications
GET /api/v1/notifications?unreadOnly=true&limit=20
GET /api/v1/notifications?unreadOnly=true&limit=20&offset=0
GET /api/v1/notifications/unread-count
PATCH /api/v1/notifications/{{notificationId}}/read
PATCH /api/v1/notifications/read-all
DELETE /api/v1/users/me/device-tokens/{{deviceTokenId}}
```

Notifications are created by:

```text
vendor post -> followers/favorites
booking create/update/quote
payment updates
reward points/redemption
referral qualification
badge awards
check-in updates
```

First-phase push-oriented notification events currently emphasized:

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

Recommended quick notification verification:

1. Register a device token.
2. Trigger a booking or social post event.
3. Check `GET /api/v1/notifications`.
4. Save `id -> {{notificationId}}`.
5. Check `GET /api/v1/notifications/unread-count`.
6. Mark it read.
7. Check unread count again.

For full cross-platform testing details:

```text
See docs/NOTIFICATION_TESTING_FLOW.md
```

## 15. Leaderboards And Analytics

### 15.1 Leaderboards

Public endpoints:

```http
GET /api/v1/leaderboards
GET /api/v1/leaderboards/{{leaderboardId}}
GET /api/v1/leaderboards/top-rated
GET /api/v1/leaderboards/most-booked
GET /api/v1/leaderboards/most-visited
GET /api/v1/leaderboards/trending
```

Query examples:

```text
?marketId={{marketId}}&period=WEEKLY&limit=20&offset=0
```

Admin leaderboard configuration:

```http
GET /api/v1/admin/leaderboard-rules
POST /api/v1/admin/leaderboard-rules
PATCH /api/v1/admin/leaderboard-rules/{{ruleId}}
GET /api/v1/admin/leaderboards
```

Rule body:

```json
{
  "type": "TRENDING",
  "period": "WEEKLY",
  "bookingWeight": 1,
  "ratingWeight": 1,
  "reliabilityWeight": 1,
  "engagementWeight": 1,
  "checkInWeight": 1,
  "minimumCompletedBookings": 0,
  "algorithmVersion": "v1",
  "isActive": true
}
```

### 15.2 Vendor Dashboard Analytics

```http
GET /api/v1/vendors/me/analytics
```

Should only return analytics for the authenticated vendor.

### 15.3 Admin Analytics

```http
GET /api/v1/admin/analytics/overview
GET /api/v1/admin/analytics/bookings
GET /api/v1/admin/analytics/payments
GET /api/v1/admin/analytics/vendors
```

Test after enough data exists:

```text
users
vendors
food trucks
bookings
payments
commissions
refunds
reviews
community requests
check-ins
```

## 16. Admin Monitoring And Configuration

Use `{{adminToken}}`.

```http
GET /api/v1/admin/users
GET /api/v1/admin/users/{{customerId}}
PATCH /api/v1/admin/users/{{customerId}}/account-status
GET /api/v1/admin/vendors
GET /api/v1/admin/vendors/{{vendorId}}
GET /api/v1/admin/verification-requests
GET /api/v1/admin/food-trucks
GET /api/v1/admin/food-trucks/{{foodTruckId}}
PATCH /api/v1/admin/food-trucks/{{foodTruckId}}
GET /api/v1/admin/bookings
GET /api/v1/admin/bookings/{{bookingId}}
GET /api/v1/admin/payments
GET /api/v1/admin/commissions
GET /api/v1/admin/refunds
GET /api/v1/admin/reviews
GET /api/v1/admin/community/requests
PATCH /api/v1/admin/community/requests/{{communityRequestId}}
DELETE /api/v1/admin/community/comments/{{commentId}}
GET /api/v1/admin/markets
POST /api/v1/admin/markets
PATCH /api/v1/admin/markets/{{marketId}}
GET /api/v1/admin/platform-settings
PATCH /api/v1/admin/platform-settings/{{settingKey}}
```

Food truck admin update:

```json
{
  "status": "ACTIVE",
  "isFeatured": true
}
```

Platform setting:

```json
{
  "value": {
    "commissionRate": 0.1
  },
  "description": "Default platform commission",
  "isPublic": false
}
```

## 17. Recommended Happy Path Checklist

Run this exact sequence for the first complete test:

1. Register customer.
2. Verify customer email.
3. Register vendor.
4. Verify vendor email.
5. Login admin.
6. Customer saves onboarding interests.
7. Vendor updates profile.
8. Vendor creates food truck draft.
9. Vendor configures menu, service area, guest capacity.
10. Vendor submits verification request.
11. Admin approves vendor.
12. Vendor sets truck status/location/open status and creates drop.
13. Customer tests discovery nearby.
14. Customer follows and favorites truck.
15. Vendor creates post.
16. Customer checks notifications/feed.
17. Vendor creates promotion.
18. Customer redeems promotion.
19. Customer creates booking.
20. Vendor accepts booking.
21. Vendor creates quote.
22. Customer accepts quote.
23. Customer creates payment intent.
24. Stripe webhook marks payment succeeded.
25. Manually complete booking if no complete endpoint exists.
26. Customer creates review.
27. Vendor responds to review.
28. Admin moderates review.
29. Customer scans QR and checks in.
30. Customer checks loyalty points and notifications.
31. Customer creates referral code.
32. Second customer applies referral code.
33. Admin qualifies referral.
34. Admin checks analytics, payments, commissions, refunds.
35. Test leaderboards after enough truck activity exists.

## 18. Common Dependency Errors

If discovery returns empty:

```text
Check truck live location, operating status, active status, and radius.
```

If booking create fails:

```text
Check service area exists and guest count does not exceed maximumGuestCapacity.
```

If payment intent fails:

```text
Check booking is PAYMENT_PENDING and vendor Stripe Connect account exists.
```

If review create fails:

```text
Booking must be COMPLETED and not already reviewed.
```

If QR check-in fails:

```text
Check QR code exists, truck live location exists, and customer location is near truck.
```

If reward points do not appear:

```text
Check idempotency key was not already used and reward rule/default trigger exists.
```

If admin API returns forbidden:

```text
Check token belongs to a user with ADMIN role.
```

If verify-email fails:

```text
Check the latest 6-digit verification code and whether it has expired.
If expired, call resend-verification-code first.
```

## 19. Testing Notes

- Do not test payment webhooks with normal JSON requests. Use Stripe CLI or proper signed webhook payload.
- Some flows depend on database status changes if no public endpoint exists yet, for example booking completion.
- Keep IDs from every response. Most later APIs depend on IDs from earlier APIs.
- Use Swagger for exact DTO fields if a request fails validation.
- For PostGIS-related APIs, latitude and longitude must be valid and near configured service/live locations.
- Current email verification code is generated by backend and logged from the auth service. If SMTP is not connected yet, use the logged code for testing.
