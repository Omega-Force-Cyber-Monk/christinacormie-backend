curl -X 'POST' \
  'http://localhost:3000/api/v1/auth/login' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "email": "brandnew.vendor@bitedrop.com",
  "password": "Password123!"
}'
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMmZlNDUxMi02YjI5LTQ3M2MtODAzMi1hZjU1ODFjNzA1YTYiLCJlbWFpbCI6ImJyYW5kbmV3LnZlbmRvckBiaXRlZHJvcC5jb20iLCJyb2xlcyI6WyJWRU5ET1IiXSwiaWF0IjoxNzkwODM3MzQ3LCJleHAiOjE3OTM0MjkzNDd9.HNuI1A63oH41kLLkxAGMZqb8WAYJ2AVcjHu1slP2zyI",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMmZlNDUxMi02YjI5LTQ3M2MtODAzMi1hZjU1ODFjNzA1YTYiLCJqdGkiOiI1MzU0MWEyNS0wZmUwLTRlNGQtYjcxNy0wYTUzY2FlNzFhNzciLCJpYXQiOjE3OTA4MzczNDcsImV4cCI6MTc5MzQyOTM0N30.oy3Eh5ZasNcSWveb3bqlzMvUuo7yVFCp6doKoAbdKpQ",
  "user": {
    "id": "02fe4512-6b29-473c-8032-af5581c705a6",
    "email": "brandnew.vendor@bitedrop.com",
    "displayName": "BrandNew Vendor",
    "roles": [
      "VENDOR"
    ],
    "vendor": {
      "id": "891bc561-5769-4d0a-81f9-7cc31f0137c9",
      "businessName": "Brand New Gourmet Truck"
    }
  }
}

2.
curl -X 'POST' \
  'http://localhost:3000/api/v1/payments/connect/accounts' \
  -H 'accept: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMmZlNDUxMi02YjI5LTQ3M2MtODAzMi1hZjU1ODFjNzA1YTYiLCJlbWFpbCI6ImJyYW5kbmV3LnZlbmRvckBiaXRlZHJvcC5jb20iLCJyb2xlcyI6WyJWRU5ET1IiXSwiaWF0IjoxNzkwODM3MzQ3LCJleHAiOjE3OTM0MjkzNDd9.HNuI1A63oH41kLLkxAGMZqb8WAYJ2AVcjHu1slP2zyI' \
  -H 'Content-Type: application/json' \
  -d '{
  "refreshUrl": "https://bitedrop.com/vendor/onboarding/refresh",
  "returnUrl": "https://bitedrop.com/vendor/onboarding/return",
  "country": "US"
}'
{
  "paymentAccount": {
    "id": "a6aab656-d6fb-4592-8556-71c862c34e59",
    "vendorId": "891bc561-5769-4d0a-81f9-7cc31f0137c9",
    "stripeAccountId": "acct_1ULdpSLMkFR8Ruax",
    "onboardingCompleted": false,
    "chargesEnabled": false,
    "payoutsEnabled": false,
    "disabledReason": null,
    "updatedAt": "2026-10-01T06:50:58.679Z"
  },
  "onboardingUrl": "https://connect.stripe.com/setup/e/acct_1ULdpSLMkFR8Ruax/aLR27w7ZUq6V"
}

3.
curl -X 'GET' \
  'http://localhost:3000/api/v1/payments/connect/account' \
  -H 'accept: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMmZlNDUxMi02YjI5LTQ3M2MtODAzMi1hZjU1ODFjNzA1YTYiLCJlbWFpbCI6ImJyYW5kbmV3LnZlbmRvckBiaXRlZHJvcC5jb20iLCJyb2xlcyI6WyJWRU5ET1IiXSwiaWF0IjoxNzkwODM3MzQ3LCJleHAiOjE3OTM0MjkzNDd9.HNuI1A63oH41kLLkxAGMZqb8WAYJ2AVcjHu1slP2zyI'

{
  "id": "a6aab656-d6fb-4592-8556-71c862c34e59",
  "vendorId": "891bc561-5769-4d0a-81f9-7cc31f0137c9",
  "stripeAccountId": "acct_1ULdpSLMkFR8Ruax",
  "onboardingCompleted": true,
  "chargesEnabled": true,
  "payoutsEnabled": true,
  "disabledReason": null,
  "updatedAt": "2026-10-01T06:57:14.453Z",
  "stripe": {
    "accountType": "none",
    "country": "US",
    "detailsSubmitted": true,
    "chargesEnabled": true,
    "payoutsEnabled": true,
    "requirements": {
      "currentlyDue": [],
      "eventuallyDue": [],
      "pastDue": [],
      "pendingVerification": [],
      "disabledReason": null
    }
  }
}

