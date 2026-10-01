# Vendor Payment Full Test Flow — Next Steps

এই ডকুমেন্ট raw JWT token save করে না। Token `docs/real-data-stripe-connected.md` থেকে copy করে terminal variable-এ বসাও।

## 0. Set variables

```bash
BASE_URL="http://localhost:3000/api/v1"
VENDOR_TOKEN="PASTE_VENDOR_TOKEN"
CUSTOMER_TOKEN="PASTE_CUSTOMER_TOKEN"
ADMIN_TOKEN="PASTE_ADMIN_TOKEN"
```

Current ready vendor:

```text
Vendor id: 891bc561-5769-4d0a-81f9-7cc31f0137c9
Vendor email: brandnew.vendor@bitedrop.com
Stripe account: acct_1ULdpSLMkFR8Ruax
Stripe status: ready
```

Current customer:

```text
Customer id: d270a8be-a866-4dc4-ab7c-031b600e0bbf
Customer email: customer@bitedrop.com
```

## 1. Create food truck

Vendor-er kono food truck nei, tai booking/payment test-er age truck create korte hobe.

```bash
curl -X POST "$BASE_URL/food-trucks/draft" \
  -H "accept: application/json" \
  -H "Authorization: Bearer $VENDOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Brand New Gourmet Truck",
    "description": "Fresh test food truck for Stripe payment testing",
    "profileImageUrl": "https://res.cloudinary.com/demo/image/upload/v1/bitedrop/test/brand-new-truck.jpg",
    "coverImageUrl": "https://res.cloudinary.com/demo/image/upload/v1/bitedrop/test/brand-new-truck-cover.jpg",
    "minimumBookingAmount": 100,
    "maximumGuestCapacity": 100
  }'
```

Save response `id`:

```bash
FOOD_TRUCK_ID="PASTE_FOOD_TRUCK_ID"
```

## 2. Add service area

Booking create korte active service area required.

```bash
curl -X PATCH "$BASE_URL/food-trucks/$FOOD_TRUCK_ID/service-area" \
  -H "accept: application/json" \
  -H "Authorization: Bearer $VENDOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New York Test Service Area",
    "centerAddress": "100 Main St, New York, NY 10001",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "radiusKm": 50,
    "outsideRadiusAllowed": true,
    "outsideRadiusFee": 0
  }'
```

## 3. Admin activate food truck

Booking create korar jonno truck status `ACTIVE` hote hobe.

```bash
curl -X PATCH "$BASE_URL/admin/food-trucks/$FOOD_TRUCK_ID" \
  -H "accept: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "ACTIVE",
    "isFeatured": true
  }'
```

## 4. Confirm truck active

```bash
curl -X GET "$BASE_URL/food-trucks/mine" \
  -H "accept: application/json" \
  -H "Authorization: Bearer $VENDOR_TOKEN"
```

Expected:

```text
Truck id = FOOD_TRUCK_ID
status = ACTIVE
```

## 5. Customer creates booking

Real food truck:

```bash
FOOD_TRUCK_ID="98abf2ff-dec6-486d-98e3-675b9f5c0683"
```

Important:

```text
Do not send preferredMenuItemIds unless those IDs are real menu items for this truck.
Fake preferredMenuItemIds will fail validation.
```

```bash
curl -X POST "$BASE_URL/bookings" \
  -H "accept: application/json" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "foodTruckId": "98abf2ff-dec6-486d-98e3-675b9f5c0683",
    "bookingType": "EVENT",
    "eventType": "BIRTHDAY_PARTY",
    "eventName": "Ava Birthday Celebration",
    "eventDescription": "Outdoor birthday event with taco and drink service",
    "eventDate": "2026-10-25",
    "eventTime": "18:00",
    "endTime": "21:00",
    "eventTimezone": "America/Chicago",
    "guestCount": 50,
    "address": "100 Congress Ave, Austin, TX 78701",
    "contactPhone": "+12025550143",
    "latitude": 30.2672,
    "longitude": -97.7431,
    "budgetAmount": 800,
    "customMenuItems": [
      "Extra spicy chicken tacos",
      "Vegetarian platter"
    ],
    "referenceImageUrls": [
      "https://res.cloudinary.com/demo/image/upload/v1/bitedrop/bookings/reference-1.jpg"
    ],
    "paymentPreference": "DEPOSIT_ONLY",
    "specialInstructions": "Please arrive 30 minutes early for setup",
    "isAdultConfirmed": true,
    "termsAccepted": true
  }'
```

Save response `booking.id`:

```bash
BOOKING_ID="PASTE_BOOKING_ID"
```

## 6. Vendor creates quote

