# Bite Drop Rewards — Client Confirmation Summary

এই ডকুমেন্টটি client-কে পাঠানোর জন্য। এখানে সংক্ষেপে বলা হলো Bite Drop Rewards flow-এর কোন অংশ backend-এ already আছে এবং client-এর নতুন visual/requirement অনুযায়ী কোন অংশগুলো এখনো add করতে হবে।

## Short summary

বর্তমানে Bite Drop Rewards-এর core flow backend-এ অনেকটাই তৈরি আছে:

- Foodie points earn করতে পারে।
- Foodie points/rewards redeem করার জন্য redemption token/code তৈরি করতে পারে।
- Vendor QR/token/manual code confirm করতে পারে।
- Redemption single-use হিসেবে কাজ করে।
- Used redemption আবার redeem করা যায় না।
- Admin reward rule create/update করতে পারে।
- Admin reward/redemption history দেখতে পারে।

তবে client-এর latest visual অনুযায়ী exact campaign/reward control-এর কিছু field এখনো add করা বাকি:

- Vendor Funded / Bite Drop Funded type
- Vendor Funded default behavior
- Minimum purchase amount
- Total redemption limit
- Eligible vendors/all vendors selection
- Full campaign-style admin control/reporting
- Vendor Terms checkbox/acceptance tracking

Client confirm করলে এগুলো implement করা যাবে।

## Client requirement vs current status

| Client requirement | Current status | Note |
|---|---|---|
| Foodie points earn করবে | Already implemented | Loyalty points/account/transactions আছে। |
| Foodie rewards redeem করতে পারবে | Already implemented / partial | Reward redemption code/token flow আছে। |
| Foodie QR code দেখাবে | Backend supported | Backend token দেয়; QR image frontend generate করবে। |
| Vendor QR scan করবে | Backend supported | Vendor confirm API token/manual code accept করে। |
| Vendor confirms redemption | Already implemented | Vendor confirm করলে redemption completed হয়। |
| QR/reward one-time use হবে | Already implemented | Used code আবার redeem হয় না। |
| Points/reward remove হবে | Implemented, but timing differs | এখন code create করার সময় points deduct হয়; code expire হলে refund হয়। Client চাইলে confirm-এর সময় deduct করা যাবে। |
| Vendor manually discount apply করবে | Supported by flow | Backend amount return করে; POS discount vendor manually করবে। |
| Standard rewards vendor funded হবে | Not explicitly implemented | Funding type field নেই। Add করতে হবে। |
| Bite Drop funded future campaign support | Not implemented | Future campaign funding type add করতে হবে। |
| Admin points required set করবে | Already implemented | `pointsRequired` আছে। |
| Admin reward amount set করবে | Already implemented | `rewardValue` আছে। |
| Admin minimum purchase set করবে | Not implemented | `minimumPurchaseAmount` field add করতে হবে। |
| Admin redemption limits set করবে | Partial | Per-user limit আছে; total campaign limit add করতে হবে। |
| Admin campaign ON/OFF করবে | Already implemented | `isActive`, start/end date আছে। |
| Admin redemption history দেখবে | Already implemented / partial | Basic history আছে; funding/min purchase সহ full campaign report add করতে হবে। |
| Eligible vendors/all vendors control | Not implemented | Vendor targeting add করতে হবে। |
| Vendor agreement checkbox | Not implemented yet | Client final legal wording দিলে add করা হবে। |

## Already implemented backend APIs

### Foodie side

| API | Purpose |
|---|---|
| `GET /api/v1/rewards/me/loyalty` | Foodie points/account/history |
| `GET /api/v1/rewards/me/profile-summary` | Rewards profile summary |
| `GET /api/v1/rewards/rules` | Active reward rules |
| `POST /api/v1/rewards/me/redemption-codes` | QR/manual redemption code create |
| `GET /api/v1/rewards/me/redemptions` | Confirmed redemptions for review eligibility |

### Vendor side

| API | Purpose |
|---|---|
| `POST /api/v1/vendors/me/redemptions/confirm` | Vendor confirms QR/manual reward redemption |

### Admin side

| API | Purpose |
|---|---|
| `POST /api/v1/admin/rewards/rules` | Create reward rule |
| `PATCH /api/v1/admin/rewards/rules/:rewardRuleId` | Update reward rule |
| `POST /api/v1/admin/rewards/points` | Manually award points |
| Admin rewards management API | View rewards/redemption history and summary |

## What still needs to be added

| Item | What will be added |
|---|---|
| Funding type | Add `VENDOR_FUNDED` and `BITEDROP_FUNDED`; default will be `VENDOR_FUNDED`. |
| Minimum purchase | Add minimum purchase amount per reward/campaign, e.g. `$5 reward requires $15+ purchase`. |
| Total redemption limit | Add campaign-level total redemption limit, e.g. max 500 redemptions. |
| Eligible vendors | Add option for all approved vendors or selected vendors. |
| Campaign-style admin control | Admin can create/update reward campaign with amount, points, minimum purchase, funding type, dates, limits, status. |
| Redemption record | Store/report funding type, minimum purchase, reward amount, foodie, vendor, food truck, date/time, status. |
| Vendor Terms checkbox | Add acceptance tracking once client provides final legal wording. |
| Optional points timing adjustment | If client wants, change deduction timing so points are removed only after vendor confirms redemption. |

## Suggested client message

```txt
Hi Christinacormie,

I reviewed the Bite Drop Rewards visual and flow. The core backend flow is already supported: foodies can earn points, create a reward redemption token/code, vendors can scan/confirm the redemption, and the redemption is single-use so it cannot be redeemed twice. Admin reward rule creation/update and redemption history are also partially in place.

The items from your latest visual that still need to be added are:

1. Vendor Funded vs Bite Drop Funded campaign type
2. Vendor Funded as the default for standard rewards
3. Minimum purchase amount per reward
4. Total redemption/campaign limits
5. Eligible vendors/all vendors control
6. Campaign-style admin controls and reporting
7. Vendor Terms/Rewards Program acceptance checkbox once you send the final legal wording

One small behavior to confirm: currently points are deducted when the foodie generates the redemption code, and refunded if the code expires. Your flow says points/reward are removed after vendor confirmation. Please confirm which behavior you prefer.

Once you confirm these items, we can implement the remaining Rewards updates quickly.
```

## Final confirmation needed from client

Please confirm:

1. Standard rewards should always default to `Vendor Funded`.
2. Bite Drop Funded should be supported as a future campaign type.
3. Minimum purchase should be required per reward amount.
4. Points should be deducted either:
   - when Foodie creates the QR/code, with refund on expiry, or
   - only after Vendor confirms redemption.
5. Admin should be able to target:
   - all approved vendors, or
   - selected vendors only.
6. Client will send final Terms/checkbox wording separately.