4.
curl -X 'POST' \
  'http://localhost:3000/api/v1/payments/connect/dashboard-link' \
  -H 'accept: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMmZlNDUxMi02YjI5LTQ3M2MtODAzMi1hZjU1ODFjNzA1YTYiLCJlbWFpbCI6ImJyYW5kbmV3LnZlbmRvckBiaXRlZHJvcC5jb20iLCJyb2xlcyI6WyJWRU5ET1IiXSwiaWF0IjoxNzkwODM3MzQ3LCJleHAiOjE3OTM0MjkzNDd9.HNuI1A63oH41kLLkxAGMZqb8WAYJ2AVcjHu1slP2zyI' \
  -d ''

{
  "object": "login_link",
  "created": 1790837863,
  "url": "https://connect.stripe.com/express/acct_1ULdpSLMkFR8Ruax/yfItmaM43nwk"
}

5.
curl -X 'GET' \
  'http://localhost:3000/api/v1/payments/vendor/summary' \
  -H 'accept: */*' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMmZlNDUxMi02YjI5LTQ3M2MtODAzMi1hZjU1ODFjNzA1YTYiLCJlbWFpbCI6ImJyYW5kbmV3LnZlbmRvckBiaXRlZHJvcC5jb20iLCJyb2xlcyI6WyJWRU5ET1IiXSwiaWF0IjoxNzkwODM3MzQ3LCJleHAiOjE3OTM0MjkzNDd9.HNuI1A63oH41kLLkxAGMZqb8WAYJ2AVcjHu1slP2zyI'

{
  "totalPayments": 0,
  "succeededPayments": 0,
  "failedPayments": 0,
  "processingPayments": 0,
  "refundedPayments": 0,
  "totalGross": "0.00",
  "totalCommission": "0.00",
  "totalNet": "0.00",
  "totalRefunded": "0.00",
  "pendingPayout": "0.00",
  "processingPayout": "0.00",
  "paidPayout": "0.00",
  "failedPayout": "0.00",
  "currency": "USD"
}

6. customer
curl -X 'POST' \
  'http://localhost:3000/api/v1/auth/login' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "email": "customer@bitedrop.com",
  "password": "Password123!"
}'
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkMjcwYThiZS1hODY2LTRkYzQtYWI3Yy0wMzFiNjAwZTBiYmYiLCJlbWFpbCI6ImN1c3RvbWVyQGJpdGVkcm9wLmNvbSIsInJvbGVzIjpbIkNVU1RPTUVSIl0sImlhdCI6MTc5MDg0MjUxMiwiZXhwIjoxNzkzNDM0NTEyfQ.zHzXwKcE65zJd3GdMkYOecsjC13NTy5MKHorEVreHiE",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkMjcwYThiZS1hODY2LTRkYzQtYWI3Yy0wMzFiNjAwZTBiYmYiLCJqdGkiOiJkY2RkOGQyYS1iYzJiLTQ3NjctOTM5NS1mMTk4YzQ4OTVkMzgiLCJpYXQiOjE3OTA4NDI1MTIsImV4cCI6MTc5MzQzNDUxMn0.s0fUTAbg4woT-Ri4DMsXA8XAYMi6dg2cQ8vmKOt7AWc",
  "user": {
    "id": "d270a8be-a866-4dc4-ab7c-031b600e0bbf",
    "email": "customer@bitedrop.com",
    "displayName": "Alex Rivera 9226",
    "roles": [
      "CUSTOMER"
    ]
  }
}

7. customer
curl -X 'GET' \
  'http://localhost:3000/api/v1/users/me' \
  -H 'accept: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkMjcwYThiZS1hODY2LTRkYzQtYWI3Yy0wMzFiNjAwZTBiYmYiLCJlbWFpbCI6ImN1c3RvbWVyQGJpdGVkcm9wLmNvbSIsInJvbGVzIjpbIkNVU1RPTUVSIl0sImlhdCI6MTc5MDg0MjUxMiwiZXhwIjoxNzkzNDM0NTEyfQ.zHzXwKcE65zJd3GdMkYOecsjC13NTy5MKHorEVreHiE'

