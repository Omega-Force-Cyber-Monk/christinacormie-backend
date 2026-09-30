# Bite Drop Rewards — App Developer API Handoff

এই ডকুমেন্টটি Flutter/App developer-এর জন্য। এখানে backend rewards flow, নতুন/updated API, request/response fields, এবং app side কোন screen-এ কোন API লাগবে — এগুলো explain করা হয়েছে।

Implementation code এখানে দেওয়া হয়নি। App developer এই API contract follow করে নিজে অথবা agent দিয়ে implement করতে পারবে।

## 1. New Rewards Flow

Client-এর latest requirement অনুযায়ী reward flow এখন campaign/rule based:

```text
Admin reward campaign create করবে
→ Foodie rewards list দেখবে
→ Foodie একটি reward select করবে
→ App rewardRuleId দিয়ে QR/code generate করবে
→ Vendor QR/token/manual code scan/enter করবে
→ Backend সব rule validate করবে
→ Vendor confirm করলে redemption completed হবে
→ Vendor নিজের POS/register-এ manually discount apply করবে
→ Admin redemption history দেখতে পারবে
```

Important:

```text
App must use rewardRuleId based flow.
Old amount-only flow production rewards-এর জন্য recommended না।
```

## 2. Important Business Rules

### Standard reward funding

Default reward funding:

```text
VENDOR_FUNDED
```

মানে standard rewards-এর discount vendor নিজে absorb করবে। Bite Drop vendor-কে reimburse করবে না।

### Minimum purchase

Example:

```text
$5 reward → minimum purchase $15
$10 reward → minimum purchase $25
```

Backend minimum purchase amount save/show করবে। Vendor নিজের POS/register subtotal দেখে manually confirm করবে।

Backend currently POS subtotal enforce করে না।

### Single-use QR/code

একটি redemption token/manual code একবার confirm হলে আর use করা যাবে না।

### Points hold/deduct timing

QR/code generate করার সময় points temporarily deduct/hold হয়।

যদি QR/code expire হয়, expired refund job/logic points refund করে।

## 3. Authentication

All user/vendor/admin APIs require Bearer token:

```http
Authorization: Bearer <accessToken>
```

## 4. Foodie APIs

## 4.1 Get Rewards List

Foodie rewards page open করার সময় এই API call করবে।

```http
GET /api/v1/rewards/rules
```

Auth:

```text
Customer/Foodie token required
```

Backend returns only active/current rewards:

- inactive reward আসবে না
- expired reward আসবে না
- future reward আসবে না

Response example:

```json
[
  {
    "id": "caf914ce-6939-4411-9aa2-2512da843796",
    "name": "$5 Bite Drop Reward",
    "description": "Redeem 500 points for a $5 Bite Drop Reward. Minimum purchase $15.",
    "triggerType": "LOYALTY_POINTS",
    "rewardType": "DISCOUNT",
    "pointsRequired": 500,
    "rewardAmount": 5,
    "rewardValue": 5,
    "minimumPurchaseAmount": 15,
    "fundingType": "VENDOR_FUNDED",
    "eligibleVendorScope": "ALL_APPROVED_VENDORS",
    "totalRedemptionLimit": null,
    "maximumUsesPerUser": null,
    "configuration": {
      "discountType": "FIXED_AMOUNT",
      "amount": 5
    },
    "startsAt": null,
    "endsAt": null,
    "isActive": true
  }
]
```

App should display:

```text
Reward amount: rewardAmount
Points required: pointsRequired
Minimum purchase: minimumPurchaseAmount
```

Example UI text:

```text
$5 Bite Drop Reward
500 points
Valid for $15+ purchase
```

## 4.2 Create QR/code for Selected Reward

Foodie reward select করার পর QR/code generate করতে এই API call করবে।

```http
POST /api/v1/rewards/me/redemption-codes
```

Recommended request body:

```json
{
  "rewardRuleId": "caf914ce-6939-4411-9aa2-2512da843796",
  "foodTruckId": "15013bc8-6cdb-44a6-823a-b0ec5982df5b"
}
```

Fields:

| Field | Required | Meaning |
|---|---:|---|
| `rewardRuleId` | Yes | Selected reward/campaign ID from `GET /rewards/rules` |
| `foodTruckId` | Optional but recommended | If user is redeeming at a specific truck, pass that truck ID |

Response example:

```json
{
  "redemptionId": "58bff55d-bba5-44a9-82fc-afcfee4ff8ae",
  "redemptionToken": "rdm_224451_mumik50i",
  "backupCode": "224451",
  "amount": 5,
  "rewardAmount": 5,
  "rewardRuleId": "caf914ce-6939-4411-9aa2-2512da843796",
  "fundingType": "VENDOR_FUNDED",
  "minimumPurchaseAmount": 15,
  "pointsSpent": 500,
  "expiresAt": "2026-09-29T10:23:28.770Z",
  "status": "PENDING",
  "message": "Show this screen to staff or provide 6-digit backup code: 224451"
}
```

App should show:

