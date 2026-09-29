# Bite Drop Rewards — সহজ বাংলা Implementation Plan

এই ডকুমেন্টের উদ্দেশ্য হলো খুব সহজভাবে বোঝানো:

- Client কী চাইছে
- আমাদের backend-এ কোন part already আছে
- কোন part update করতে হবে
- Step by step কীভাবে implement/test করবো

## 1. Client আসলে কী চাইছে?

Client-এর Rewards flow:

```text
Foodie points earn করবে
→ Foodie points দিয়ে reward select করবে
→ Foodie QR code পাবে
→ Vendor QR scan করবে
→ Backend reward validate করবে
→ Vendor confirm করবে
→ Reward single-use হিসেবে used হয়ে যাবে
→ Vendor নিজের POS/register-এ manually discount apply করবে
```

Example:

```text
$5 Reward
Minimum purchase: $15
Vendor $5 discount দিবে
Foodie বাকি amount pay করবে
Bite Drop vendor-কে reimburse করবে না
```

Standard reward হবে:

```text
Vendor Funded
```

Future campaign হতে পারে:

```text
Bite Drop Funded
```

## 2. Current backend-এ already কী আছে?

| Part | Already আছে? | সহজ explanation |
|---|---|---|
| Foodie points account | হ্যাঁ | User-এর points balance রাখা যায়। |
| Points transaction history | হ্যাঁ | Points earn/redeem/refund history রাখা যায়। |
| Reward rule | হ্যাঁ | Admin reward rule create করতে পারে। |
| Points required | হ্যাঁ | Reward নিতে কত points লাগবে সেটা আছে। |
| Reward amount | হ্যাঁ | Reward value যেমন `$5`, `$10` রাখা যায়। |
| Active/inactive reward | হ্যাঁ | Admin reward on/off করতে পারে। |
| Start/end date | হ্যাঁ | Reward date range আছে। |
| Foodie redemption code/token | হ্যাঁ | Foodie QR/token/manual code generate করতে পারে। |
| Vendor confirm redemption | হ্যাঁ | Vendor QR/token/manual code confirm করতে পারে। |
| Single-use redemption | হ্যাঁ | একবার confirm হলে আবার use করা যায় না। |
| Approved vendor check | হ্যাঁ | Pending/unapproved vendor reward confirm করতে পারে না। |

So, core system already আছে।

আমাদের mainly client-এর latest business rules add করতে হবে।

## 3. Current backend-এ কী missing?

| Missing part | কেন দরকার |
|---|---|
| Vendor Funded / Bite Drop Funded | Client চায় standard reward vendor-funded হবে, future campaign Bite Drop-funded হতে পারবে। |
| Minimum purchase amount | Example: `$5 reward requires $15+ purchase` |
| Total redemption limit | Admin বলবে campaign maximum কতবার redeem করা যাবে। |
| Eligible vendors | Reward সব approved vendor নাকি selected vendor accept করবে সেটা control দরকার। |
| Better admin redemption history | Admin history-তে reward amount, minimum purchase, funding type, vendor, foodie দেখাতে হবে। |
| Vendor rewards terms checkbox | Client legal wording দিলে vendor onboarding-এ checkbox লাগবে। |

## 4. Important: points কখন deduct হবে?

এই part বুঝা important।

### Current backend এখন যা করে

```text
Foodie QR/code generate করে
→ তখনই points deduct হয়
→ QR/code expire হলে points ফেরত যায়
→ Vendor confirm করলে redemption completed হয়
```

### Client-এর visual যা বলছে

```text
Vendor confirm করার পর reward/points remove হবে
```

### কোনটা ভালো?

আমার recommendation:

```text
QR/code generate করার সময় points temporarily hold/deduct করা ভালো।
যদি QR expire হয়, points refund হবে।
যদি vendor confirm করে, redemption completed হবে।
```

কারণ:

- Foodie same points দিয়ে multiple QR generate করতে পারবে না।
- Vendor-এর সামনে QR দেখানোর সময় reward reserved থাকবে।
- QR expire হলে Foodie points ফেরত পাবে।

So current logic রাখতে পারি, শুধু wording clear করতে হবে:

```text
Points are temporarily held when QR is generated.
Unused expired rewards are refunded.
```

যদি client strictly বলে vendor confirm-এর আগে points deduct করা যাবে না, তাহলে logic change করতে হবে।

## 5. Step-by-step কী implement করতে হবে?

## Step 1 — Funding Type add করতে হবে

### Already আছে?

না।

### কী add করতে হবে?

Reward rule-এ একটা field add করতে হবে:

```text
fundingType
```

Value হবে:

```text
VENDOR_FUNDED
BITEDROP_FUNDED
```

Default হবে:

```text
VENDOR_FUNDED
```

### কেন দরকার?

Client বলেছে:

```text
Standard rewards are Vendor Funded.
Bite Drop Funded campaigns may be used in future.
```

### কোথায় update হবে?

- RewardRule schema
- RewardRedemption schema snapshot
- Admin create/update reward rule DTO
- Reward list response
- Redemption history response

### Test কী করবো?

| Test | Expected |
|---|---|
| Admin reward create করে fundingType না দিলে | `VENDOR_FUNDED` save হবে |
| Admin `BITEDROP_FUNDED` দিলে | Bite Drop funded save হবে |
| Foodie redemption create করলে | Redemption record funding type রাখবে |
| Admin history | Funding type দেখা যাবে |

## Step 2 — Minimum Purchase add করতে হবে

### Already আছে?

না।

### Minimum Purchase মানে কী?

Minimum purchase মানে হলো Foodie reward use করতে চাইলে vendor-এর কাছ থেকে কমপক্ষে কত টাকার food/order কিনতে হবে।

Example:

```text
$5 reward use করতে হলে customer-এর order minimum $15 হতে হবে।
$10 reward use করতে হলে customer-এর order minimum $25 হতে হবে।
```

মানে customer যদি `$5 reward` use করে কিন্তু order করে মাত্র `$10`, তাহলে vendor reward accept করবে না, কারণ minimum purchase `$15` হয়নি।

### POS/register বলতে কী বুঝায়?

POS মানে:

```text
Point of Sale
```

সহজভাবে:

```text
Vendor/food truck যেখানে actual payment নেয়, bill করে, card/cash নেয় — সেটাই POS/register।
```

Example:

- Square POS
- Toast POS
- Clover POS
- Stripe Terminal
- Normal cash register
- Vendor-এর নিজের billing tablet/app

Client-এর visual অনুযায়ী Bite Drop app payment process করবে না। Vendor শুধু Bite Drop app দিয়ে QR scan/confirm করবে। তারপর vendor নিজের POS/register-এ manually discount apply করবে।

Example:

```text
Customer order subtotal: $31
Reward discount: $10
Vendor নিজের POS/register-এ $10 discount দিবে
Customer pay করবে: $21
```

So Bite Drop backend actual POS bill amount automatically জানে না।

### Backend কী করবে?

Backend শুধু reward rule হিসেবে minimum purchase amount save করবে এবং response/history-তে দেখাবে।

Example backend data:

Reward rule-এ:

```text
minimumPurchaseAmount
```

Example:

```text
$5 reward → $15 minimum purchase
$10 reward → $25 minimum purchase
```

### Backend কী করবে না?

Current flow অনুযায়ী backend vendor-এর POS/register subtotal জানে না, তাই backend automatically verify করতে পারবে না customer সত্যি `$15+` কিনেছে কিনা।

So current implementation-এ:

```text
Backend minimumPurchaseAmount save/show করবে।
Vendor manually নিজের POS subtotal দেখে confirm করবে।
```

যদি future-এ আমরা চাই backend minimum purchase strictly enforce করুক, তাহলে vendor confirmation API-তে `purchaseSubtotal` পাঠাতে হবে।

Future example:

```json
{
  "redemptionToken": "rdm_xxx",
  "purchaseSubtotal": 31.00
}
```

তখন backend check করতে পারবে:

```text
purchaseSubtotal >= minimumPurchaseAmount
```

কিন্তু client-এর current visual অনুযায়ী vendor manually POS/register-এ discount apply করবে, তাই এখন minimum purchase field show/report করা যথেষ্ট।

### কেন দরকার?

Client visual-এ reward rules আছে:

```text
$5 Reward → $15+ purchase
$10 Reward → $25+ purchase
```

এই rules না থাকলে app জানবে না কোন reward use করতে কত minimum order দরকার।

### Current flow-এ exact behavior

```text
Admin reward create করবে:
Reward amount = $5
Minimum purchase = $15

Foodie rewards list-এ দেখবে:
$5 reward, valid for $15+ purchase

Foodie QR/code generate করবে:
QR screen-এ দেখাবে minimum purchase $15

Vendor QR scan করবে:
Vendor screen-এ দেখাবে $5 reward, minimum purchase $15

Vendor নিজের POS/register দেখে confirm করবে:
Order subtotal $15 বা তার বেশি হলে confirm করবে

Backend redemption completed করবে:
History-তে reward amount + minimum purchase save/show হবে
```

### কোথায় update হবে?