{
  "id": "d270a8be-a866-4dc4-ab7c-031b600e0bbf",
  "email": "customer@bitedrop.com",
  "phone": "+15551234567",
  "status": "ACTIVE",
  "emailVerifiedAt": "2026-09-12T18:02:58.596Z",
  "phoneVerifiedAt": null,
  "lastLoginAt": "2026-10-01T08:15:12.594Z",
  "createdAt": "2026-09-12T18:02:58.866Z",
  "updatedAt": "2026-09-12T18:02:58.866Z",
  "roles": [
    "CUSTOMER"
  ],
  "profile": {
    "id": "6bbfa57c-89e8-42ef-b148-208805563182",
    "userId": "d270a8be-a866-4dc4-ab7c-031b600e0bbf",
    "firstName": "Alex9226",
    "lastName": "Rivera",
    "displayName": "Alex Rivera 9226",
    "dateOfBirth": null,
    "avatarUrl": "https://res.cloudinary.com/urr2coep/image/upload/v1789377411/bitedrop/users/d270a8be-a866-4dc4-ab7c-031b600e0bbf/avatars/ul9gouvhd1dssgfb5dij.png",
    "bio": "Passionate food truck enthusiast updated at 1789376309226",
    "city": null,
    "state": null,
    "country": null,
    "postalCode": null,
    "createdAt": "2026-09-12T18:02:58.866Z",
    "updatedAt": "2026-09-12T18:02:58.866Z"
  },
  "settings": {
    "id": "1f6f232a-5449-438e-9444-4bf15ec03842",
    "userId": "d270a8be-a866-4dc4-ab7c-031b600e0bbf",
    "language": "en",
    "timezone": "America/New_York",
    "distanceUnit": "MILES",
    "locationPermissionGranted": false,
    "pushPermissionGranted": false,
    "marketingConsent": false,
    "createdAt": "2026-09-12T18:02:58.866Z",
    "updatedAt": "2026-09-12T18:02:58.866Z"
  },
  "notificationPreference": {
    "id": "3bf865e6-e328-4804-9e97-f0a1a9f563cd",
    "userId": "d270a8be-a866-4dc4-ab7c-031b600e0bbf",
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
  },
  "interestCuisines": [],
  "vendor": null
}

8.
curl -X 'GET' \
  'http://localhost:3000/api/v1/food-trucks/mine' \
  -H 'accept: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMmZlNDUxMi02YjI5LTQ3M2MtODAzMi1hZjU1ODFjNzA1YTYiLCJlbWFpbCI6ImJyYW5kbmV3LnZlbmRvckBiaXRlZHJvcC5jb20iLCJyb2xlcyI6WyJWRU5ET1IiXSwiaWF0IjoxNzkwODM3MzQ3LCJleHAiOjE3OTM0MjkzNDd9.HNuI1A63oH41kLLkxAGMZqb8WAYJ2AVcjHu1slP2zyI'

[
  {
    "id": "98abf2ff-dec6-486d-98e3-675b9f5c0683",
    "vendorId": "891bc561-5769-4d0a-81f9-7cc31f0137c9",
    "marketId": null,
    "name": "Tasty Tacos Express",
    "truckCallName": null,
    "truckType": null,
    "primaryCity": null,
    "slug": "tasty-tacos-express",
    "handle": null,
    "description": "Authentic gourmet street tacos & fresh salsas",
    "profileImageUrl": "https://cdn.bitedrop.com/trucks/tasty-tacos-profile.jpg",
    "coverImageUrl": "https://cdn.bitedrop.com/trucks/tasty-tacos-cover.jpg",
    "status": "ACTIVE",
    "operatingStatus": "CLOSED",
    "minimumBookingAmount": "300",
    "maximumGuestCapacity": 100,
    "currentAddress": null,
    "locationUpdatedAt": null,
    "locationValidUntil": null,
    "averageRating": "0",
    "totalReviews": 0,
    "totalBookings": 0,
    "totalCheckIns": 0,
    "followerCount": 0,
    "isFeatured": true,
    "createdAt": "2026-10-01T08:30:05.947Z",
    "updatedAt": "2026-10-01T08:39:03.532Z",
    "deletedAt": null,
    "images": [],
    "cuisines": [],
    "menus": [],
    "serviceAreas": [
      {
        "id": "0bf910c7-fc0e-4451-b215-bff2fc7d6c76",
        "foodTruckId": "98abf2ff-dec6-486d-98e3-675b9f5c0683",
        "name": "New York Test Service Area",
        "centerAddress": "100 Main St, New York, NY 10001",
        "radiusKm": "50",
        "outsideRadiusAllowed": true,
        "outsideRadiusFee": "0",
        "isActive": true
      }
    ],
    "operatingHours": [],
    "availabilityExceptions": []
  }
]

