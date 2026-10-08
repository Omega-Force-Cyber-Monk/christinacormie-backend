# Vendor Account Flow API

Ei docs vendor account create theke approved/ready howa porjonto API order clear korar jonno.

Base URL:

```text
https://api.bitedropapp.com
```

## Status bujhar shortcut

```text
DRAFT
```

Vendor account create hoyeche, but onboarding/document review submit hoyni.

```text
PENDING_APPROVAL
```

Vendor documents submit kore admin review-er jonno wait korche.

```text
APPROVED + isVerified=true
```

Admin vendor approve koreche. Tarpor Stripe/payment setup start kora jabe.

## Step 1 - Vendor register

```http
POST /api/v1/auth/register/vendor
```

Body:

```json
{
  "email": "vendor@example.com",
  "phone": "+12025550199",
  "password": "Password123!",
  "businessName": "Demo Tacos Express",
  "businessEmail": "vendor@example.com",
  "businessPhone": "+12025550199"
}
```

Expected:

```text
Email verification code send hobe.
Vendor profile create hobe with status DRAFT.
```

## Step 2 - Email verify

```http
POST /api/v1/auth/verify-email
```

Body:

```json
{
  "email": "vendor@example.com",
  "code": "123456"
}
```

Expected:

```text
Email verified hobe.
Response-e accessToken pabe.
Next API gula te Authorization: Bearer <accessToken> lagbe.
```

## Step 3 - Check current vendor profile

```http
GET /api/v1/vendors/me
```

Header:

```text
Authorization: Bearer <VENDOR_TOKEN>
```

Expected initially:

```text
status = DRAFT
isVerified = false
verificationRequests = []
foodTrucks = []
```

## Step 4 - Upload onboarding images

Image thakle age upload kore URL nite hobe. Direct file upload onboarding JSON-e dewa jabe na.

```http
POST /api/v1/vendors/me/onboarding/upload
```

Content-Type:

```text
multipart/form-data
```

Form field:

```text
file = truck/logo/menu image
```

Expected:

```json
{
  "url": "https://res.cloudinary.com/...",
  "publicId": "bitedrop/vendors/onboarding/..."
}
```

Ei `url` Step 5 body te use korte hobe.

## Step 5 - Complete onboarding

```http
POST /api/v1/vendors/me/onboarding
```

Body:

```json
{
  "plan": "FREE",
  "selectedPlan": "FREE",
  "contact": {
    "name": "Test Vendor",
    "city": "Austin",
    "state": "TX",
    "email": "vendor@example.com",
    "phoneNumber": "+12025550199"
  },
  "truckName": "Demo Tacos Express",
  "truckCallName": "Demo Tacos",
  "truckLogoUrl": "https://res.cloudinary.com/demo/image/upload/v1/bitedrop/vendors/onboarding/logo.jpg",
  "logoUrl": "https://res.cloudinary.com/demo/image/upload/v1/bitedrop/vendors/onboarding/logo.jpg",
  "truckImageUrl": "https://res.cloudinary.com/demo/image/upload/v1/bitedrop/vendors/onboarding/truck.jpg",
  "needsProfessionalPhotos": true,
  "menuItem": {
    "name": "Birria Tacos",
    "price": 14.99,
    "description": "Slow-cooked beef tacos with consomme",
    "photoUrl": "https://res.cloudinary.com/demo/image/upload/v1/bitedrop/vendors/onboarding/birria.jpg"
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

Important:

```text
Ei API vendor approve kore na.
Ei API only vendor profile, draft food truck, menu, cuisine, service area save kore.
Ei step-er pore vendor DRAFT thakte pare.
```

Expected:

```text
Vendor onboarding saved successfully.
foodTruck create/update hobe.
```

## Step 6 - Check latest required documents

Onboarding-er pore abar profile check korte hobe, karon state TX/non-TX hole required document type change hote pare.

```http
GET /api/v1/vendors/me
```

Response-e dekho:

```text
verificationRequirements.requiredDocumentTypes
```

Texas example:

```json
[
  "DSHS_MOBILE_FOOD_VENDOR_LICENSE",
  "FOOD_MANAGER_CERTIFICATION",
  "CERTIFICATE_OF_INSURANCE"
]
```

Non-Texas example:

```json
[
  "STATE_OR_LOCAL_FOOD_VENDOR_PERMIT",
  "FOOD_MANAGER_CERTIFICATION",
  "CERTIFICATE_OF_INSURANCE"
]
```

## Step 7 - Upload verification documents

Each document file age upload korte hobe.

```http
POST /api/v1/vendors/me/verification-requests/upload
```

Content-Type:

```text
multipart/form-data
```

Form field:

```text
file = permit/certification/insurance file
```

Expected:

```json
{
  "url": "https://res.cloudinary.com/...",
  "publicId": "bitedrop/vendors/vendor-id/verification-documents/..."
}
```

## Step 8 - Submit verification request

```http
POST /api/v1/vendors/me/verification-requests
```

Texas body:

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
  "notes": "Texas vendor verification documents submitted for admin review."
}
```