- QR code generated from `redemptionToken`
- manual backup code from `backupCode`
- reward amount
- minimum purchase
- expiry time

Example UI:

```text
$5 Bite Drop Reward
Valid for $15+ purchase
Show this QR to vendor
Backup code: 224451
Expires at: ...
```

Backend validation during QR/code creation:

- enough points আছে কিনা
- reward active কিনা
- reward expired কিনা
- per-user limit reached কিনা
- total campaign limit reached কিনা
- selected vendor/truck eligible কিনা

Common errors:

```json
{
  "message": "Not enough points. 500 points required for $5 reward.",
  "error": "Bad Request",
  "statusCode": 400
}
```

```json
{
  "message": "Reward rule is inactive",
  "error": "Bad Request",
  "statusCode": 400
}
```

```json
{
  "message": "Reward campaign total redemption limit reached",
  "error": "Bad Request",
  "statusCode": 400
}
```

```json
{
  "message": "This food truck is not eligible for this reward",
  "error": "Bad Request",
  "statusCode": 400
}
```

## 4.3 Foodie Confirmed Redemptions for Review

Review eligibility বা previously confirmed redemptions দেখানোর জন্য:

```http
GET /api/v1/rewards/me/redemptions
```

Response example:

```json
[
  {
    "id": "redemption-id",
    "foodTruckId": "food-truck-id",
    "foodTruckName": "Taco Paradise",
    "vendorId": "vendor-id",
    "amountApplied": 5,
    "minimumPurchaseAmount": 15,
    "confirmedAt": "2026-09-29T10:00:08.234Z",
    "redemptionMethod": "QR_SCAN",
    "alreadyReviewed": false,
    "reviewId": null
  }
]
```

## 5. Vendor APIs

## 5.1 Confirm Redemption by QR Token or Manual Code

Vendor app QR scan করার পর বা manual code enter করার পর এই API call করবে।

```http
POST /api/v1/vendors/me/redemptions/confirm
```

Auth:

```text
Vendor or Vendor Staff token required
```

QR token request:

```json
{
  "redemptionToken": "rdm_224451_mumik50i"
}
```

Manual code request:

```json
{
  "manualCode": "224451"
}
```

Success response:

```json
{
  "success": true,
  "amountApplied": 5,
  "minimumPurchaseAmount": 15,
  "customerName": "Alex Rivera",
  "remainingCustomerBalance": 25,
  "message": "Redemption Complete. $5.00 credit applied for Alex Rivera."
}
```

Vendor app should show:

```text
Redemption Complete
$5 discount
Minimum purchase: $15
Customer: Alex Rivera
```

Then vendor manually applies discount in their own POS/register.

Common errors:

```json
{
  "message": "Either redemptionToken or manualCode must be provided",
  "error": "Bad Request",
  "statusCode": 400
}
```

```json
{
  "message": "Invalid or expired redemption code",
  "error": "Not Found",
  "statusCode": 404
}
```

```json
{
  "message": "This redemption code was generated for another food truck",
  "error": "Bad Request",
  "statusCode": 400
}
```

```json
{
  "message": "This vendor is not eligible to redeem this reward",
  "error": "Bad Request",
  "statusCode": 400
}
```

```json
{
  "message": "Vendor account is not approved yet. Please complete onboarding and submit verification documents for admin review.",
  "error": "Forbidden",
  "statusCode": 403
}
```

## 6. Admin APIs

These are mainly for admin panel, but app developer should understand them because Foodie/Vendor flow depends on admin-created reward campaigns.

## 6.1 Create Reward Rule

```http
POST /api/v1/admin/rewards/rules
```

Admin token required.

Request example:

```json
{
  "name": "$5 Bite Drop Reward",
  "description": "Redeem 500 points for a $5 Bite Drop Reward. Minimum purchase $15.",
  "triggerType": "LOYALTY_POINTS",
  "rewardType": "DISCOUNT",
  "pointsRequired": 500,
  "rewardValue": 5,
  "fundingType": "VENDOR_FUNDED",
  "minimumPurchaseAmount": 15,
  "eligibleVendorScope": "ALL_APPROVED_VENDORS",
  "totalRedemptionLimit": null,
  "maximumUsesPerUser": null,
  "isActive": true
}
```

Selected vendor example:

```json
{
  "name": "$10 Selected Vendor Reward",
  "triggerType": "LOYALTY_POINTS",
  "rewardType": "DISCOUNT",
  "pointsRequired": 1000,
  "rewardValue": 10,
  "fundingType": "VENDOR_FUNDED",
  "minimumPurchaseAmount": 25,
  "eligibleVendorScope": "SELECTED_VENDORS",
  "eligibleVendorIds": [
    "2782d58b-46ea-4387-b347-665c04722a73"
  ],
  "isActive": true
}
```

Important fields:

