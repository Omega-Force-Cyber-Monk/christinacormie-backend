# Bite Drop Rewards — Implementation & Testing Plan

This document explains what the client is asking for, how it fits the current backend, and how to implement/test it step by step.

## 1. What the client wants

The client wants the Bite Drop Rewards system to work like this:

```text
Foodie earns points
→ Foodie redeems points for Bite Drop Reward
→ Foodie receives one-time QR code
→ Vendor scans QR code
→ Backend validates reward
→ Vendor confirms redemption
→ Reward becomes used and cannot be reused
→ Vendor manually applies the discount in their POS/register
```

The client also wants standard rewards to be vendor-funded by default.

Example:

```text
$5 Reward + $15 minimum purchase
Vendor gives $5 discount
Foodie pays the remaining amount
Bite Drop does not reimburse vendor for standard rewards
```

The client also wants future support for Bite Drop-funded campaigns.

## 2. What already exists in current backend

The current backend already has the foundation:

| Area | Current status |
|---|---|
| Loyalty points account | Exists |
| Loyalty transactions | Exists |
| Foodie points earning structure | Exists |
| Reward rules | Exists |
| Reward redemption records | Exists |
| Foodie redemption token/code generation | Exists |
| Vendor redemption confirmation | Exists |
| Manual backup code support | Exists |
| Single-use redemption protection | Exists |
| Approved vendor check | Exists |
| Basic admin reward rule create/update | Exists |
| Basic redemption history | Exists |

So this is not a full rebuild. We need to extend the current system with campaign/business-rule fields.

## 3. Main missing items

| Missing item | Why needed |
|---|---|
| Funding type | Need `Vendor Funded` and `Bite Drop Funded`. |
| Vendor Funded default | Standard rewards must default to vendor-funded. |
| Minimum purchase amount | Example: `$5 reward requires $15+ purchase`. |
| Total redemption limit | Admin should control total campaign usage. |
| Eligible vendors/all vendors | Admin should choose who can accept the reward. |
| Better redemption history fields | Admin should see funding type, minimum purchase, reward amount, vendor, Foodie, status. |
| Vendor terms acceptance | Needed later when legal wording is provided. |
| Points deduction timing decision | Current behavior differs slightly from client wording. |

## 4. Important decision: when should points be deducted?

### Current backend behavior

```text
Foodie creates redemption QR/code
→ points are deducted immediately
→ if code expires, points are refunded
→ if vendor confirms, redemption becomes completed
```

### Client visual wording

```text
Vendor confirms redemption
→ reward/points are removed from Foodie account
```

### Recommended approach

For safer system behavior, keep points deducted/reserved when QR/code is created and refund if expired.

Reason:

- prevents Foodie from generating multiple QR codes with same points
- keeps pending redemption amount reserved
- still protects Foodie because points return if code expires

Suggested wording:

```text
When a Foodie generates a reward QR code, the required points are temporarily held. If the reward expires unused, the points are returned. If the vendor confirms the redemption, the reward becomes completed and cannot be used again.
```

If client strictly wants points deducted only after vendor confirmation, then we need to change the redemption logic.

## 5. Recommended backend data model changes

### 5.1 RewardRule fields to add

Add these fields to `RewardRule`:

```text
fundingType
minimumPurchaseAmount
totalRedemptionLimit
eligibleVendorScope
```

Suggested values:

```text
fundingType:
  VENDOR_FUNDED
  BITEDROP_FUNDED

eligibleVendorScope:
  ALL_APPROVED_VENDORS
  SELECTED_VENDORS
```

Default:

```text
fundingType = VENDOR_FUNDED
eligibleVendorScope = ALL_APPROVED_VENDORS
```

### 5.2 RewardRedemption snapshot fields to add

Add snapshot fields to `RewardRedemption`:

```text
fundingType
minimumPurchaseAmount
```

Why snapshot is needed:

If admin changes the reward rule later, old redemption history should still show what the Foodie actually redeemed at that time.

### 5.3 Eligible vendors table

If we want clean long-term design, add a relation table:

```text
RewardRuleVendor
```

Purpose:

```text
Reward rule can apply to all approved vendors or selected vendors only.
```