Non-Texas body:

```json
{
  "documents": [
    {
      "type": "STATE_OR_LOCAL_FOOD_VENDOR_PERMIT",
      "url": "https://res.cloudinary.com/demo/raw/upload/v1/bitedrop/vendors/vendor-id/verification-documents/state-or-local-permit.pdf"
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
  "notes": "Non-Texas vendor verification documents submitted for admin review."
}
```

Expected:

```text
Vendor status = PENDING_APPROVAL
verificationRequest create hobe
Admin dashboard-e pending list-e show hobe
```

Common error:

```text
Missing required verification documents: ...
```

Cause:

```text
Step 6-er latest requiredDocumentTypes follow kora hoyni.
```

## Step 9 - Admin checks pending vendors

Admin token diye:

```http
GET /api/v1/admin/vendors/pending-approval
```

Or all vendors:

```http
GET /api/v1/admin/vendors
```

Vendor details:

```http
GET /api/v1/admin/vendors/{vendorId}
```

## Step 10 - Admin approve/reject vendor

Admin vendor details dekhe approve korbe.

```http
GET /api/v1/admin/vendors/{vendorId}
```

Approve API:

```http
PATCH /api/v1/admin/vendors/{vendorId}/approve
```

Body:

```json
{}
```

Expected approve result:

```text
Vendor status = APPROVED
Vendor isVerified = true
Vendor verifiedAt set
Vendor approvedAt set
Pending verification requests = APPROVED
```

Reject API:

```http
PATCH /api/v1/admin/vendors/{vendorId}/reject
```

Body:

```json
{
  "rejectionReason": "Incomplete business permit documents provided. Please upload a valid health safety license."
}
```

Expected reject result:

```text
Vendor status = REJECTED
Vendor isVerified = false
Vendor rejectionReason save hobe
Pending verification requests = REJECTED
```

Important:

```text
Admin individual document status update korte chaile:
PATCH /api/v1/admin/verification-requests/{requestId}/documents/{documentKey}

But final vendor approve/reject er jonno main API holo:
PATCH /api/v1/admin/vendors/{vendorId}/approve
PATCH /api/v1/admin/vendors/{vendorId}/reject
```

## Step 11 - Stripe Connect onboarding

Vendor approved na hole ei API 403 dibe.

```http
POST /api/v1/payments/connect/accounts
```

Body:

```json
{
  "refreshUrl": "https://bitedrop.com/vendor/onboarding/refresh",
  "returnUrl": "https://bitedrop.com/vendor/onboarding/return",
  "country": "US"
}
```

Expected:

```text
Stripe Express account create/continue hobe.
onboardingUrl return hobe.
Vendor oi URL open kore Stripe bank/tax/identity complete korbe.
```

## Step 12 - Check Stripe payment account

```http
GET /api/v1/payments/connect/account
```

Ready hole:

```json
{
  "onboardingCompleted": true,
  "chargesEnabled": true,
  "payoutsEnabled": true,
  "disabledReason": null
}
```

Not ready hole:

```text
disabledReason / requirements dekhe Stripe onboarding complete korte hobe.
```

## Step 13 - Vendor dashboard link

```http
POST /api/v1/payments/connect/dashboard-link
```

Expected:

```json
{
  "url": "https://connect.stripe.com/express/..."
}
```

## Final ready condition

Vendor fully ready when:

```text
Vendor status = APPROVED
isVerified = true
Stripe onboardingCompleted = true
Stripe chargesEnabled = true
Stripe payoutsEnabled = true
Subscription/plan active if required by app flow
```

## Most confusing part

```text
/vendors/me/onboarding does not submit vendor for approval.
/vendors/me/verification-requests submits vendor for admin approval.
```
