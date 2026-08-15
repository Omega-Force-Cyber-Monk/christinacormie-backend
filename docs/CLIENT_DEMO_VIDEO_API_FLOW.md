# Client Demo Video API Flow

Use this guide to record the short backend walkthrough requested by the client. Keep Swagger open and show the request/response for each important step.

Demo API docs:

```text
https://christina-backend.onrender.com/api/v1/docs
```

Local base URL if testing locally:

```text
http://localhost:3000
```

## Demo Goal

Show these client-requested flows with test data:

1. Test vendor registers and submits verification documents.
2. Admin receives and approves the verification.
3. Test booking is created and processed.
4. Photo shoot request status.
5. Stripe integration status and required credentials.

## Important Demo Tokens

Prepare these before recording:

```text
{{customerToken}}
{{vendorToken}}
{{adminToken}}
{{vendorId}}
{{foodTruckId}}
{{bookingId}}
{{quoteId}}
{{photoShootRequestId}}
```

Use this header for protected APIs:

```text
Authorization: Bearer {{token}}
Content-Type: application/json
```

## 1. Vendor Registration And Verification

### 1.1 Register Vendor

```http
POST /api/v1/auth/register/vendor
```

Minimal payload:

```json
{
  "email": "demo.vendor@example.com",
  "phone": "+12025550199",
  "password": "Password123!"
}
```

Optional payload fields (if provided during signup):

```json
{
  "email": "demo.vendor@example.com",
  "phone": "+12025550199",
  "password": "Password123!",
  "businessName": "Demo Tacos Food Truck",
  "businessEmail": "demo.vendor@example.com",
  "businessPhone": "+12025550199",
  "description": "Demo food truck for Bite Drop walkthrough",
  "websiteUrl": "https://demotacos.example.com",
  "firstName": "Demo",
  "lastName": "Vendor",
  "displayName": "Demo Vendor",
  "timezone": "America/Chicago"
}
```

Expected:

```text
status = PENDING
message says verify 6-digit email code
```

### 1.2 Verify Vendor Email

Use the 6-digit code from backend logs/test email.

```http
POST /api/v1/auth/verify-email
```

```json
{
  "email": "demo.vendor@example.com",
  "code": "123456"
}
```

Save:

```text
accessToken -> {{vendorToken}}
user.vendor.id -> {{vendorId}}
```

### 1.3 Complete Vendor Onboarding

This one API matches the current vendor onboarding UI after registration. It saves the selected plan, contact details, truck details, logo/image URLs, photo shoot request, first menu item, cuisine, truck type, primary city, and service radius.

```http
POST /api/v1/vendors/me/onboarding
```

Use `{{vendorToken}}`.

