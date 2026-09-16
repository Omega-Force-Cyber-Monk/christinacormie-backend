# Admin Dashboard Fixed Endpoints

This document covers the admin dashboard APIs fixed/added during the dashboard audit.

Base URL examples use:

```bash
BASE_URL="http://localhost:3000"
ADMIN_TOKEN="<admin-jwt>"
```

All endpoints require:

```http
Authorization: Bearer <admin-jwt>
```

Common query params for list/consolidated endpoints:

```json
{
  "search": "optional text search",
  "status": "optional status filter",
  "category": "optional category/tab filter",
  "sortBy": "createdAt | updatedAt | name | status",
  "sortOrder": "asc | desc",
  "limit": 20,
  "offset": 0
}
```

## Dashboard Overview

### GET `/api/v1/admin/dashboard`

Returns the dashboard overview cards, charts, and recent activity.

**curl**

```bash
curl -X GET "$BASE_URL/api/v1/admin/dashboard" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**request**

No body.

**response**

```json
{
  "generatedAt": "2026-09-16T10:00:00.000Z",
  "cards": {
    "totalUsers": { "value": 12847, "changePercent": 12.5 },
    "activeVendors": { "value": 284, "changePercent": 8.2 },
    "liveDrops": { "value": 47 },
    "monthlyBookings": { "value": 195, "changePercent": 15.3 },
    "revenueThisMonth": { "value": 73000, "changePercent": 18.7 },
    "commissionEarned": { "value": 7300, "changePercent": 18.7 },
    "pendingPayouts": { "value": 23 },
    "activeDisputes": { "value": 5 }
  },
  "charts": {
    "revenueTrend": [{ "month": "Apr", "revenue": 62000 }],
    "monthlyBookings": [{ "month": "Apr", "bookings": 168 }]
  },
  "recentActivity": [
    {
      "id": "activity-id",
      "type": "BOOKING",
      "title": "Sarah Chen completed booking",
      "subtitle": "Taco Fiesta - $450",
      "status": "completed",
      "createdAt": "2026-09-16T09:30:00.000Z"
    }
  ]
}
```

## Bookings Management

### GET `/api/v1/admin/bookings-management`

Returns the bookings page cards, table rows, and modal-ready booking details.

**curl**

```bash
curl -X GET "$BASE_URL/api/v1/admin/bookings-management?search=taco&limit=20&offset=0" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**request**

No body. Supports common query params.

**response**

```json
{
  "generatedAt": "2026-09-16T10:00:00.000Z",
  "summary": {
    "totalBookings": 847,
    "thisMonth": 195,
    "totalRevenue": 73000,
    "pendingPaymentRelease": 2,
    "disputed": 5
  },
  "bookings": [
    {
      "id": "booking-uuid",
      "bookingNumber": "BK-3431",
      "customer": {
        "id": "customer-uuid",
        "name": "Sarah Chen",
        "email": "sarah.chen@email.com",
        "phone": "+1 (415) 555-0123"
      },
      "vendor": {
        "id": "vendor-uuid",
        "name": "Taco Fiesta",
        "email": "carlos@tacofiesta.com",
        "phone": "+1 (415) 555-0890"
      },
      "event": {
        "title": "Corporate Lunch",
        "type": "Corporate Lunch",
        "date": "2026-06-18T00:00:00.000Z",
        "startTime": "12:00 PM",
        "endTime": "3:00 PM",
        "guestCount": 50,
        "location": "Downtown Plaza"
      },
      "payment": {
        "paymentModel": "PREPAID",
        "pricingModel": "PER_PERSON",
        "totalAmount": 600,
        "commissionAmount": 90,
        "vendorPayout": 510,
        "fundsStatus": "HELD_PENDING_COMPLETION"
      },
      "status": "CONFIRMED",
      "actions": { "canViewDetails": true }
    }
  ]
}
```