8.
curl -X 'POST' \
  'http://localhost:3000/api/v1/bookings' \
  -H 'accept: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkMjcwYThiZS1hODY2LTRkYzQtYWI3Yy0wMzFiNjAwZTBiYmYiLCJlbWFpbCI6ImN1c3RvbWVyQGJpdGVkcm9wLmNvbSIsInJvbGVzIjpbIkNVU1RPTUVSIl0sImlhdCI6MTc5MDg0MjUxMiwiZXhwIjoxNzkzNDM0NTEyfQ.zHzXwKcE65zJd3GdMkYOecsjC13NTy5MKHorEVreHiE' \
  -H 'Content-Type: application/json' \
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

{
  "message": "Booking request sent! Your booking request has been sent to the vendor. You'll receive a quote within 24 hours.",
  "booking": {
    "id": "50226d1d-40ff-4319-9c18-9e6b96032e17",
    "bookingNumber": "BD-20261001-CEHTJ9",
    "customerId": "d270a8be-a866-4dc4-ab7c-031b600e0bbf",
    "vendorId": "891bc561-5769-4d0a-81f9-7cc31f0137c9",
    "foodTruckId": "98abf2ff-dec6-486d-98e3-675b9f5c0683",
    "communityRequestId": null,
    "vendorOfferId": null,
    "bookingType": "EVENT",
    "eventType": "BIRTHDAY_PARTY",
    "status": "PENDING",
    "eventName": "Ava Birthday Celebration",
    "eventDescription": "Outdoor birthday event with taco and drink service",
    "startsAt": "2026-10-25T23:00:00.000Z",
    "endsAt": "2026-10-26T02:00:00.000Z",
    "guestCount": 50,
    "address": "100 Congress Ave, Austin, TX 78701",
    "contactPhone": "+12025550143",
    "distanceFromServiceCenterKm": "2434.62",
    "outsideServiceRadius": true,
    "outsideRadiusFee": "0",
    "budgetAmount": "800",
    "subtotal": "0",
    "discountAmount": "0",
    "taxAmount": "0",
    "serviceFee": "0",
    "totalAmount": "0",
    "preferredMenuItemIds": null,
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
    "termsAccepted": true,
    "cancellationReason": null,
    "acceptedAt": null,
    "confirmedAt": null,
    "completionRequestedAt": null,
    "completionRequestedById": null,
    "completionApprovedAt": null,
    "completionApprovedById": null,
    "paymentReleasedAt": null,
    "completedAt": null,
    "cancelledAt": null,
    "createdAt": "2026-10-01T08:47:58.718Z",
    "customer": {
      "id": "d270a8be-a866-4dc4-ab7c-031b600e0bbf",
      "email": "customer@bitedrop.com",
      "phone": "+15551234567",
      "profile": {
        "displayName": "Alex Rivera 9226",
        "firstName": "Alex9226",
        "lastName": "Rivera",
        "avatarUrl": "https://res.cloudinary.com/urr2coep/image/upload/v1789377411/bitedrop/users/d270a8be-a866-4dc4-ab7c-031b600e0bbf/avatars/ul9gouvhd1dssgfb5dij.png"
      }
    },
    "foodTruck": {
      "id": "98abf2ff-dec6-486d-98e3-675b9f5c0683",
      "name": "Tasty Tacos Express",
      "slug": "tasty-tacos-express",
      "vendorId": "891bc561-5769-4d0a-81f9-7cc31f0137c9",
      "profileImageUrl": "https://cdn.bitedrop.com/trucks/tasty-tacos-profile.jpg"
    },
    "vendor": {
      "id": "891bc561-5769-4d0a-81f9-7cc31f0137c9",
      "userId": "02fe4512-6b29-473c-8032-af5581c705a6",
      "businessName": "Brand New Gourmet Truck",
      "logoUrl": null
    },
    "communityRequest": null,
    "vendorOffer": null,
    "quotes": [],
    "statusHistory": [
      {
        "id": "1c88947b-f82a-4270-b903-44ce095e5c96",
        "bookingId": "50226d1d-40ff-4319-9c18-9e6b96032e17",
        "previousStatus": null,
        "newStatus": "PENDING",
        "changedById": "d270a8be-a866-4dc4-ab7c-031b600e0bbf",
        "reason": "Booking request created",
        "createdAt": "2026-10-01T08:47:58.846Z"
      }
    ]
  }
}