- RewardRule
- RewardRedemption snapshot
- Admin create/update reward rule
- Foodie reward list
- QR/code response
- Vendor confirmation response
- Admin history

### কেন RewardRedemption snapshot দরকার?

RewardRule later admin edit করতে পারে।

Example:

```text
Today: $5 reward minimum purchase $15
Tomorrow admin edit করে minimum purchase $20 করলো
```

যদি পুরনো redemption history rule থেকে live value নেয়, তাহলে পুরনো redemption ভুলভাবে `$20` দেখাতে পারে।

So redemption create হওয়ার সময় ওই সময়ের value snapshot করে রাখতে হবে:

```text
rewardAmount = $5
minimumPurchaseAmount = $15
fundingType = VENDOR_FUNDED
```

এতে history accurate থাকবে।

### Test কী করবো?

| Test | Expected |
|---|---|
| Admin `$5 reward + $15 minimum purchase` create করে | Minimum purchase save হবে |
| Foodie reward list দেখে | Minimum purchase দেখা যাবে |
| QR/code generate হয় | Response-এ minimum purchase থাকবে |
| Vendor confirm করে | Response-এ minimum purchase থাকবে |
| Admin history দেখে | Minimum purchase দেখা যাবে |

### Important decision

এখনকার জন্য আমরা POS amount enforce করবো না।

Reason:

```text
Client-এর visual/manual flow অনুযায়ী vendor নিজের POS/register-এ discount apply করবে।
Backend POS subtotal জানে না।
```

Later যদি client বলে backend must verify minimum purchase, তাহলে vendor confirmation API-তে `purchaseSubtotal` add করতে হবে।

## Step 3 — Total Redemption Limit add করতে হবে

### Already আছে?

Partial আছে।

Current backend-এ:

```text
maximumUsesPerUser
```

মানে একজন user কতবার use করতে পারবে।

### কী missing?

Campaign total limit নেই।

Example:

```text
Only 500 total redemptions allowed
```

### কী add করতে হবে?

Reward rule-এ:

```text
totalRedemptionLimit
```

### Test কী করবো?

| Test | Expected |
|---|---|
| Limit null | Unlimited allowed |
| Limit 1 | First redemption allowed |
| Limit 1 and already used | Next redemption blocked |
| Expired unused redemption | Decide if limit frees or not |

Recommended:

```text
Expired unused redemption should free the limit.
```

## Step 4 — Eligible Vendors add করতে হবে

### Already আছে?

না।

### Client কী চাইছে?

Admin control:

```text
Eligible vendors or all vendors
```

### কী add করতে হবে?

Reward rule-এ:

```text
eligibleVendorScope
```

Value:

```text
ALL_APPROVED_VENDORS
SELECTED_VENDORS
```

If selected vendors:

```text
RewardRuleVendor table
```

এই table রাখবে:

```text
rewardRuleId
vendorId
```

### Test কী করবো?

| Test | Expected |
|---|---|
| All approved vendors reward | Any approved vendor confirm করতে পারবে |
| Selected vendors reward | শুধু selected vendor confirm করতে পারবে |
| Wrong vendor confirm করতে চায় | Error দিবে |
| Pending vendor confirm করতে চায় | Error দিবে |

## Step 5 — Admin Reward Create/Update API update করতে হবে

### Already আছে?

হ্যাঁ, create/update API already আছে।

### কী update করতে হবে?

Admin request body-তে নতুন fields add করতে হবে:

```text
fundingType
minimumPurchaseAmount
totalRedemptionLimit
eligibleVendorScope
eligibleVendorIds
```

### Test কী করবো?

| Test | Expected |
|---|---|
| Admin vendor-funded reward create করে | Save হবে |
| Admin Bite Drop-funded reward create করে | Save হবে |
| Admin minimum purchase update করে | Update হবে |
| Admin active false করে | Foodie list-এ show হবে না |
| Admin selected vendors দেয় | Only selected vendors redeem করতে পারবে |

## Step 6 — Foodie reward list update করতে হবে

### Already আছে?

হ্যাঁ, active reward list আছে।

### কী update করতে হবে?

Reward list response-এ নতুন data দিতে হবে:

```text
rewardAmount
pointsRequired
minimumPurchaseAmount
fundingType
startsAt
endsAt
isActive
```

### Test কী করবো?

| Test | Expected |
|---|---|
| Foodie rewards page open করে | Rewards list আসে |
| Reward has minimum purchase | UI show করতে পারে |
| Reward inactive | Show হবে না |
| Reward expired | Show হবে না |

## Step 7 — Foodie QR/code creation update করতে হবে

### Already আছে?

হ্যাঁ, `POST /api/v1/rewards/me/redemption-codes` আছে।