```json
{
  "plan": "FREE",
  "contact": {
    "name": "Demo Vendor",
    "city": "Austin",
    "state": "TX",
    "email": "demo.vendor@example.com",
    "phoneNumber": "+12025550199"
  },
  "truckName": "Demo Tacos Express",
  "truckCallName": "Demo Tacos",
  "truckLogoUrl": "https://cdn.example.com/trucks/demo-logo.jpg",
  "truckImageUrl": "https://cdn.example.com/trucks/demo-profile.jpg",
  "needsProfessionalPhotos": true,
  "menuItem": {
    "photoUrl": "https://cdn.example.com/menu/birria.jpg",
    "name": "Birria Tacos",
    "price": 14.99,
    "description": "Slow-cooked beef tacos with consomme"
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

Save:

```text
foodTruck.id -> {{foodTruckId}}
photoShootRequest.id -> {{photoShootRequestId}}
```

Expected:

```text
message = Vendor onboarding saved successfully.
photoShootMessage = Thank you. Our team will contact you about professional photos shortly.
vendor.selectedPlan = FREE
foodTruck.name = Demo Tacos Express
foodTruck.truckType = FOOD_TRUCK
menu contains the submitted menu item
serviceArea radius is saved
photoShootRequest.status = PENDING when needsProfessionalPhotos is true
```

The separate APIs below still exist and can be used later for editing. For the video, the one onboarding API is the better match for the UI.

### 1.4 Show Verification Requirements

```http
GET /api/v1/vendors/me
```

Use `{{vendorToken}}`.

Expected:

```text
verificationRequirements.requirementSet = TEXAS
requiredDocumentTypes includes:
DSHS_MOBILE_FOOD_VENDOR_LICENSE
FOOD_MANAGER_CERTIFICATION
CERTIFICATE_OF_INSURANCE
```

For non-Texas vendors, set `state` to another state such as `CA`. Expected:

```text
requirementSet = NON_TEXAS
requiredDocumentTypes includes:
STATE_OR_LOCAL_FOOD_VENDOR_PERMIT
FOOD_MANAGER_CERTIFICATION
CERTIFICATE_OF_INSURANCE
```

The state comes from the onboarding `contact.state` value. You only need `PATCH /api/v1/users/me/profile` if you want to manually change the vendor state after onboarding.

### 1.5 Submit Verification Documents

```http
POST /api/v1/vendors/me/verification-requests
```

Use `{{vendorToken}}`.

Texas example (when vendor state is TX):

```json
{
  "documents": [
    {
      "type": "DSHS_MOBILE_FOOD_VENDOR_LICENSE",
      "url": "https://example.com/demo-dshs-license.pdf"
    },
    {
      "type": "FOOD_MANAGER_CERTIFICATION",
      "url": "https://example.com/demo-food-manager-certification.pdf"
    },
    {
      "type": "CERTIFICATE_OF_INSURANCE",
      "url": "https://example.com/demo-coi.pdf"
    }
  ],
  "notes": "Demo verification documents submitted for review."
}
```

Non-Texas example (when vendor state is NOT Texas):

```json
{
  "documents": [
    {
      "type": "STATE_OR_LOCAL_FOOD_VENDOR_PERMIT",
      "url": "https://example.com/demo-local-permit.pdf"
    },
    {
      "type": "FOOD_MANAGER_CERTIFICATION",
      "url": "https://example.com/demo-food-manager-certification.pdf"
    },
    {
      "type": "CERTIFICATE_OF_INSURANCE",
      "url": "https://example.com/demo-coi.pdf"
    }
  ],
  "notes": "Demo verification documents submitted for review."
}
```

Expected:

```text
message = Thank you for submitting your documents. Our team will review and get back to you shortly.
vendor.status = PENDING_APPROVAL
verificationRequest.status = PENDING
```

Demo talking point:

```text
The backend detects the vendor state and enforces the correct required document set before allowing submission.
```

## 2. Admin Review And Approval

### 2.1 Login Admin

```http
POST /api/v1/auth/login
```

```json
{
  "email": "admin@bitedrop.com",
  "password": "Password123!"
}
```

Save:

```text
accessToken -> {{adminToken}}
```

### 2.2 Show Pending Vendors

```http
GET /api/v1/admin/vendors/pending-approval
```

Use `{{adminToken}}`.

Expected:

```text
Demo vendor appears with status PENDING_APPROVAL.
```

### 2.3 Show Verification Requests

```http
GET /api/v1/admin/verification-requests
```

Use `{{adminToken}}`.

Expected:

```text
Submitted documents are visible in the verification request payload.
```

### 2.4 Approve Vendor

```http
PATCH /api/v1/admin/vendors/{{vendorId}}/approve
```

Use `{{adminToken}}`.

Expected:

```text
vendor.status = APPROVED
vendor.isVerified = true
verification request becomes APPROVED
QR codes may be generated for existing trucks
```

## 3. Food Truck Setup Needed Before Booking

Bookings need a food truck, service area, and guest capacity. Because the demo uses `POST /api/v1/vendors/me/onboarding`, this setup is already done. Use this section only if you skipped the composite onboarding API or need to show the older individual endpoints.

### 3.1 Create Draft Food Truck

```http
POST /api/v1/food-trucks/draft
```

Use `{{vendorToken}}`.

```json
{
  "name": "Demo Tacos Express",
  "description": "Demo truck for booking walkthrough",
  "profileImageUrl": "https://cdn.example.com/demo-tacos-profile.jpg",
  "coverImageUrl": "https://cdn.example.com/demo-tacos-cover.jpg",
  "minimumBookingAmount": 300,
  "maximumGuestCapacity": 100
}
```

Save:

```text
id -> {{foodTruckId}}
```

### 3.2 Configure Service Area

```http
PATCH /api/v1/food-trucks/{{foodTruckId}}/service-area
```

Use `{{vendorToken}}`.

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

### 3.3 Configure Guest Capacity

```http
PATCH /api/v1/food-trucks/{{foodTruckId}}/guest-capacity
```

Use `{{vendorToken}}`.

```json
{
  "maximumGuestCapacity": 100
}
```

### 3.4 Make Truck Active For Demo

If needed, use admin to activate/feature the truck:

```http
PATCH /api/v1/admin/food-trucks/{{foodTruckId}}
```

For the demo booking flow, make the truck `ACTIVE` before creating the booking.

Use `{{adminToken}}`.

```json
{
  "status": "ACTIVE",
  "isFeatured": true
}
```

## 4. Booking Flow

### 4.1 Register Or Login Customer

```http
POST /api/v1/auth/register/customer
POST /api/v1/auth/verify-email
```

Or login an existing test customer:

```http
POST /api/v1/auth/login
```

Save:

```text
accessToken -> {{customerToken}}
```

### 4.2 Create Booking Request

```http
POST /api/v1/bookings
```

Use `{{customerToken}}`.

Use an absolute future date. Example date: `2026-08-25`.

```json
{
  "foodTruckId": "{{foodTruckId}}",
  "bookingType": "CATERING",
  "eventName": "Demo Corporate Lunch",
  "eventDescription": "Backend walkthrough booking test",
  "startsAt": "2026-08-25T18:00:00.000Z",
  "endsAt": "2026-08-25T21:00:00.000Z",
  "guestCount": 50,
  "address": "100 Congress Ave, Austin, TX 78701",
  "latitude": 30.2672,
  "longitude": -97.7431,
  "subtotal": 500,
  "specialInstructions": "Demo booking for client walkthrough"
}
```

Save:

```text
id -> {{bookingId}}
```

Expected:

```text
booking.status = PENDING
vendor notification is created
```

### 4.3 Vendor Accepts Booking

```http
PATCH /api/v1/bookings/{{bookingId}}/accept
```

Use `{{vendorToken}}`.

```json
{
  "reason": "Available for this demo booking."
}
```

Expected:

```text
booking.status = ACCEPTED
customer notification is created
```

### 4.4 Vendor Creates Quote

```http
POST /api/v1/bookings/{{bookingId}}/quotes
```

Use `{{vendorToken}}`.

```json
{
  "subtotal": 500,
  "outsideRadiusFee": 0,
  "serviceFee": 50,
  "taxAmount": 40,
  "discountAmount": 0,
  "message": "Demo quote for full catering service",
  "terms": "Payment required within 30 minutes",
  "expiresAt": "2026-08-24T23:59:59.000Z"
}
```

Save:

```text
quote.id -> {{quoteId}}
```

### 4.5 Customer Accepts Quote

```http
PATCH /api/v1/bookings/quotes/{{quoteId}}/accept
```

Use `{{customerToken}}`.

```json
{
  "paymentWindowMinutes": 30
}
```

Expected:

```text
booking.status = PAYMENT_PENDING
booking hold is created
```

### 4.6 Admin Shows Booking

```http
GET /api/v1/admin/bookings/{{bookingId}}
```

Use `{{adminToken}}`.

Expected:

```text
Admin can monitor booking details and current status.
```

## 5. Stripe Status To Explain In Video

Stripe backend APIs exist, but production Stripe is not connected until Bite Drop LLC credentials are provided.

Existing Stripe-related APIs:

```http
POST /api/v1/payments/connect/accounts
GET /api/v1/payments/connect/account
GET /api/v1/payments/payouts/mine
POST /api/v1/payments/bookings/{{bookingId}}/payment-intent
GET /api/v1/payments/{{paymentId}}
POST /api/v1/payments/{{paymentId}}/refunds
POST /api/v1/payments/webhooks/stripe
```

Credentials needed from client before production:

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
Stripe Connect account setup under Bite Drop LLC
Production return URL
Production refresh URL
```