| Field | Meaning |
|---|---|
| `pointsRequired` | Foodie কত points spend করবে |
| `rewardValue` | Discount amount, e.g. `$5` |
| `fundingType` | `VENDOR_FUNDED` or `BITEDROP_FUNDED` |
| `minimumPurchaseAmount` | Customer minimum order amount |
| `eligibleVendorScope` | `ALL_APPROVED_VENDORS` or `SELECTED_VENDORS` |
| `eligibleVendorIds` | Required if selected vendors |
| `totalRedemptionLimit` | All users combined max uses; `null` means unlimited |
| `maximumUsesPerUser` | One user max uses; `null` means unlimited |
| `isActive` | false হলে Foodie rewards list-এ show হবে না |

## 6.2 Update Reward Rule

```http
PATCH /api/v1/admin/rewards/rules/:rewardRuleId
```

Request example:

```json
{
  "minimumPurchaseAmount": 20,
  "isActive": true
}
```

Deactivate example:

```json
{
  "isActive": false
}
```

If inactive:

```text
Foodie reward list-এ show হবে না
QR/code generate করা যাবে না
```

## 6.3 Admin Rewards Management / History

```http
GET /api/v1/admin/rewards-management
```

Response contains redemption history under `redeemTransactions`.

Sample redemption item:

```json
{
  "id": "1b0ce18d-80bc-4e5b-af4f-6f1eea9aa7db",
  "transactionId": "RDM-A7DB",
  "user": {
    "id": "customer-id",
    "name": "Alex Rivera",
    "email": "customer@bitedrop.com"
  },
  "truck": {
    "id": "food-truck-id",
    "name": "Taco Paradise"
  },
  "truckOwner": {
    "id": "vendor-id",
    "name": "Demo Vendor",
    "businessName": "Demo Gourmet Bites"
  },
  "points": -500,
  "credit": 5,
  "minimumPurchaseAmount": 15,
  "fundingType": "VENDOR_FUNDED",
  "date": "2026-09-29T10:00:08.234Z",
  "status": "completed",
  "rewardRule": {
    "id": "reward-rule-id",
    "name": "$5 Bite Drop Reward",
    "rewardType": "DISCOUNT",
    "fundingType": "VENDOR_FUNDED",
    "totalRedemptionLimit": null,
    "eligibleVendorScope": "ALL_APPROVED_VENDORS"
  },
  "code": "873104"
}
```

## 7. Changed APIs Summary

| API | Change |
|---|---|
| `GET /api/v1/rewards/rules` | Now returns `rewardAmount`, `minimumPurchaseAmount`, `fundingType`, `eligibleVendorScope`, `totalRedemptionLimit` |
| `POST /api/v1/rewards/me/redemption-codes` | Now supports `rewardRuleId` based QR/code creation and campaign validations |
| `POST /api/v1/vendors/me/redemptions/confirm` | Now returns `minimumPurchaseAmount` and validates selected vendor reward eligibility |
| `POST /api/v1/admin/rewards/rules` | Now accepts funding, minimum purchase, total limit, eligible vendor fields |
| `PATCH /api/v1/admin/rewards/rules/:rewardRuleId` | Now updates funding, minimum purchase, total limit, eligible vendor fields |
| `GET /api/v1/admin/rewards-management` | Redemption history now includes funding/minimum purchase/reward rule details |

## 8. Deprecated / Not Recommended Flow

Old flow:

```json
{
  "amount": 5
}
```

This old amount-only flow is still backward compatible, but app should not use it for the new client Rewards flow.

New required app flow:

```json
{
  "rewardRuleId": "reward-rule-id",
  "foodTruckId": "food-truck-id"
}
```

Reason:

```text
rewardRuleId ties the QR/code to admin campaign settings:
pointsRequired, rewardAmount, minimumPurchaseAmount, fundingType, limits, eligible vendors.
```

## 9. Default Seed Rewards

Backend now seeds default reward campaigns if they do not already exist:

| Reward | Points | Minimum Purchase | Funding |
|---|---:|---:|---|
| `$5 Bite Drop Reward` | 500 | `$15` | Vendor Funded |
| `$10 Bite Drop Reward` | 1000 | `$25` | Vendor Funded |
| `$15 Bite Drop Reward` | 1400 | `$35` | Vendor Funded |
| `$20 Bite Drop Reward` | 1800 | `$45` | Vendor Funded |

Admin can later edit/disable these.

## 10. App Screen Mapping

### Foodie Rewards screen

Use:

```http
GET /api/v1/rewards/rules
```

Display reward cards using:

```text
name
rewardAmount
pointsRequired
minimumPurchaseAmount
```

### Foodie QR screen

Use:

```http
POST /api/v1/rewards/me/redemption-codes
```

Generate QR from:

```text
redemptionToken
```

Display backup/manual code:

```text
backupCode
```

### Vendor scan/manual redeem screen

Use:

```http
POST /api/v1/vendors/me/redemptions/confirm
```

Show success data:

```text
amountApplied
minimumPurchaseAmount
customerName
message
```

### Admin rewards/history screen

Use:

```http
POST /api/v1/admin/rewards/rules
PATCH /api/v1/admin/rewards/rules/:rewardRuleId
GET /api/v1/admin/rewards-management
```