### কী update করতে হবে?

Code create করার সময় backend check করবে:

- enough points আছে কিনা
- reward active কিনা
- reward expired কিনা
- total limit reached কিনা
- per-user limit reached কিনা
- selected vendor restriction আছে কিনা

Response-এ add করতে হবে:

```text
rewardAmount
minimumPurchaseAmount
fundingType
expiresAt
status
```

### Test কী করবো?

| Test | Expected |
|---|---|
| Enough points আছে | QR/token create হবে |
| Enough points নেই | Error |
| Campaign limit reached | Error |
| Reward inactive | Error |
| Wrong vendor/truck selected | Error |

## Step 8 — Vendor confirmation update করতে হবে

### Already আছে?

হ্যাঁ, vendor confirm API আছে:

```text
POST /api/v1/vendors/me/redemptions/confirm
```

### কী update করতে হবে?

Response-এ extra data দিতে হবে:

```text
amountApplied
minimumPurchaseAmount
fundingType
customerName
redemptionId
status
```

Validation add/confirm করতে হবে:

- vendor approved কিনা
- code pending কিনা
- code expired কিনা
- vendor eligible কিনা
- same code already used কিনা

### Test কী করবো?

| Test | Expected |
|---|---|
| Valid QR token confirm | Success |
| Valid manual code confirm | Success |
| Same code again confirm | Error |
| Expired code | Error |
| Wrong vendor | Error |
| Pending vendor | Error |

## Step 9 — Admin redemption history update করতে হবে

### Already আছে?

Basic history আছে।

### কী update করতে হবে?

Admin history-তে show করতে হবে:

```text
redemptionId
foodie
vendor
foodTruck
rewardAmount
minimumPurchaseAmount
fundingType
pointsSpent
status
dateTime
redemptionMethod
```

### Test কী করবো?

| Test | Expected |
|---|---|
| Redemption completed | Admin history-তে show হবে |
| Funding type | Show হবে |
| Minimum purchase | Show হবে |
| Vendor/Foodie/FoodTruck | Show হবে |

## Step 10 — Vendor Terms checkbox later add করতে হবে

### Already আছে?

না।

### এখন implement করবো?

Client বলেছে legal wording পরে পাঠাবে।

So এখন শুধু plan করে রাখবো।

Later add করতে হবে:

```text
rewardsTermsAcceptedAt
rewardsTermsVersion
```

### কোথায় রাখবো?

Probably `Vendor` model-এ।

### Test কী করবো?

| Test | Expected |
|---|---|
| Vendor checkbox accept না করে onboarding submit করে | Block |
| Vendor checkbox accept করে | Timestamp/version save |
| Admin vendor details দেখে | Acceptance status visible |

## 6. সহজ implementation order

Follow this order:

```text
1. Schema update
2. Migration create
3. DTO update
4. Admin create/update reward rule update
5. Foodie reward list update
6. Foodie redemption code update
7. Vendor confirmation update
8. Admin history update
9. Test all flows
10. Later vendor terms checkbox
```

## 7. Overall simple explanation

Current system:

```text
Points আছে
Reward আছে
Foodie code generate করতে পারে
Vendor code confirm করতে পারে
Single-use কাজ করে
```

Client-এর latest requirement add করছে:

```text
Reward campaign rules
Vendor funded / Bite Drop funded
Minimum purchase
Campaign limit
Eligible vendors
Better admin control/history
```

So আমাদের existing system replace করতে হবে না।

আমাদের existing Rewards system-এর উপর এই নতুন campaign fields add করতে হবে।

## 8. Final expected flow after implementation

```text
Admin creates reward campaign
→ Funding type default Vendor Funded
→ Admin sets reward amount and minimum purchase
→ Foodie sees reward
→ Foodie generates QR/code
→ Vendor scans/confirms
→ Backend validates all rules
→ Redemption completed
→ Vendor manually applies discount in POS
→ Admin can see full redemption history
```

## 9. Quick testing summary

### Admin

- Create `$5 reward`, 500 points, `$15 minimum purchase`, vendor-funded.
- Create `$10 reward`, 1000 points, `$25 minimum purchase`, vendor-funded.
- Set one reward inactive.
- Set one reward selected-vendor only.
- Set one reward total limit 1.

### Foodie

- Earn points.
- Open rewards list.
- Generate QR/code.
- Try without enough points.
- Try expired/inactive reward.

### Vendor

- Confirm valid QR.
- Confirm manual code.
- Try same code twice.
- Try wrong vendor.
- Try pending vendor.

### Admin history

- Check redemption amount.
- Check minimum purchase.
- Check funding type.
- Check vendor/Foodie details.
