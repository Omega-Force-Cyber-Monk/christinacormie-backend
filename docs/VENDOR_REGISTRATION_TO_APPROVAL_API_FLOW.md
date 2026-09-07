# Vendor Registration to Final Approved API Flow

This document explains the full vendor flow from signup to final approved/active state.

## Base URL

```text
http://localhost:3000
```

## Required Tokens

```text
{{vendorToken}}  Vendor JWT after email verification/login
{{adminToken}}   Admin JWT for approval/rejection/status update
```

## Required IDs

```text
{{vendorId}}     Vendor ID from vendor profile/admin list
{{foodTruckId}}  Food truck ID from onboarding response or /food-trucks/mine
{{qrCode}}       QR code from /vendors/me/qr-code
```

## Main Rule

Vendor email verification is not enough.

Vendor must be business approved before restricted vendor features work:

```text
vendor.status = APPROVED
vendor.isVerified = true
```

Food truck must also be active before customer-facing truck/QR features work:

```text
foodTruck.status = ACTIVE
```

Before approval, vendor can only complete profile/onboarding and submit documents. QR, redemption, active drops, analytics, booking actions, promotions, and public/customer-facing usage are restricted.

## 1. Register Vendor

```http
POST /api/v1/auth/register/vendor
Content-Type: application/json

{
  "email": "vendor@example.com",
  "phone": "+12025550199",
  "password": "Password123!",
  "businessName": "Taco Paradise",
  "businessEmail": "contact@tacoparadise.com",
  "businessPhone": "+12025550199",
  "firstName": "Taco",
  "lastName": "Owner",
  "displayName": "Taco Owner",
  "timezone": "America/New_York"
}
```

Expected:

```text
Verification code is sent to vendor email.
Vendor account is created with status DRAFT.
```

## 2. Verify Vendor Email

```http
POST /api/v1/auth/verify-email
Content-Type: application/json

{
  "email": "vendor@example.com",
  "code": "123456"
}
```

Expected:

```text
Vendor user account becomes active.
Response returns accessToken and refreshToken.
Save accessToken as {{vendorToken}}.
```

Important:

```text
This verifies only the email/account login.
This does not approve the vendor business.
```

## 3. Vendor Login

Use this if token is expired or after manual testing restart.

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "vendor@example.com",
  "password": "Password123!"
}
```

Save:

```text
accessToken -> {{vendorToken}}
```

## 4. Get My Vendor Profile

```http
GET /api/v1/vendors/me
Authorization: Bearer {{vendorToken}}
```

Use this to check:

```text
vendor.id
vendor.status
vendor.isVerified
verificationRequirements
```

Save:

```text
id -> {{vendorId}}
```

## 5. Upload Onboarding Images

Optional. Use only if frontend needs truck logo/truck image/menu image upload.

```http
POST /api/v1/vendors/me/onboarding/upload
Authorization: Bearer {{vendorToken}}
Content-Type: multipart/form-data

file=<image file>
```

Save returned Cloudinary URLs for:

```text
truckLogoUrl
truckImageUrl
menuItem.photoUrl
```

## 6. Complete Vendor Onboarding

This creates or updates the vendor food truck draft.

```http
POST /api/v1/vendors/me/onboarding
Authorization: Bearer {{vendorToken}}
Content-Type: application/json

{
  "selectedPlan": "FREE",
  "contact": {
    "name": "Taco Owner",
    "city": "Austin",
    "state": "TX",
    "email": "vendor@example.com",
    "phoneNumber": "+12025550199"
  },
  "truckName": "Taco Paradise",
  "truckCallName": "Taco Paradise",
  "truckLogoUrl": "https://res.cloudinary.com/demo/image/upload/logo.jpg",
  "truckImageUrl": "https://res.cloudinary.com/demo/image/upload/truck.jpg",
  "needsProfessionalPhotos": false,
  "menuItem": {
    "name": "Birria Tacos",
    "price": 14.99,
    "description": "Slow-cooked beef tacos with consomme",
    "photoUrl": "https://res.cloudinary.com/demo/image/upload/birria.jpg"
  },
  "cuisineType": "Mexican",
  "primaryCity": "Austin",
  "truckType": "FOOD_TRUCK",
  "serviceRadiusKm": 20,
  "serviceAddress": "100 Congress Ave, Austin, TX 78701",
  "latitude": 30.2672,
  "longitude": -97.7431
}
```

Expected:

```text
Vendor onboarding saved successfully.
Food truck is created/updated as DRAFT.
```

Save:

```text
foodTruck.id -> {{foodTruckId}}
```

If response shape is unclear, call:

```http
GET /api/v1/food-trucks/mine
Authorization: Bearer {{vendorToken}}
```

## 7. Upload Vendor Verification Documents

Optional upload route. Use before submit verification request if documents are files.

```http
POST /api/v1/vendors/me/verification-requests/upload
Authorization: Bearer {{vendorToken}}
Content-Type: multipart/form-data