```bash
curl -X POST "$BASE_URL/bookings/$BOOKING_ID/quotes" \
  -H "accept: application/json" \
  -H "Authorization: Bearer $VENDOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pricingModel": "FLAT_FEE",
    "selectedMenuItems": ["Tacos", "Burgers", "Drinks"],
    "baseServiceFee": 1200,
    "transportFee": 0,
    "serviceFee": 0,
    "taxAmount": 0,
    "discountAmount": 0,
    "paymentPreference": "DEPOSIT_ONLY",
    "depositAmount": 240,
    "depositPercent": 20,
    "totalAmount": 1200,
    "balanceDueAtEvent": 960,
    "message": "Quote for Stripe payment test event",
    "noteToClient": "Deposit required before booking confirmation",
    "terms": "Deposit is required within payment window"
  }'
```

Save response `quote.id`:

```bash
QUOTE_ID="PASTE_QUOTE_ID"
```

## 7. Customer accepts quote

Real data:

```text
BOOKING_ID=50226d1d-40ff-4319-9c18-9e6b96032e17
QUOTE_ID=d7b46b75-aff2-480c-a71e-32e37b4883fe
```

API:

```http
PATCH /api/v1/bookings/quotes/d7b46b75-aff2-480c-a71e-32e37b4883fe/accept
```

Direct JSON body:

```json
{
  "paymentWindowMinutes": 30
}
```

Curl:

```bash
curl -X PATCH "$BASE_URL/bookings/quotes/d7b46b75-aff2-480c-a71e-32e37b4883fe/accept" \
  -H "accept: application/json" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentWindowMinutes": 30
  }'
```

Expected:

```text
Booking status = PAYMENT_PENDING
```

## 8. Customer creates payment intent

Real data:

```text
BOOKING_ID=50226d1d-40ff-4319-9c18-9e6b96032e17
```

API:

```http
POST /api/v1/payments/bookings/50226d1d-40ff-4319-9c18-9e6b96032e17/payment-intent
```

Direct JSON body:

```json
{
  "idempotencyKey": "booking-50226d1d-40ff-4319-9c18-9e6b96032e17-payment-1"
}
```

Curl:

```bash
curl -X POST "$BASE_URL/payments/bookings/50226d1d-40ff-4319-9c18-9e6b96032e17/payment-intent" \
  -H "accept: application/json" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "idempotencyKey": "booking-50226d1d-40ff-4319-9c18-9e6b96032e17-payment-1"
  }'
```

Save:

```bash
PAYMENT_ID="0509fd64-5550-4d0b-b0c9-afc3738a1ce7"
CLIENT_SECRET="pi_3ULfxsLMkF9Acgrk1QAO9Z7p_secret_mB8SzM2dmC7jmakDewtQeaWRz"
```

## 9. Customer confirms payment

Flutter/Web Stripe SDK will confirm using:

```text
CLIENT_SECRET
```

Real client secret for this test:

```text
pi_3ULfxsLMkF9Acgrk1QAO9Z7p_secret_mB8SzM2dmC7jmakDewtQeaWRz
```

Stripe test card:

```text
4242 4242 4242 4242
Future expiry
Any CVC
Any ZIP
```

After webhook:

```text
Payment = SUCCEEDED
Commission = created
Payout = PENDING
Booking = CONFIRMED
```

## 10. Check payment details

After Step 8, replace:

```text
PAYMENT_ID_FROM_PAYMENT_INTENT_RESPONSE
```

API:

```http
GET /api/v1/payments/{paymentId}
```

```bash
curl -X GET "$BASE_URL/payments/0509fd64-5550-4d0b-b0c9-afc3738a1ce7" \
  -H "accept: application/json" \
  -H "Authorization: Bearer $VENDOR_TOKEN"
```

Expected:

```text
status = SUCCEEDED
commission exists
payout.status = PENDING
```

## 11. Vendor transaction history

```bash
curl -X GET "$BASE_URL/payments/vendor/transactions?page=1&limit=20" \
  -H "accept: application/json" \
  -H "Authorization: Bearer $VENDOR_TOKEN"
```

Expected:

```text
paymentStatus = SUCCEEDED
grossAmount = 240.00
vendorNetAmount = after commission
payout.status = PENDING
```

## 12. Vendor payment summary

```bash
curl -X GET "$BASE_URL/payments/vendor/summary" \
  -H "accept: application/json" \
  -H "Authorization: Bearer $VENDOR_TOKEN"
```

Expected:

```text
totalPayments >= 1
succeededPayments >= 1
pendingPayout includes vendor net amount
```

## Important payout note

Customer payment success does not instantly mean vendor bank payout is complete.

Current backend flow:

```text
Customer pays
→ platform receives payment
→ vendor transaction is visible
→ vendor payout record is PENDING
→ payout transfer happens after booking completion/release flow
```
