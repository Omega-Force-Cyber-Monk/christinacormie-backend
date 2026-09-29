# Bite Drop Rewards Flow — Client Requirement বনাম Current Backend Status

তারিখ: 2026-09-28

এই ডকুমেন্টে client-এর দেওয়া Rewards Redemption visual/flow অনুযায়ী backend-এ কী আছে, কী partial আছে, আর কী এখনো implement করা নেই — exact Bangla-তে লিখা হলো।

## Client-এর মূল প্রশ্নের short answer

| প্রশ্ন | Current answer |
|---|---|
| A. QR redemption flow supported? | **Partial supported** — customer reward code/token তৈরি এবং vendor confirm redemption আছে। কিন্তু visual অনুযায়ী full QR scan + minimum purchase validation + reward rules enforcement এখনো complete না। |
| B. Admin controls listed আছে? | **Partial supported** — reward rule create/update, active/inactive, points required, reward amount, per-user limit আছে। কিন্তু minimum purchase, funding type, total redemption limit, eligible vendors/all vendors full support নেই। |
| C. Vendor Funded / Bite Drop Funded identify করা যায়? | **না, এখনো proper field নেই**। Current schema/API-তে funding source নেই। Vendor Funded default হিসেবে enforce করা নেই। Future Bite Drop Funded campaign support-ও proper model করা হয়নি। |

## 1. Foodie earns points

| Client requirement | Current backend status | Notes |
|---|---|---|
| Foodie eligible activities থেকে points earn করবে | **Implemented** | Loyalty account এবং loyalty transaction আছে। Check-in, review, follow, booking ইত্যাদি source থেকে points award করার structure আছে। |
| Points balance দেখা যাবে | **Implemented** | `GET /api/v1/rewards/me/loyalty` এবং profile summary type API আছে। |
| Points দিয়ে rewards redeem করা যাবে | **Partial** | Points দিয়ে reward redeem করার old API আছে, আবার BiteDrop credit redemption code flow-ও আছে। কিন্তু visual-এর exact `$5 reward + minimum purchase` rule fully enforced না। |

## 2. Standard rewards are vendor funded

| Client requirement | Current backend status | Notes |
|---|---|---|
| Standard rewards vendor funded হবে | **Not implemented as explicit field** | Reward rule/redemption table-এ `fundingType` বা `VENDOR_FUNDED/BITEDROP_FUNDED` field নেই। |
| Vendor discount absorb করবে | **Operationally assumed, not enforced** | Vendor confirm করলে backend credit redeemed করে, কিন্তু POS/register discount vendor manually apply করবে — এটা backend financial reimbursement করে না। |
| Bite Drop vendor reimburse করবে না | **Not explicitly tracked** | Backend reimbursement/payout create করে না, so technically reimbursement নেই। কিন্তু funding source clearly store/report করা হয় না। |
| Future Bite Drop Funded campaign support | **Not implemented** | Funding type, campaign budget, Bite Drop reimbursement ledger/reporting নেই। |

## 3. Redemption flow

Client flow:

```txt
Foodie selects reward
→ Foodie displays QR code
→ Vendor scans QR code
→ Bite Drop validates reward
→ Vendor confirms redemption
→ Reward/points removed from Foodie account
→ Vendor manually applies discount in POS/register
```

