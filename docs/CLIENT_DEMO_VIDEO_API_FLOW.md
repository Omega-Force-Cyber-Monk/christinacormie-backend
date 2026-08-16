# Client Demo Video Flow

Use this guide to record a short backend demo for the client. Keep it focused. Show only the flows the client asked to see.

Demo API docs:

```text
https://christina-backend.onrender.com/api/v1/docs
```

Local base URL:

```text
http://localhost:3000
```

## Demo Scope

Show only these 4 things:

1. Vendor registers and submits verification documents.
2. Admin receives and approves the vendor verification.
3. One booking is created and processed.
4. Photo shoot request is created and visible to admin.

Explain Stripe status briefly at the end. Do not try to fully demo live Stripe unless already configured.

## Tokens To Prepare

```text
{{vendorToken}}
{{adminToken}}
{{customerToken}}
{{vendorId}}
{{foodTruckId}}
{{bookingId}}
{{quoteId}}
{{photoShootRequestId}}
```

Protected header:

```text
Authorization: Bearer {{token}}
Content-Type: application/json
```

## 1. Vendor Signup And Onboarding

### 1.1 Register Vendor

```http
POST /api/v1/auth/register/vendor
```

```json
{
  "email": "demo.vendor@example.com",
  "phone": "+12025550199",
  "password": "Password123!"
}
```

Expected:

```text
status = PENDING
message says verify 6-digit code
```

### 1.2 Verify Vendor Email

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

```http
POST /api/v1/vendors/me/onboarding
```

Use `{{vendorToken}}`.