Payment release and return payment actions were intentionally removed from the backend admin surface.

## Vendor Management

### GET `/api/v1/admin/vendors-management`

Returns vendor summary cards, vendor rows, truck requests, communicated requests, and photoshoot requests.

**curl**

```bash
curl -X GET "$BASE_URL/api/v1/admin/vendors-management?status=APPROVED&limit=20" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**request**

No body. Supports common query params.

**response**

```json
{
  "generatedAt": "2026-09-16T10:00:00.000Z",
  "summary": {
    "totalVendors": 284,
    "active": 267,
    "pendingApproval": 12,
    "suspended": 5
  },
  "tabs": {
    "allVendors": 20,
    "truckRequests": 2,
    "communicated": 102,
    "photoshootRequests": 20
  },
  "vendors": [
    {
      "id": "vendor-uuid",
      "vendorDisplayId": "V-1847",
      "businessName": "Taco Fiesta",
      "ownerName": "Carlos Rodriguez",
      "email": "carlos@tacofiesta.com",
      "phone": "+1 (415) 555-0890",
      "cuisineType": "Mexican",
      "serviceArea": "Downtown, West Side",
      "rating": 4.8,
      "reviews": 342,
      "followers": 1247,
      "totalBookings": 156,
      "revenueGenerated": 24500,
      "status": "APPROVED",
      "isVerified": true,
      "badges": [],
      "documents": []
    }
  ],
  "truckRequests": [
    {
      "id": "request-uuid",
      "requestDisplayId": "REQ-0041",
      "truckName": "Curry Corner",
      "usualLocation": "Union Square, SF",
      "phone": "(415) 882-3310",
      "description": "An amazing Indian food truck...",
      "reason": "They have a huge following...",
      "status": "PENDING",
      "requester": {
        "id": "user-uuid",
        "name": "Sarah Chen",
        "email": "sarah.chen@email.com"
      }
    }
  ]
}
```

### GET `/api/v1/admin/vendors/truck-requests`

Lists new food truck requests for the Truck Requests tab.

**curl**

```bash
curl -X GET "$BASE_URL/api/v1/admin/vendors/truck-requests?status=PENDING" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**request**

No body. Supports common query params.

**response**

```json
[
  {
    "id": "request-uuid",
    "truckName": "Curry Corner",
    "usualLocation": "Union Square, SF",
    "phone": "(415) 882-3310",
    "description": "An amazing Indian food truck...",
    "status": "PENDING"
  }
]
```

### PATCH `/api/v1/admin/vendors/truck-requests/:requestId`

Marks a truck request as pending, communicated, or dismissed.

**curl**

```bash
curl -X PATCH "$BASE_URL/api/v1/admin/vendors/truck-requests/request-uuid" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"COMMUNICATED","notes":"Called owner and shared onboarding link."}'
```

**request**

```json
{
  "status": "PENDING | COMMUNICATED | DISMISSED",
  "notes": "Called owner and shared onboarding link."
}
```

**response**

```json
{
  "id": "request-uuid",
  "status": "COMMUNICATED",
  "adminNotes": "Called owner and shared onboarding link.",
  "reviewedAt": "2026-09-16T10:00:00.000Z"
}
```

### PATCH `/api/v1/admin/vendors/:vendorId/suspend`

**curl**

```bash
curl -X PATCH "$BASE_URL/api/v1/admin/vendors/vendor-uuid/suspend" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**request**

No body.

**response**

```json
{
  "id": "vendor-uuid",
  "status": "SUSPENDED"
}
```

### PATCH `/api/v1/admin/vendors/:vendorId/retrieve`

**curl**

```bash
curl -X PATCH "$BASE_URL/api/v1/admin/vendors/vendor-uuid/retrieve" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**request**

No body.

**response**

```json
{
  "id": "vendor-uuid",
  "status": "APPROVED"
}
```

### DELETE `/api/v1/admin/vendors/:vendorId/badges/:badgeId`