| Step | Current backend status | Notes |
|---|---|---|
| Foodie selects reward | **Partial** | `POST /api/v1/rewards/me/redemption-codes` দিয়ে customer amount select করে redemption code/token create করতে পারে। |
| Foodie displays QR code | **Backend supported as token** | Backend `redemptionToken` দেয়। QR image generate frontend করবে। |
| Vendor scans QR code | **Backend supported via token confirm** | `POST /api/v1/vendors/me/redemptions/confirm` accepts `redemptionToken`; camera scanning frontend-side। |
| Manual code fallback | **Implemented** | Same confirm API accepts `manualCode`/backup 6-digit code। |
| Backend validates reward | **Partial** | Pending/expired/vendor ownership/approved vendor/credit acceptance check আছে। |
| Minimum purchase validation | **Not implemented** | `$5 reward + $15 minimum purchase` type minimum purchase backend validate করে না। Vendor manually POS subtotal দেখে apply করবে ধরে নেওয়া আছে। |
| Vendor confirms redemption | **Implemented** | Confirm API status `PENDING → COMPLETED` করে। |
| Single-use QR/code | **Implemented** | `updateMany` only `status=PENDING` হলে complete করে। Already used হলে error দেয়। |
| Cannot redeem twice | **Implemented** | Used/completed redemption আবার confirm হবে না। |
| Points removed after vendor confirms | **Not exact** | Current code points deduct করে redemption code create করার সময়। Vendor confirm করার সময় নয়। Pending code expire হলে points refund হয়। Client text অনুযায়ী points remove should happen after vendor confirm — current behavior আলাদা। |
| Vendor manually applies discount in POS | **Supported by flow, not backend-enforced** | Backend শুধু amount applied return করে; POS/register discount vendor manually করবে। |

## 4. Reward rules from visual

Visual example:

```txt
$5 reward  → $15+ purchase
$10 reward → $25+ purchase
$15 reward → $35+ purchase
$20 reward → $45+ purchase
```

| Rule | Current backend status | Notes |
|---|---|---|
| Reward amount | **Implemented** | `rewardValue` আছে। |
| Points required | **Implemented** | `pointsRequired` আছে। |
| Minimum purchase | **Not implemented as dedicated field** | `minimumPurchase` field নেই। Maybe `configuration` JSON-এ রাখা যায়, কিন্তু enforce/report করা নেই। |
| One reward per transaction | **Not implemented/enforced** | Transaction/order concept redemption confirm API-তে নেই। |
| Cannot combine with other rewards | **Not implemented/enforced** | Backend combine check করে না। |
| Taxes/tips/fees count না করা | **Not implemented** | POS subtotal info backend পায় না। |
| No cash value | **Policy only, not backend** | Terms/UI copy needed। |
| Approved Bite Drop vendors only | **Implemented** | Vendor approved/verified না হলে confirm blocked। Food truck inactive/unapproved হলে redemption code create blocked। |

## 5. Admin controls

| Admin control requested | Current backend status | Notes |
|---|---|---|
| Set points required | **Implemented** | `CreateRewardRuleDto.pointsRequired` |
| Set reward amount | **Implemented** | `CreateRewardRuleDto.rewardValue` |
| Set minimum purchase | **Not implemented dedicated** | Schema/DTO/API-তে proper `minimumPurchaseAmount` নেই। |
| Set redemption limits | **Partial** | `maximumUsesPerUser` আছে। কিন্তু total campaign limit/per-day/per-vendor limit নেই। |
| Turn rewards/campaigns ON/OFF | **Implemented** | `isActive`, startsAt, endsAt আছে। |
| View redemption history | **Implemented/Partial** | Admin rewards management has redemption list/history style data। But funding/min purchase/campaign type missing. |
| Vendor-funded or Bite Drop-funded campaign type | **Not implemented** | `fundingType` নেই। |
| Eligible vendors / all vendors | **Not implemented** | Reward rule specific eligible vendors relation নেই। |
| Redemption reports | **Partial** | Basic admin rewards stats/history আছে; visual-এর full campaign report/funding report নেই। |

## 6. Current relevant APIs

### Customer/Foodie side

| API | Status | Purpose |
|---|---|---|
| `GET /api/v1/rewards/me/loyalty` | Implemented | My points/loyalty account |
| `GET /api/v1/rewards/me/profile-summary` | Implemented | Rewards/profile summary |
| `GET /api/v1/rewards/rules` | Implemented | Active reward rules list |
| `POST /api/v1/rewards/redeem` | Old/Partial | Direct reward redemption; creates completed redemption immediately |
| `POST /api/v1/rewards/me/redemption-codes` | Implemented | Creates QR/token/manual code for vendor confirmation |
| `GET /api/v1/rewards/me/redemptions` | Implemented | Confirmed redemptions eligible for reviews |