9.
curl -X 'POST' \
  'http://localhost:3000/api/v1/bookings/50226d1d-40ff-4319-9c18-9e6b96032e17/quotes' \
  -H 'accept: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMmZlNDUxMi02YjI5LTQ3M2MtODAzMi1hZjU1ODFjNzA1YTYiLCJlbWFpbCI6ImJyYW5kbmV3LnZlbmRvckBiaXRlZHJvcC5jb20iLCJyb2xlcyI6WyJWRU5ET1IiXSwiaWF0IjoxNzkwODM3MzQ3LCJleHAiOjE3OTM0MjkzNDd9.HNuI1A63oH41kLLkxAGMZqb8WAYJ2AVcjHu1slP2zyI' \
  -H 'Content-Type: application/json' \
  -d '{
  "pricingModel": "FLAT_FEE",
  "selectedMenuItems": [
    "Extra spicy chicken tacos",
    "Vegetarian platter",
    "Fresh drinks"
  ],
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
  "message": "Quote for Ava Birthday Celebration with taco and drink service.",
  "noteToClient": "Includes setup, serving station, tacos, vegetarian platter, and drinks. Please complete the deposit payment to confirm the booking.",
  "terms": "20% deposit is required to confirm the booking. Remaining balance is due at the event."
}'

{
  "quote": {
    "pricePerPerson": null,
    "id": "d7b46b75-aff2-480c-a71e-32e37b4883fe",
    "bookingId": "50226d1d-40ff-4319-9c18-9e6b96032e17",
    "vendorId": "891bc561-5769-4d0a-81f9-7cc31f0137c9",
    "pricingModel": "FLAT_FEE",
    "selectedMenuItems": [
      "Extra spicy chicken tacos",
      "Vegetarian platter",
      "Fresh drinks"
    ],
    "extraCharges": null,
    "baseServiceFee": "1200",
    "transportFee": "0",
    "subtotal": "1200",
    "outsideRadiusFee": "0",
    "serviceFee": "0",
    "taxAmount": "0",
    "discountAmount": "0",
    "totalAmount": "1200",
    "paymentPreference": "DEPOSIT_ONLY",
    "depositAmount": "240",
    "depositPercent": "20",
    "balanceDueAtEvent": "960",
    "message": "Quote for Ava Birthday Celebration with taco and drink service.",
    "noteToClient": "Includes setup, serving station, tacos, vegetarian platter, and drinks. Please complete the deposit payment to confirm the booking.",
    "terms": "20% deposit is required to confirm the booking. Remaining balance is due at the event.",
    "status": "PENDING",
    "expiresAt": null,
    "createdAt": "2026-10-01T08:50:11.530Z"
  },
  "booking": {
    "id": "50226d1d-40ff-4319-9c18-9e6b96032e17",
    "bookingNumber": "BD-20261001-CEHTJ9",
    "customerId": "d270a8be-a866-4dc4-ab7c-031b600e0bbf",
    "vendorId": "891bc561-5769-4d0a-81f9-7cc31f0137c9",
    "foodTruckId": "98abf2ff-dec6-486d-98e3-675b9f5c0683",
    "communityRequestId": null,
    "vendorOfferId": null,
    "bookingType": "EVENT",
    "eventType": "BIRTHDAY_PARTY",
    "status": "QUOTED",
    "eventName": "Ava Birthday Celebration",
    "eventDescription": "Outdoor birthday event with taco and drink service",
    "startsAt": "2026-10-25T23:00:00.000Z",
    "endsAt": "2026-10-26T02:00:00.000Z",
    "guestCount": 50,
    "address": "100 Congress Ave, Austin, TX 78701",
    "contactPhone": "+12025550143",
    "distanceFromServiceCenterKm": "2434.62",
    "outsideServiceRadius": true,
    "outsideRadiusFee": "0",
    "budgetAmount": "800",
    "subtotal": "0",
    "discountAmount": "0",
    "taxAmount": "0",
    "serviceFee": "0",
    "totalAmount": "0",
    "preferredMenuItemIds": null,
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
    "termsAccepted": true,
    "cancellationReason": null,
    "acceptedAt": null,
    "confirmedAt": null,
    "completionRequestedAt": null,
    "completionRequestedById": null,
    "completionApprovedAt": null,
    "completionApprovedById": null,
    "paymentReleasedAt": null,
    "completedAt": null,
    "cancelledAt": null,
    "createdAt": "2026-10-01T08:47:58.718Z",
    "customer": {
      "id": "d270a8be-a866-4dc4-ab7c-031b600e0bbf",
      "email": "customer@bitedrop.com",
      "phone": "+15551234567",
      "profile": {
        "displayName": "Alex Rivera 9226",
        "firstName": "Alex9226",
        "lastName": "Rivera",
        "avatarUrl": "https://res.cloudinary.com/urr2coep/image/upload/v1789377411/bitedrop/users/d270a8be-a866-4dc4-ab7c-031b600e0bbf/avatars/ul9gouvhd1dssgfb5dij.png"
      }
    },
    "foodTruck": {
      "id": "98abf2ff-dec6-486d-98e3-675b9f5c0683",
      "name": "Tasty Tacos Express",
      "slug": "tasty-tacos-express",
      "vendorId": "891bc561-5769-4d0a-81f9-7cc31f0137c9",
      "profileImageUrl": "https://cdn.bitedrop.com/trucks/tasty-tacos-profile.jpg"
    },
    "vendor": {
      "id": "891bc561-5769-4d0a-81f9-7cc31f0137c9",
      "userId": "02fe4512-6b29-473c-8032-af5581c705a6",
      "businessName": "Brand New Gourmet Truck",
      "logoUrl": null
    },
    "communityRequest": null,
    "vendorOffer": null,
    "quotes": [
      {
        "pricePerPerson": null,
        "id": "d7b46b75-aff2-480c-a71e-32e37b4883fe",
        "bookingId": "50226d1d-40ff-4319-9c18-9e6b96032e17",
        "vendorId": "891bc561-5769-4d0a-81f9-7cc31f0137c9",
        "pricingModel": "FLAT_FEE",
        "selectedMenuItems": [
          "Extra spicy chicken tacos",
          "Vegetarian platter",
          "Fresh drinks"
        ],
        "extraCharges": null,
        "baseServiceFee": "1200",
        "transportFee": "0",
        "subtotal": "1200",
        "outsideRadiusFee": "0",
        "serviceFee": "0",
        "taxAmount": "0",
        "discountAmount": "0",
        "totalAmount": "1200",
        "paymentPreference": "DEPOSIT_ONLY",
        "depositAmount": "240",
        "depositPercent": "20",
        "balanceDueAtEvent": "960",
        "message": "Quote for Ava Birthday Celebration with taco and drink service.",
        "noteToClient": "Includes setup, serving station, tacos, vegetarian platter, and drinks. Please complete the deposit payment to confirm the booking.",
        "terms": "20% deposit is required to confirm the booking. Remaining balance is due at the event.",
        "status": "PENDING",
        "expiresAt": null,
        "createdAt": "2026-10-01T08:50:11.530Z"
      }
    ],
    "statusHistory": [
      {
        "id": "1c88947b-f82a-4270-b903-44ce095e5c96",
        "bookingId": "50226d1d-40ff-4319-9c18-9e6b96032e17",
        "previousStatus": null,
        "newStatus": "PENDING",
        "changedById": "d270a8be-a866-4dc4-ab7c-031b600e0bbf",
        "reason": "Booking request created",
        "createdAt": "2026-10-01T08:47:58.846Z"
      }
    ]
  },
  "message": "Quote sent successfully",
  "breakdown": {
    "pricingModel": "FLAT_FEE",
    "baseServiceFee": 1200,
    "transportFee": 0,
    "serviceFee": 0,
    "taxAmount": 0,
    "discountAmount": 0,
    "quotedAmount": 1200,
    "paymentPreference": "DEPOSIT_ONLY",
    "depositAmount": 240,
    "depositPercent": 20,
    "balanceDueAtEvent": 960,
    "commissionAmount": 240,
    "vendorNetAmount": 0
  }
}