**curl**

```bash
curl -X DELETE "$BASE_URL/api/v1/admin/vendors/vendor-uuid/badges/badge-uuid" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**request**

No body.

**response**

```json
{
  "id": "vendor-badge-uuid",
  "vendorId": "vendor-uuid",
  "badgeId": "badge-uuid",
  "revokedAt": "2026-09-16T10:00:00.000Z"
}
```

### PATCH `/api/v1/admin/verification-requests/:requestId/documents/:documentKey`

Approves or rejects a single submitted vendor document.

**curl**

```bash
curl -X PATCH "$BASE_URL/api/v1/admin/verification-requests/request-uuid/documents/businessLicense" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"REJECTED","rejectionReason":"Please upload the full document with expiration date visible."}'
```

**request**

```json
{
  "status": "PENDING | APPROVED | REJECTED",
  "rejectionReason": "Please upload the full document with expiration date visible."
}
```

**response**

```json
{
  "id": "request-uuid",
  "status": "PENDING",
  "documents": {
    "businessLicense": {
      "status": "REJECTED",
      "rejectionReason": "Please upload the full document with expiration date visible.",
      "reviewedAt": "2026-09-16T10:00:00.000Z"
    }
  }
}
```

## User Management

### GET `/api/v1/admin/users-management`

Returns user summary cards, user table rows, and modal-ready details.

**curl**

```bash
curl -X GET "$BASE_URL/api/v1/admin/users-management?search=sarah&limit=20" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**request**

No body. Supports common query params.

**response**

```json
{
  "generatedAt": "2026-09-16T10:00:00.000Z",
  "summary": {
    "totalUsers": 12847,
    "activeThisMonth": 4521,
    "newThisWeek": 142,
    "suspended": 28
  },
  "users": [
    {
      "id": "user-uuid",
      "userDisplayId": "U-8421",
      "name": "Sarah Chen",
      "email": "sarah.chen@email.com",
      "phone": "+1 (415) 555-0123",
      "location": "San Francisco, CA",
      "joinDate": "2025-08-15T00:00:00.000Z",
      "activity": {
        "bookings": 18,
        "referrals": 3
      },
      "loyalty": {
        "availablePoints": 2400,
        "lifetimePoints": 8640,
        "redeemedPoints": 3000
      },
      "status": "ACTIVE",
      "actions": {
        "canView": true,
        "canSuspend": true,
        "canRetrieve": false
      }
    }
  ]
}
```

### PATCH `/api/v1/admin/users/:userId/suspend`

**curl**

```bash
curl -X PATCH "$BASE_URL/api/v1/admin/users/user-uuid/suspend" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**request**

No body.

**response**

```json
{
  "id": "user-uuid",
  "status": "SUSPENDED"
}
```

### PATCH `/api/v1/admin/users/:userId/retrieve`

**curl**

```bash
curl -X PATCH "$BASE_URL/api/v1/admin/users/user-uuid/retrieve" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**request**

No body.

**response**

```json
{
  "id": "user-uuid",
  "status": "ACTIVE"
}
```

## Community Moderation

### GET `/api/v1/admin/community-management`

Returns community moderation cards, category tabs, post rows, report state, and modal-ready comments.

**curl**