For a faster MVP, vendor targeting can be stored in `RewardRule.configuration`, but dedicated table is cleaner.

## 6. Implementation steps

## Step 1 — Add reward funding type

### What to implement

Add enum:

```text
RewardFundingType:
  VENDOR_FUNDED
  BITEDROP_FUNDED
```

Add field to reward rule:

```text
fundingType RewardFundingType default VENDOR_FUNDED
```

Add snapshot field to redemption:

```text
fundingType RewardFundingType default VENDOR_FUNDED
```

### What to test

| Test | Expected |
|---|---|
| Create reward without funding type | Defaults to `VENDOR_FUNDED` |
| Create reward with `BITEDROP_FUNDED` | Saves correctly |
| Redemption created from rule | Redemption stores same funding type |
| Admin history | Shows funding type |

## Step 2 — Add minimum purchase amount

### What to implement

Add to `RewardRule`:

```text
minimumPurchaseAmount Decimal?
```

Add to `RewardRedemption`:

```text
minimumPurchaseAmount Decimal?
```

### What to test

| Test | Expected |
|---|---|
| Admin creates `$5 reward + $15 minimum purchase` | Rule saves amount and minimum purchase |
| Foodie sees available rewards | Response includes minimum purchase |
| QR/code response | Response includes minimum purchase |
| Vendor confirm screen | Backend returns minimum purchase info |
| Admin redemption history | Shows minimum purchase |

Note: backend cannot fully validate POS subtotal unless vendor/app sends purchase subtotal. For now, vendor manually checks POS/register amount.

## Step 3 — Add total redemption limit

### What to implement

Add to `RewardRule`:

```text
totalRedemptionLimit Int?
```

When creating redemption code, check completed + pending redemptions depending desired rule.

Recommended:

```text
count PENDING + COMPLETED redemptions for the rule
if count >= totalRedemptionLimit → block new redemption code
```

### What to test

| Test | Expected |
|---|---|
| Limit is null | Unlimited redemptions allowed |
| Limit is 1 and no redemption exists | First redemption allowed |
| Limit is 1 and one pending/completed exists | New redemption blocked |
| Expired redemption refunded | Decide if it frees campaign limit or not |

Recommended: expired unused redemption should free the limit if status becomes `EXPIRED`.

## Step 4 — Add eligible vendor targeting

### What to implement

Add:

```text
eligibleVendorScope:
  ALL_APPROVED_VENDORS
  SELECTED_VENDORS
```

If selected vendors:

```text
RewardRuleVendor table
rewardRuleId
vendorId
```

Validation:

- if all approved vendors → any approved vendor can confirm
- if selected vendors → only selected vendor can confirm

### What to test

| Test | Expected |
|---|---|
| Reward scope all approved vendors | Any approved vendor can confirm |
| Reward scope selected vendors | Only selected vendors can confirm |
| Non-selected vendor tries confirm | Clear forbidden/bad request error |
| Pending vendor tries confirm | Still blocked |

## Step 5 — Update admin reward rule APIs

### What to implement

Update create/update DTOs:

```text
fundingType
minimumPurchaseAmount
totalRedemptionLimit
eligibleVendorScope
eligibleVendorIds
```

Update admin response examples/documentation.

### What to test

| Test | Expected |
|---|---|
| Admin creates vendor-funded campaign | Saves with `VENDOR_FUNDED` |
| Admin creates Bite Drop-funded campaign | Saves with `BITEDROP_FUNDED` |
| Admin updates minimum purchase | New value reflected |
| Admin toggles active/inactive | Foodie list respects status |
| Admin sets selected vendors | Only selected vendors can redeem |

## Step 6 — Update Foodie reward list/selection response

### What to implement

Reward list should include:

```text
id
name
pointsRequired
rewardValue
minimumPurchaseAmount
fundingType
startsAt
endsAt
isActive
```

### What to test

| Test | Expected |
|---|---|
| Foodie opens reward list | Rewards include amount/min purchase |
| Inactive reward | Not shown |
| Expired reward | Not shown |
| Not enough points | App can show disabled state |

## Step 7 — Update redemption code creation

### What to implement

When Foodie creates redemption code:

