# Bite Drop Rewards Flow — Current Implementation Status

This document summarizes the current backend status based on the latest Bite Drop Rewards visual and requirements.

The goal is to clearly show:

- What is already done
- What is partially done
- What is not done yet
- What needs final confirmation before implementation

## Overall status

The core reward redemption foundation is already in place. Foodies can earn points, generate a redemption code/token, and vendors can confirm a redemption. The redemption is single-use and cannot be confirmed twice.

However, the latest visual introduces additional campaign controls and business rules that are not fully implemented yet, especially around minimum purchase, funding type, and admin campaign configuration.

## 1. Already Done

| Requirement | Status | Notes |
|---|---|---|
| Foodies can earn points | Done | Loyalty points and loyalty transactions already exist. |
| Foodies can view their points/rewards profile | Done | Foodie reward/profile summary APIs exist. |
| Foodies can redeem points into a reward/code | Done | Backend can create a redemption token and backup/manual code. |
| Foodie can show a QR/code to vendor | Done on backend | Backend returns a redemption token. The mobile app can convert this token into a QR code. |
| Vendor can confirm redemption | Done | Vendor confirmation API exists. |
| Vendor can confirm by QR token or manual code | Done | Backend supports both `redemptionToken` and `manualCode`. |
| Redemption is single-use | Done | Once confirmed, the same redemption cannot be used again. |
| Used/invalid/expired code is rejected | Done | Backend validates pending/expired/used status. |
| Vendor must be approved to confirm rewards | Done | Pending/unapproved vendors are blocked. |
| Food truck must be available/approved for redemption | Done | Backend checks truck/vendor availability when a truck is selected. |
| Admin can create reward rules | Done | Admin reward rule create API exists. |
| Admin can update reward rules | Done | Admin reward rule update API exists. |
| Admin can set points required | Done | `pointsRequired` exists. |
| Admin can set reward amount | Done | `rewardValue` exists. |
| Admin can turn reward rules on/off | Done | `isActive`, `startsAt`, and `endsAt` exist. |
| Admin can view reward/redemption history | Done / Basic | Basic rewards management and redemption history exist. |

## 2. Partially Done

| Requirement | Status | What exists now | What is still needed |
|---|---|---|---|
| QR redemption flow | Partially done | Token/manual code creation and vendor confirmation exist. | Need frontend QR display/scan integration and exact visual flow alignment. |
| Reward validation | Partially done | Backend validates status, expiry, vendor approval, food truck availability, and single-use. | Minimum purchase validation is not implemented yet. |
| Admin redemption limits | Partially done | Per-user limit exists through `maximumUsesPerUser`. | Total campaign redemption limit is not implemented yet. |
| Redemption history/reporting | Partially done | Basic redemption data exists. | Needs funding type, minimum purchase, campaign type, and richer campaign reporting. |
| Vendor manually applies discount | Partially done | Backend returns amount applied after confirmation. | POS/register application remains manual and is not tracked by backend. |
| Points are removed from Foodie account | Partially done | Points are deducted when the Foodie creates the redemption code and refunded if it expires. | Client flow says points should be removed after vendor confirmation. This behavior needs confirmation. |

## 3. Not Done Yet

| Requirement | Status | Notes |
|---|---|---|
| Vendor Funded vs Bite Drop Funded reward type | Not done | There is no explicit `fundingType` field yet. |
| Vendor Funded as default | Not done | Standard rewards are not yet explicitly marked as vendor-funded. |
| Bite Drop Funded future campaigns | Not done | Future Bite Drop-funded campaigns need a proper field/model. |
| Minimum purchase amount | Not done | Example: `$5 reward requires $15+ purchase`. This field does not exist yet. |
| Total redemption limit per campaign | Not done | Example: campaign max 500 total redemptions. |
| Eligible vendors/all vendors selection | Not done | Admin cannot yet choose all approved vendors vs selected vendors for a reward campaign. |
| One reward per transaction rule | Not done | Backend does not currently track POS transaction/subtotal. |
| Cannot combine with other rewards | Not done | This is not enforced by backend yet. |
| Taxes/tips/fees not counted toward minimum | Not done | Backend currently does not receive/register POS subtotal breakdown. |
| No cash value rule | Not done in backend | This is mainly Terms/UI copy, not a backend rule. |
| Vendor Terms/Rewards Program checkbox | Not done | Waiting for final legal wording from client. |
| Full campaign creation screen fields | Not done | Needs funding type, minimum purchase, total limit, eligible vendors, etc. |