```bash
curl -X GET "$BASE_URL/api/v1/admin/community-management?category=NEED_TRUCK&limit=20" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**request**

No body. Supports common query params. `category` can be a post category/tab such as `NEED_TRUCK`, `VENDOR_CALLOUT`, `FOR_SALE`, `HIRING`, `COMMUNITY_HELP`, or `COMMUNITY`.

**response**

```json
{
  "generatedAt": "2026-09-16T10:00:00.000Z",
  "summary": {
    "totalPosts": 5847,
    "today": 142,
    "reported": 12,
    "removedToday": 8
  },
  "tabs": {
    "allPosts": 20,
    "needATruck": 4,
    "vendorCallout": 3,
    "forSale": 2,
    "hiringJobs": 1,
    "communityHelp": 5,
    "community": 5
  },
  "posts": [
    {
      "id": "post-uuid",
      "postDisplayId": "P-5421",
      "author": {
        "id": "user-uuid",
        "name": "Sarah Chen",
        "email": "sarah.chen@email.com"
      },
      "category": "NEED_TRUCK",
      "type": "request",
      "content": "Looking for taco trucks available in Downtown this weekend!",
      "media": [],
      "likes": 24,
      "commentsCount": 8,
      "status": "OPEN",
      "reported": false,
      "reports": [],
      "comments": [
        {
          "id": "comment-uuid",
          "author": { "name": "Mike Rodriguez" },
          "content": "Try Taco Fiesta!",
          "createdAt": "2026-09-16T09:00:00.000Z"
        }
      ]
    }
  ]
}
```

### PATCH `/api/v1/admin/community/requests/:requestId`

Moderates a community request/post status.

**curl**

```bash
curl -X PATCH "$BASE_URL/api/v1/admin/community/requests/post-uuid" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"CLOSED"}'
```

**request**

```json
{
  "status": "DRAFT | OPEN | MATCHED | CLOSED | CANCELLED | EXPIRED",
  "deletedAt": "2026-09-16T10:00:00.000Z"
}
```

**response**

```json
{
  "id": "post-uuid",
  "status": "CLOSED",
  "deletedAt": null
}
```

### DELETE `/api/v1/admin/community/requests/:requestId`

Soft-removes a community post and resolves open reports.

**curl**

```bash
curl -X DELETE "$BASE_URL/api/v1/admin/community/requests/post-uuid" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**request**

No body.

**response**

```json
{
  "id": "post-uuid",
  "deletedAt": "2026-09-16T10:00:00.000Z"
}
```

## Review Management

### GET `/api/v1/admin/reviews-management`

Returns review cards, filter counts, review rows, and reported review actions.

**curl**

```bash
curl -X GET "$BASE_URL/api/v1/admin/reviews-management?category=REPORTED&limit=20" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**request**

No body. Supports common query params. `category=REPORTED` returns reported reviews. `category=CHECK_IN` is returned as an empty unsupported source because the current schema stores reviews against bookings.

**response**

```json
{
  "generatedAt": "2026-09-16T10:00:00.000Z",
  "summary": {
    "totalReviews": 3421,
    "averageRating": 4.6,
    "reported": 23,
    "removedThisWeek": 7
  },
  "tabs": {
    "allReviews": 20,
    "reportedOnly": 2,
    "bookings": 20,
    "checkIn": 0
  },
  "reviews": [
    {
      "id": "review-uuid",
      "reviewDisplayId": "R-2846",
      "source": "BOOKING",
      "customer": { "id": "user-uuid", "name": "Mike Rodriguez" },
      "vendor": { "id": "vendor-uuid", "name": "Pizza Paradise" },
      "foodTruck": { "id": "truck-uuid", "name": "Pizza Paradise" },
      "booking": { "id": "booking-uuid", "bookingNumber": "BK-3420" },
      "rating": 1,
      "content": "Terrible service...",
      "isVerified": true,
      "status": "PUBLISHED",
      "reported": true,
      "reportReason": "Unfair negative review - issue was resolved",
      "actions": {
        "canRemoveCompletely": true,
        "canHideTextOnly": true,
        "canKeepReview": true
      }
    }
  ]
}
```

### DELETE `/api/v1/admin/reviews/:reviewId`

Removes the review completely.

**curl**

```bash
curl -X DELETE "$BASE_URL/api/v1/admin/reviews/review-uuid" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**request**

No body.

**response**

```json
{
  "id": "review-uuid",
  "status": "REMOVED",
  "contentHidden": true,
  "ratingVisible": false
}
```