### Vendor side

| API | Status | Purpose |
|---|---|---|
| `POST /api/v1/vendors/me/redemptions/confirm` | Implemented | Vendor confirms QR/manual redemption |

### Admin side

| API | Status | Purpose |
|---|---|---|
| `GET /api/v1/admin/rewards` / rewards management equivalent | Implemented/Partial | Rewards dashboard/history |
| `POST /api/v1/admin/rewards/rules` | Implemented | Create reward rule |
| `PATCH /api/v1/admin/rewards/rules/:rewardRuleId` | Implemented | Update reward rule |
| `POST /api/v1/admin/rewards/points` | Implemented | Admin manually awards points |

## 7. Main gaps to implement for exact client flow

| Gap | Required backend change | Priority |
|---|---|---|
| Vendor Funded / Bite Drop Funded | Add `fundingType` enum/field to reward rules/campaigns/redemptions. Default `VENDOR_FUNDED`. | Critical |
| Minimum purchase | Add `minimumPurchaseAmount` field and return it in reward/rule/redemption response. | Critical |
| Campaign total limit | Add total redemption limit/count tracking. | High |
| Eligible vendors | Add all vendors vs selected vendors targeting. | High |
| Points removed timing | Decide whether points deduct on code creation or vendor confirmation. Client text says remove on confirm; current code deducts on code creation and refunds after expiry. | Critical decision |
| QR redemption record details | Redemption record should include reward amount, minimum purchase, funding type, vendor, food truck, foodie, method, date/time, status. | High |
| Admin reward campaign UI support | APIs need fields for amount/min purchase/funding type/start/end/limits/eligible vendors. | Critical |
| Bite Drop funded future support | Need reimbursement/reporting model if Bite Drop funds campaign. | Medium/Future |
| Terms/vendor agreement checkboxes | Need onboarding acceptance fields once legal text finalized. | High |

## 8. Current behavior vs client expected behavior — important differences

### Difference 1: points removal timing

Client says:

```txt
Vendor confirms redemption → Reward/points are removed from Foodie account
```

Current backend:

```txt
Foodie creates redemption code → points are deducted immediately
Vendor confirms → status becomes COMPLETED
If code expires → points refunded
```

This is not necessarily wrong, but client should confirm if this is acceptable.

### Difference 2: minimum purchase

Client wants:

```txt
$5 reward valid for $15+ purchase
```

Current backend:

```txt
Reward amount exists, but minimum purchase is not modeled/enforced.
```

Vendor can manually check POS amount, but backend/admin cannot guarantee it.

### Difference 3: funding source

Client wants:

```txt
Vendor Funded default
Bite Drop Funded future campaign
```

Current backend:

```txt
No funding source field exists.
```

## 9. Recommended exact answer to client

```txt
We currently support the core vendor-confirmed redemption concept: foodies can generate a redemption token/code, vendors can confirm it, and the code is single-use. Admin can create/update reward rules with points required, reward value, activity dates, per-user limits, and active/inactive status.

However, the exact visual flow is not fully complete yet. Minimum purchase requirements, explicit Vendor Funded vs Bite Drop Funded campaign type, total redemption limits, eligible vendor targeting, and full campaign reporting need additional backend fields/API updates. Also, the current system deducts points when the foodie creates the redemption code, then refunds if it expires; the client flow says points are removed after vendor confirmation, so we should confirm the preferred behavior before final implementation.
```

## 10. Final status

| Area | Status |
|---|---|
| Core points system | Implemented |
| Reward rules | Partial |
| QR/token redemption | Partial/mostly implemented |
| Vendor confirmation | Implemented |
| Single-use redemption | Implemented |
| Minimum purchase | Not implemented |
| Vendor Funded default | Not implemented |
| Bite Drop Funded future type | Not implemented |
| Admin campaign controls from visual | Partial |
| Redemption history | Partial/implemented |
| Vendor agreement checkbox | Not implemented yet; waiting for legal wording |