- validate points
- validate rule active/date
- validate total limit
- validate max per user
- save funding type snapshot
- save minimum purchase snapshot
- save reward value snapshot
- create token/manual code
- return all display data

Response should include:

```text
redemptionId
redemptionToken
backupCode
rewardAmount
minimumPurchaseAmount
fundingType
expiresAt
status
```

### What to test

| Test | Expected |
|---|---|
| Valid reward code creation | Token/code returned |
| Not enough points | Clear error |
| Campaign limit reached | Clear error |
| Reward inactive/expired | Clear error |
| Selected vendor restriction | If foodTruckId/vendor not eligible, block |

## Step 8 — Update vendor confirmation

### What to implement

Vendor confirm response should include:

```text
success
amountApplied
minimumPurchaseAmount
fundingType
customerName
foodTruckName
redemptionId
status
message
```

Validation should include:

- vendor approved
- vendor accepts credits
- code pending/not expired
- reward eligible for this vendor
- single-use protection

### What to test

| Test | Expected |
|---|---|
| Vendor confirms valid QR token | Redemption completed |
| Vendor confirms valid manual code | Redemption completed |
| Same code used twice | Second attempt blocked |
| Expired code | Blocked |
| Wrong vendor | Blocked |
| Pending/unapproved vendor | Blocked |
| Vendor credit acceptance off | Blocked |

## Step 9 — Update admin redemption history/reporting

### What to implement

Admin redemption record should include:

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

### What to test

| Test | Expected |
|---|---|
| Completed redemption appears | Shows correct vendor/foodie/reward |
| Pending redemption appears if needed | Shows pending status |
| Funding type visible | Shows vendor funded/Bite Drop funded |
| Minimum purchase visible | Shows configured minimum |

## Step 10 — Vendor Rewards Terms acceptance

Client said legal wording will be sent later.

When wording is ready, add fields such as:

```text
rewardsTermsAcceptedAt
rewardsTermsVersion
```

Possible location:

```text
Vendor
```

or a dedicated vendor agreement table.

### What to test

| Test | Expected |
|---|---|
| Vendor onboarding shows checkbox | Required before final submit |
| Vendor accepts terms | Timestamp/version saved |
| Vendor does not accept | Onboarding submit blocked |
| Admin views vendor | Acceptance status visible |

## 7. Suggested implementation order

Recommended order:

1. Add schema fields/enums.
2. Create migration.
3. Update DTOs.
4. Update reward rule create/update logic.
5. Update redemption code creation.
6. Update vendor confirmation logic.
7. Update admin rewards history.
8. Add tests/manual testing prompts.
9. Add vendor terms acceptance later after legal text.

## 8. Manual testing checklist

### Admin testing

- Create `$5 reward`, 500 points, `$15 minimum purchase`, vendor-funded.
- Create `$10 reward`, 1000 points, `$25 minimum purchase`, vendor-funded.
- Turn one reward inactive and confirm it is hidden/blocked.
- Set total redemption limit and confirm it blocks after limit.
- Create selected-vendor reward and confirm only selected vendor can redeem.

### Foodie testing

- Earn points.
- Open reward list.
- Select reward.
- Generate QR/token.
- Confirm points behavior.
- Let QR expire and verify points are refunded if current reserve model remains.

### Vendor testing

- Approved vendor scans/confirms valid reward.
- Same reward cannot be confirmed twice.
- Wrong vendor cannot confirm selected-vendor reward.
- Pending vendor cannot confirm.
- Vendor with credit acceptance off cannot confirm.

### Admin history testing

- Confirm completed redemption appears.
- Confirm reward amount appears.
- Confirm minimum purchase appears.
- Confirm funding type appears.
- Confirm vendor/foodie/food truck data appears.

## 9. Final expected result

After implementation, the system should support:

```text
Foodie earns points
→ Foodie selects reward
→ Foodie gets single-use QR/code
→ Vendor scans/confirms
→ Backend validates rules
→ Redemption is completed
→ Vendor manually applies discount
→ Admin can manage and report campaigns
```

Standard rewards will default to:

```text
Vendor Funded
```

Future campaigns can be:

```text
Bite Drop Funded
```