### PATCH `/api/v1/admin/reviews/:reviewId/hide-text`

Hides review text while keeping the rating visible.

**curl**

```bash
curl -X PATCH "$BASE_URL/api/v1/admin/reviews/review-uuid/hide-text" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**request**

No body.

**response**

```json
{
  "id": "review-uuid",
  "status": "HIDDEN",
  "contentHidden": true,
  "ratingVisible": true
}
```

### PATCH `/api/v1/admin/reviews/:reviewId/keep`

Keeps a reported review published and dismisses pending reports.

**curl**

```bash
curl -X PATCH "$BASE_URL/api/v1/admin/reviews/review-uuid/keep" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**request**

No body.

**response**

```json
{
  "id": "review-uuid",
  "status": "PUBLISHED",
  "contentHidden": false,
  "ratingVisible": true
}
```

## Payments & Payouts

### GET `/api/v1/admin/payments-management`

Returns the payout request tab, revenue overview tab, transaction history tab, and payment methods tab in one payload.

**curl**

```bash
curl -X GET "$BASE_URL/api/v1/admin/payments-management?status=PENDING&limit=20" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**request**

No body. Supports common query params.

**response**

```json
{
  "generatedAt": "2026-09-16T10:00:00.000Z",
  "summary": {
    "pendingPayouts": 23,
    "totalAmount": 48700,
    "revenueThisMonth": 73000,
    "commissionEarned": 7300
  },
  "tabs": {
    "payoutRequests": 4,
    "revenueOverview": true,
    "transactionHistory": 8,
    "paymentMethods": 5
  },
  "payoutRequests": [
    {
      "id": "payout-uuid",
      "payoutDisplayId": "PO-002",
      "vendor": {
        "id": "vendor-uuid",
        "name": "Pizza Paradise",
        "ownerName": "Maria Chen"
      },
      "amount": 1850,
      "completedBookings": 9,
      "payoutMethod": {
        "type": "STRIPE_CONNECT",
        "label": "Stripe Connected"
      },
      "requestedAt": "2026-05-22T00:00:00.000Z",
      "status": "PENDING",
      "taxInfo": {
        "w9Submitted": null,
        "taxIdType": null,
        "ytdEarnings": 5920,
        "requires1099K": true
      }
    }
  ],
  "revenueOverview": {
    "summary": {
      "totalRevenueYtd": 322000,
      "platformCommissionYtd": 48300,
      "vendorPayoutsYtd": 273700
    },
    "monthlyRevenueBreakdown": [
      { "month": "Mar", "revenue": 56000, "commission": 8400, "payouts": 47600 }
    ],
    "commissionVsPayouts": [
      { "month": "Mar", "commission": 8400, "payouts": 47600 }
    ]
  },
  "transactions": [
    {
      "id": "transaction-uuid",
      "transactionId": "TXN-8820",
      "type": "BOOKING",
      "vendorName": "Taco Fiesta",
      "amount": 600,
      "commission": 90,
      "method": "Stripe",
      "date": "2026-05-17T00:00:00.000Z",
      "status": "SUCCEEDED"
    }
  ],
  "paymentMethods": [
    {
      "id": "payment-account-uuid",
      "vendorName": "Taco Fiesta",
      "type": "STRIPE_CONNECT",
      "label": "Stripe · Connected account acct_1234",
      "isVerified": true
    }
  ],
  "schemaGaps": {
    "bankAccounts": "Only Stripe Connect account IDs are stored.",
    "paypalAccounts": "No PayPal account model exists.",
    "taxInfo": "W-9 and tax ID fields are not stored."
  }
}
```

### PATCH `/api/v1/admin/payouts/:payoutId/approve`

**curl**

```bash
curl -X PATCH "$BASE_URL/api/v1/admin/payouts/payout-uuid/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**request**

No body.

**response**