Demo talking point:

```text
During development we use Stripe test credentials. Once frontend/backend integration is complete, production credentials from Bite Drop LLC will be added and the same payment flow will run under the client's Stripe account.
```

## 6. Photo Shoot Request Flow

Client asked to see:

```text
Need professional photos? Request a photo shoot
```

The photo shoot request is created by:

```http
POST /api/v1/vendors/me/onboarding
```

Use this field:

```json
{
  "needsProfessionalPhotos": true
}
```

Admin can view requests:

```http
GET /api/v1/admin/photo-shoot-requests
```

Save:

```text
id -> {{photoShootRequestId}}
```

Admin can update request status:

```http
PATCH /api/v1/admin/photo-shoot-requests/{{photoShootRequestId}}
```

```json
{
  "status": "CONTACTED",
  "notes": "Vendor contacted for photo shoot scheduling."
}
```

Expected:

```text
Photo shoot request is saved.
Admin can view it.
Notification/email is attempted to vendors@bitedropapp.com.
Vendor receives confirmation message in the onboarding response.
```

## 7. Notifications To Show

After each trigger, show notification APIs:

```http
GET /api/v1/notifications
GET /api/v1/notifications/unread-count
PATCH /api/v1/notifications/{{notificationId}}/read
PATCH /api/v1/notifications/read-all
```

Use the affected user's token:

```text
Booking created -> use vendor token
Booking accepted -> use customer token
Quote created -> use customer token
Payment updates -> use customer/vendor token depending on event
```

## 8. Suggested Video Recording Order

Record in this order:

1. Open Swagger docs URL.
2. Register vendor.
3. Verify vendor email.
4. Complete vendor onboarding with `needsProfessionalPhotos = true`.
5. Show `GET /api/v1/vendors/me` verification requirements.
6. Submit Texas verification documents.
7. Login admin.
8. Show pending vendor and verification request.
9. Approve vendor.
10. Confirm food truck/menu/service radius were created from onboarding.
11. Make the truck `ACTIVE` through admin if it is still `DRAFT`.
12. Register/login customer.
13. Customer creates booking.
14. Vendor accepts booking.
15. Vendor creates quote.
16. Customer accepts quote.
17. Show admin booking details.
18. Explain Stripe test vs production status.
19. Show admin photo shoot request list and update request status.

## 9. Demo Notes

- Use test data only.
- Keep tokens hidden if recording publicly.
- Use absolute dates in all booking/payment examples.
- If an endpoint returns validation error, show that validation is working, then correct the payload.
- Do not test Stripe live mode during the demo.