```json
{
  "selectedPlan": "FREE",
  "contact": {
    "name": "Demo Vendor",
    "city": "Austin",
    "state": "TX",
    "email": "demo.vendor@example.com",
    "phoneNumber": "+12025550199"
  },
  "truckName": "Demo Tacos Express",
  "truckCallName": "Demo Tacos",
  "truckLogoUrl": "https://res.cloudinary.com/demo/image/upload/v1/bitedrop/vendors/onboarding/logo.jpg",
  "truckImageUrl": "https://res.cloudinary.com/demo/image/upload/v1/bitedrop/vendors/onboarding/truck.jpg",
  "needsProfessionalPhotos": true,
  "firstMenuItem": {
    "name": "Birria Tacos",
    "price": 14.99,
    "description": "Slow-cooked beef tacos with consomme",
    "photoUrl": "https://res.cloudinary.com/demo/image/upload/v1/bitedrop/vendors/onboarding/birria.jpg"
  },
  "cuisineType": "Mexican",
  "primaryCity": "Austin",
  "truckType": "FOOD_TRUCK",
  "serviceRadius": 20,
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

Show in response:

```text
message = Vendor onboarding saved successfully.
photoShootMessage = Thank you. Our team will contact you about professional photos shortly.
```

## 2. Verification Document Submission

### 2.1 Show Vendor Verification Requirements

```http
GET /api/v1/vendors/me
```

Use `{{vendorToken}}`.

Show:

```text
verificationRequirements.requirementSet = TEXAS
requiredDocumentTypes includes:
DSHS_MOBILE_FOOD_VENDOR_LICENSE
FOOD_MANAGER_CERTIFICATION
CERTIFICATE_OF_INSURANCE
```

### 2.2 Submit Texas Verification Documents

```http
POST /api/v1/vendors/me/verification-requests
```

Use `{{vendorToken}}`.

```json
{
  "documents": [
    {
      "type": "DSHS_MOBILE_FOOD_VENDOR_LICENSE",
      "url": "https://res.cloudinary.com/demo/raw/upload/v1/bitedrop/vendors/vendor-id/verification-documents/dshs-license.pdf"
    },
    {
      "type": "FOOD_MANAGER_CERTIFICATION",
      "url": "https://res.cloudinary.com/demo/raw/upload/v1/bitedrop/vendors/vendor-id/verification-documents/food-manager-certification.pdf"
    },
    {
      "type": "CERTIFICATE_OF_INSURANCE",
      "url": "https://res.cloudinary.com/demo/raw/upload/v1/bitedrop/vendors/vendor-id/verification-documents/certificate-of-insurance.pdf"
    }
  ],
  "notes": "Demo verification documents submitted for review."
}
```

Show in response:

```text
message = Thank you for submitting your documents. Our team will review and get back to you shortly.
vendor.status = PENDING_APPROVAL
verificationRequest.status = PENDING
```

## 3. Admin Review

### 3.1 Login Admin

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

### 3.2 Show Pending Vendor Queue

```http
GET /api/v1/admin/vendors/pending-approval
```

Use `{{adminToken}}`.

Show that the demo vendor appears in the pending queue.

### 3.3 Show Submitted Verification Documents

```http
GET /api/v1/admin/verification-requests?status=PENDING
```

Use `{{adminToken}}`.

Show that the vendor submission and documents are visible.

### 3.4 Approve Vendor

```http
PATCH /api/v1/admin/vendors/{{vendorId}}/approve
```

Use `{{adminToken}}`.

Show in response:

```text
vendor.status = APPROVED
vendor.isVerified = true
```

## 4. Request, Quote, And Booking Demo

### 4.1 Make Truck Active

```http
PATCH /api/v1/admin/food-trucks/{{foodTruckId}}
```

Use `{{adminToken}}`.

```json
{
  "status": "ACTIVE",
  "isFeatured": true
}
```

### 4.2 Login Or Register Customer

Use any working customer test account and save:

```text
accessToken -> {{customerToken}}
```

### 4.3 Customer Creates Need-A-Truck Request

```http
POST /api/v1/community/requests
```

Use `{{customerToken}}`.

Use a future date, for example August 25, 2026.

```json
{
  "requestType": "EVENT",
  "eventType": "CORPORATE_EVENT",
  "title": "Corporate Lunch Catering Request",
  "description": "Backend walkthrough request for a taco truck lunch service",
  "eventDate": "2026-08-25T00:00:00.000Z",
  "startTime": "18:00",
  "endTime": "21:00",
  "eventTimezone": "America/Chicago",
  "guestCount": 50,
  "budgetMin": 500,
  "budgetMax": 800,
  "address": "100 Congress Ave, Austin, TX 78701",
  "contactPhone": "+12025550143",
  "latitude": 30.2672,
  "longitude": -97.7431,
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

### 4.4 Vendor Sends Quote

```http
POST /api/v1/community/requests/{{communityRequestId}}/offers
```

Use `{{vendorToken}}`.

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
id -> {{quoteId}}
```

### 4.5 Customer Accepts Quote And Booking Is Created

```http
PATCH /api/v1/community/offers/{{quoteId}}/accept
```

Use `{{customerToken}}`.

Expected:

```text
offer.status = ACCEPTED
communityRequest.status = MATCHED
booking.status = PAYMENT_PENDING
booking.vendorOfferId = {{quoteId}}
```

Save:

```text
booking.id -> {{bookingId}}
```

### 4.6 Customer Creates Payment Intent

```http
POST /api/v1/payments/bookings/{{bookingId}}/payment-intent
```

Use `{{customerToken}}`.

```json
{
  "idempotencyKey": "booking-{{bookingId}}-deposit-1",
  "currency": "USD"
}
```

Expected:

```text
For deposit-only quotes, the amount charged now uses the accepted offer deposit amount.
```

### 4.7 Customer Views Order Details

```http
GET /api/v1/bookings/{{bookingId}}
```

Use `{{customerToken}}`.

### 4.8 Vendor Views Orders

```http
GET /api/v1/bookings/vendor/mine
```

Use `{{vendorToken}}`.

## 5. Photo Shoot Request

### 5.1 Show Photo Shoot Request In Admin

```http
GET /api/v1/admin/photo-shoot-requests
```

Use `{{adminToken}}`.

Show the request created from onboarding.

### 5.2 Update Photo Shoot Request

```http
PATCH /api/v1/admin/photo-shoot-requests/{{photoShootRequestId}}
```

Use `{{adminToken}}`.

```json
{
  "status": "CONTACTED",
  "notes": "Vendor contacted for photo shoot scheduling."
}
```

## 6. Stripe Talking Point

Explain only:

```text
Stripe backend endpoints exist, but production Stripe is not connected yet.
Development uses test credentials.
Production credentials needed later:
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- Stripe Connect setup under Bite Drop LLC
```

## 7. Recording Order

Record in this order:

1. Register vendor.
2. Verify vendor email.
3. Complete vendor onboarding with `needsProfessionalPhotos = true`.
4. Show vendor verification requirements.
5. Submit Texas verification documents.
6. Login admin.
7. Show pending vendor queue.
8. Show verification request list.
9. Approve vendor.
10. Activate the food truck.
11. Login/register customer.
12. Customer creates need-a-truck request.
13. Vendor sends quote.
14. Customer accepts quote and receives booking.
15. Create payment intent for the booking.
16. Show booking details and vendor order list.
17. Show photo shoot request list.
18. Update photo shoot request status.
19. Briefly explain Stripe status.

## 8. Demo Notes

- Keep the demo short.
- Use test data only.
- Keep tokens hidden if recording publicly.
- Do not show unnecessary APIs.
- Do not test live Stripe in the video.