```json
{
  "id": "payout-uuid",
  "status": "PAID",
  "approvedAt": "2026-09-16T10:00:00.000Z"
}
```

### PATCH `/api/v1/admin/payouts/:payoutId/reject`

**curl**

```bash
curl -X PATCH "$BASE_URL/api/v1/admin/payouts/payout-uuid/reject" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"W-9 is missing."}'
```

**request**

```json
{
  "reason": "W-9 is missing."
}
```

**response**

```json
{
  "id": "payout-uuid",
  "status": "FAILED",
  "failureReason": "W-9 is missing."
}
```

### PATCH `/api/v1/admin/payouts/:payoutId/hold`

**curl**

```bash
curl -X PATCH "$BASE_URL/api/v1/admin/payouts/payout-uuid/hold" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Pending manual tax review."}'
```

**request**

```json
{
  "reason": "Pending manual tax review."
}
```

**response**

```json
{
  "id": "payout-uuid",
  "status": "PROCESSING",
  "failureReason": "Pending manual tax review."
}
```

## Rewards & Loyalty

### GET `/api/v1/admin/rewards-management`

Returns leaderboard, redeem transactions, top users, tier counts, and both Rewards screen summary-card variants.

**curl**

```bash
curl -X GET "$BASE_URL/api/v1/admin/rewards-management?limit=20" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**request**

No body. Supports common query params.

**response**

```json
{
  "generatedAt": "2026-09-16T10:00:00.000Z",
  "summary": {
    "pointsRedeemed": 3000,
    "creditsIssued": 30,
    "activeUsers": 8,
    "qrScansToday": 24
  },
  "paymentSummary": {
    "pendingPayouts": 23,
    "totalAmount": 48700,
    "revenueThisMonth": 73000,
    "commissionEarned": 7300
  },
  "tabs": {
    "leaderboard": 6,
    "redeemTransactions": 8,
    "topUsers": 8
  },
  "tierCounts": {
    "bitedrop_legend": 1,
    "drop_hunter": 3,
    "explorer": 2,
    "foodie": 2
  },
  "leaderboard": [
    {
      "rank": 1,
      "vendorId": "vendor-uuid",
      "foodTruckId": "truck-uuid",
      "truckName": "Taco Fiesta",
      "ownerName": "Carlos Rodriguez",
      "location": "San Francisco",
      "pointsGiven": 12400,
      "bookings": 156,
      "revenue": 48200
    }
  ],
  "redeemTransactions": [
    {
      "id": "redemption-uuid",
      "transactionId": "RDM-4412",
      "user": {
        "id": "user-uuid",
        "name": "Sarah Chen",
        "email": "sarah.chen@email.com",
        "tier": {
          "slug": "drop_hunter",
          "name": "Drop Hunter",
          "level": 3
        }
      },
      "truck": { "id": "truck-uuid", "name": "Taco Fiesta" },
      "truckOwner": {
        "id": "vendor-uuid",
        "name": "Carlos Rodriguez",
        "businessName": "Taco Fiesta"
      },
      "points": -500,
      "credit": 5,
      "date": "2026-06-03T00:00:00.000Z",
      "status": "completed"
    }
  ],
  "topUsers": [
    {
      "rank": 1,
      "userId": "user-uuid",
      "name": "Nina Patel",
      "email": "nina.p@email.com",
      "tier": {
        "slug": "bitedrop_legend",
        "name": "BiteDrop Legend",
        "level": 4
      },
      "points": 14820,
      "availablePoints": 11820,
      "redeemedPoints": 3000,
      "transactions": 48,
      "progressToLegendPercent": 100
    }
  ],
  "schemaGaps": {
    "rewardCredits": "Stored on reward_redemptions.reward_value.",
    "userTier": "Derived from loyalty_accounts.lifetime_points using rewards tier thresholds.",
    "qrScansToday": "Stored on qr_scans.scanned_at."
  }
}
```