file=<pdf/image document>
```

Save each returned document URL.

## 8. Submit Vendor Verification Request

For Texas vendor:

```http
POST /api/v1/vendors/me/verification-requests
Authorization: Bearer {{vendorToken}}
Content-Type: application/json

{
  "documents": [
    {
      "type": "DSHS_MOBILE_FOOD_VENDOR_LICENSE",
      "url": "https://res.cloudinary.com/demo/raw/upload/dshs-license.pdf"
    },
    {
      "type": "FOOD_MANAGER_CERTIFICATION",
      "url": "https://res.cloudinary.com/demo/raw/upload/food-manager-certification.pdf"
    },
    {
      "type": "CERTIFICATE_OF_INSURANCE",
      "url": "https://res.cloudinary.com/demo/raw/upload/certificate-of-insurance.pdf"
    }
  ],
  "notes": "Texas vendor verification documents submitted for review."
}
```

For non-Texas vendor:

```json
{
  "documents": [
    {
      "type": "STATE_OR_LOCAL_FOOD_VENDOR_PERMIT",
      "url": "https://res.cloudinary.com/demo/raw/upload/state-local-permit.pdf"
    },
    {
      "type": "FOOD_MANAGER_CERTIFICATION",
      "url": "https://res.cloudinary.com/demo/raw/upload/food-manager-certification.pdf"
    },
    {
      "type": "CERTIFICATE_OF_INSURANCE",
      "url": "https://res.cloudinary.com/demo/raw/upload/certificate-of-insurance.pdf"
    }
  ],
  "notes": "Non-Texas vendor verification documents submitted for review."
}
```

Expected:

```text
vendor.status becomes PENDING_APPROVAL.
verificationRequest.status becomes PENDING.
```

## 9. Admin: List Pending Vendors

```http
GET /api/v1/admin/vendors/pending-approval
Authorization: Bearer {{adminToken}}
```

Use this to find:

```text
{{vendorId}}
```

## 10. Admin: List Verification Requests

```http
GET /api/v1/admin/verification-requests?status=PENDING
Authorization: Bearer {{adminToken}}
```

Use this to review submitted documents.

## 11. Admin: Approve Vendor

```http
PATCH /api/v1/admin/vendors/{{vendorId}}/approve
Authorization: Bearer {{adminToken}}
```

Expected:

```text
vendor.status becomes APPROVED.
vendor.isVerified becomes true.
pending verification request becomes APPROVED.
QR code is generated for vendor food truck records.
```

## 12. Admin: Activate Food Truck

Vendor approval does not automatically mean the truck is public active. Activate the food truck:

```http
PATCH /api/v1/admin/food-trucks/{{foodTruckId}}
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{
  "status": "ACTIVE"
}
```

Expected:

```text
foodTruck.status becomes ACTIVE.
Customer-facing APIs can now show/use this truck.
```

Optional feature:

```json
{
  "status": "ACTIVE",
  "isFeatured": true
}
```

## 13. Vendor: Get Final QR Code

```http
GET /api/v1/vendors/me/qr-code
Authorization: Bearer {{vendorToken}}
```

Expected approved response:

```json
{
  "vendorId": "vendor-id",
  "businessName": "Taco Paradise",
  "foodTruckId": "food-truck-id",
  "qrCode": "truck_xxxxxxxxx",
  "qrCodeUrl": "/api/v1/qr/truck_xxxxxxxxx/profile",
  "downloadUrl": null,
  "shareMessage": "Scan our BiteDrop QR code at Taco Paradise to check in and earn rewards!"
}
```

Save:

```text
qrCode -> {{qrCode}}
```

## 14. Customer/Public: Test QR Profile

```http
GET /api/v1/qr/{{qrCode}}/profile
```

Expected:

```text
Returns linked active food truck profile.
```

If vendor is not approved or truck is not active:

```text
403 Forbidden
This food truck QR code is not available until the vendor is approved.
```

## 15. Vendor Final APIs After Approval

These APIs are restricted until vendor is approved and verified.

### Vendor Dashboard / QR

```http
GET /api/v1/vendors/me/qr-code
GET /api/v1/vendors/me/analytics
GET /api/v1/check-ins/food-trucks/{{foodTruckId}}/qr-analytics
```

### Food Truck Live/Active Operations

```http
PATCH /api/v1/food-trucks/{{foodTruckId}}/operating-status
PATCH /api/v1/food-trucks/{{foodTruckId}}/location
POST /api/v1/food-trucks/{{foodTruckId}}/drops
```

### Bookings Vendor Side

```http
GET /api/v1/bookings/vendor/mine
PATCH /api/v1/bookings/{{bookingId}}/accept
PATCH /api/v1/bookings/{{bookingId}}/reject
POST /api/v1/bookings/{{bookingId}}/quotes
```

### Promotions

```http
POST /api/v1/promotions
GET /api/v1/promotions/{{promotionId}}/analytics
```

### Rewards / Redemption

```http
POST /api/v1/vendors/me/redemptions/confirm
GET /api/v1/rewards/me/vendor-badges
```

### Social / Reviews / Community

```http
POST /api/v1/social/posts
PATCH /api/v1/social/posts/{{postId}}
DELETE /api/v1/social/posts/{{postId}}
PATCH /api/v1/reviews/{{reviewId}}/vendor-response
POST /api/v1/community/requests/{{requestId}}/offers
PATCH /api/v1/community/offers/{{offerId}}/withdraw
```

### Payments

```http
POST /api/v1/payments/connect/accounts
GET /api/v1/payments/connect/account
GET /api/v1/payments/payouts/mine
POST /api/v1/payments/{{paymentId}}/refunds
```

## 16. Public/Customer APIs That Depend on Approved Vendor Truck

These should only work/show trucks when:

```text
vendor.status = APPROVED
vendor.isVerified = true
foodTruck.status = ACTIVE
```

APIs:

```http
GET /api/v1/discovery/nearby
GET /api/v1/discovery/trending
GET /api/v1/food-trucks/profile/{{slug}}
GET /api/v1/food-trucks/drops/nearby
GET /api/v1/food-trucks/drops/today
POST /api/v1/qr/{{qrCode}}/scans
POST /api/v1/qr/{{qrCode}}/scans/authenticated
POST /api/v1/qr/{{qrCode}}/check-ins
POST /api/v1/bookings
POST /api/v1/social/food-trucks/{{foodTruckId}}/follow
POST /api/v1/social/food-trucks/{{foodTruckId}}/favorite
GET /api/v1/promotions/food-trucks/{{foodTruckId}}
POST /api/v1/promotions/{{promotionId}}/redeem
POST /api/v1/rewards/me/redemption-codes
POST /api/v1/community/food-trucks/{{foodTruckId}}/requests
```

## 17. Admin Reject Flow

If admin rejects:

```http
PATCH /api/v1/admin/vendors/{{vendorId}}/reject
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{
  "rejectionReason": "Missing valid food manager certification."
}
```

Expected:

```text
vendor.status becomes REJECTED.
vendor.isVerified remains false.
restricted vendor APIs return 403.
```

## 18. Expected Restriction Error

Before vendor approval, restricted APIs return:

```json
{
  "statusCode": 403,
  "message": "Vendor account is not approved yet. Please complete onboarding and submit verification documents for admin review.",
  "error": "Forbidden"
}
```

For customer-facing unavailable truck/QR:

```json
{
  "statusCode": 403,
  "message": "Food truck is not available",
  "error": "Forbidden"
}
```

or:

```json
{
  "statusCode": 403,
  "message": "This food truck QR code is not available until the vendor is approved.",
  "error": "Forbidden"
}
```

## Manual Testing Checklist

1. Register vendor.
2. Verify email.
3. Login as vendor.
4. Call restricted API before approval: should return `403`.
5. Complete onboarding.
6. Submit verification documents.
7. Admin approve vendor.
8. Admin activate food truck.
9. Get vendor QR code.
10. Test QR profile.
11. Test customer check-in.
12. Test vendor redemption confirmation.
13. Test discovery/profile APIs show the truck.

