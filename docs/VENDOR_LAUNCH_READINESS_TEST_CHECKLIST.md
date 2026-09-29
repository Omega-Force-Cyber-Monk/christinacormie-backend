# Vendor Launch Readiness Test Checklist

Purpose: vendor side ta October 5 launch-er age clear, stable, and test-ready kina verify kora.

This document is only a testing/checklist document. It does not describe how to implement frontend.

## 1. Vendor Auth & Account Entry

| Area | What to test | Expected result | Priority |
|---|---|---|---|
| Email signup | Vendor can create account with email/password | Account created and email verification required | Critical |
| Email verification | Vendor can verify 6-digit code | Account becomes active and receives auth tokens | Critical |
| Login | Vendor can login with email/password | Vendor receives access/refresh token | Critical |
| Firebase Google login | Vendor can login/signup using Firebase Google token | Backend detects login vs signup and returns onboarding flags | Critical |
| Firebase Apple login | Vendor can login/signup using Firebase Apple token | Backend detects login vs signup and returns onboarding flags | High |
| Existing user login | Existing vendor logs in again | `authFlow=LOGIN`, `isNewUser=false` | Critical |
| New user signup | New vendor signs in first time | `authFlow=SIGN_UP`, onboarding status returned | Critical |
| Blocked/suspended account | Suspended/deactivated vendor tries login | Clear forbidden error returned | High |
| Rate limit | Repeated auth attempts | Backend returns rate limit instead of unlimited attempts | High |

## 2. Vendor Onboarding Flow

| Area | What to test | Expected result | Priority |
|---|---|---|---|
| Profile setup | Vendor can save name/contact/basic info | Profile updates correctly | Critical |
| Business profile | Vendor can save business/truck info | Vendor remains draft until verification submit | Critical |
| Logo/image upload | Vendor can upload profile/truck image | Image URL saved and shown in profile | High |
| Cuisine selection | Vendor can select cuisine type | Selected cuisine returns in profile/details APIs | High |
| Location/service area | Vendor can set city/location/service radius | Discovery/availability can use this data | High |
| Operating hours | Vendor can set/update hours | Hours are returned for edit/profile page | High |
| Guest capacity | Vendor can set capacity | Capacity appears in vendor profile/edit API | Medium |
| Draft onboarding | Incomplete vendor leaves flow and returns later | Saved data remains available | Critical |
| Onboarding status | Backend returns clear onboarding flags | Flutter can route to next screen correctly | Critical |

## 3. Vendor Verification & Admin Approval

| Area | What to test | Expected result | Priority |
|---|---|---|---|
| Document upload | Vendor can upload required verification documents | Documents are stored and linked to vendor | Critical |
| Submit verification | Vendor submits documents for review | Vendor status moves to review/pending state | Critical |
| Pending screen | Vendor sees verification pending state | App clearly shows under review | Critical |
| Admin review | Admin can view submitted vendor/documents | Admin sees all required info | Critical |
| Admin approve | Admin approves vendor | Vendor becomes approved/verified | Critical |
| Admin reject | Admin rejects with reason | Vendor sees rejection reason and can resubmit | High |
| Approved feature unlock | Approved vendor can access approved-only features | Access allowed only after approval | Critical |
| Pending feature block | Pending vendor tries booking/QR/staff/etc. | Backend blocks with clear error | Critical |

## 4. Stripe Payout / Connected Account

| Area | What to test | Expected result | Priority |
|---|---|---|---|
| Create Connect account | Vendor calls create/connect account API | Backend returns Stripe onboarding URL | Critical |
| Existing account continue | Vendor calls same API again | Backend returns new onboarding/update URL for same account | Critical |
| Express account type | Created Stripe account is Express | `stripe.accountType=express` | Critical |
| Onboarding submitted | Vendor completes Stripe onboarding | `onboardingCompleted=true` | Critical |
| Requirements pending | Stripe requires extra info/document | API returns exact `requirements.currentlyDue/pastDue` | Critical |
| Ready state | Stripe account fully ready | `onboardingCompleted=true`, `chargesEnabled=true`, `payoutsEnabled=true`, `disabledReason=null` | Critical |
| Not ready block | Vendor payout setup incomplete | Booking payment acceptance is blocked with clear message | Critical |
| Webhook update | Stripe `account.updated` webhook received | DB status updates automatically | High |
| Manual refresh | Vendor calls GET connect account | Backend refreshes latest status from Stripe | Critical |
| Stripe region issue | Platform cannot create Express account | Backend returns clear error, no Standard fallback | Critical |

## 5. Subscription / Plan / Founding Vendor

| Area | What to test | Expected result | Priority |
|---|---|---|---|
| Plans list | Vendor can fetch subscription plans | Free/Starter/Pro/Elite returned | Critical |
| Plan details | Plan response includes price, features, limits, commission | UI can render plan cards correctly | Critical |
| Founding window | Before Oct 5 founding offer is available | Founding benefit shown if eligible | Critical |
| After Oct 5 | New signup does not get founding discount | Standard pricing only | Critical |
| Current subscription | Vendor can fetch current subscription | Current plan/status returned | Critical |
| Active status | Active/trialing/grace period subscription | Paid features can be unlocked based on plan | High |
| Inactive status | Canceled/expired/refunded/disabled | Paid features blocked | High |
| RevenueCat sync | Flutter purchase syncs with backend | Backend updates subscription and selected plan | High |
| Webhook update | RevenueCat webhook updates backend | Backend subscription stays current | High |

## 6. Vendor Feature Access / Gating

| Feature | Test condition | Expected result | Priority |
|---|---|---|---|
| QR code | Vendor pending approval | Blocked | Critical |
| QR code | Approved vendor + valid plan | Allowed | Critical |
| Staff management | Vendor pending approval | Blocked | Critical |
| Staff management | Approved vendor + plan allows staff | Allowed | High |
| Analytics | Vendor pending approval | Blocked | High |
| Analytics | Approved vendor + plan allows analytics | Allowed | High |
| Booking actions | Vendor pending approval | Blocked | Critical |
| Booking actions | Approved vendor + payment ready + booking plan | Allowed | Critical |
| Quote actions | Vendor pending approval | Blocked | Critical |
| Promotions | Vendor pending approval | Blocked | High |
| Rewards/check-in redemption | Vendor pending approval or payout not ready | Blocked | Critical |
| Social/community vendor actions | Vendor pending approval | Blocked | High |
| Reviews vendor actions | Vendor pending approval | Blocked | Medium |

## 7. Booking Readiness

| Area | What to test | Expected result | Priority |
|---|---|---|---|
| Vendor receives request | Approved vendor with valid setup | Vendor can view booking/request | Critical |
| Send quote | Approved vendor can send quote | Customer can accept quote | Critical |
| Payment readiness check | Vendor payout not ready | Customer payment is blocked with clear error | Critical |
| Customer deposit/payment | Vendor payout ready | Payment intent created successfully | Critical |
| Payment success webhook | Stripe payment success event received | Booking/payment status updates | Critical |
| Completion flow | Vendor requests completion | Customer sees request pending | High |
| Payment release | Customer approves completion | Platform/vendor payout flow proceeds | High |
| Issue report | Customer reports issue | Payment release blocked until resolved | High |

## 8. Vendor UI Pages To Verify

| Page/Screen | Must verify | Priority |
|---|---|---|
| Choose plan | Plans, founding offer, selected plan, continue action | Critical |
| Vendor onboarding steps | Save/resume each step | Critical |
| Verification pending | Correct status and copy | Critical |
| Payout setup | Stripe onboarding/update URL and status | Critical |
| Edit profile | Basic info, hours, capacity, cuisine, image | Critical |
| Vendor dashboard | Shows only allowed features based on status | High |
| Booking list | Vendor can see relevant bookings/requests | Critical |
| Booking details | Quote/payment/timeline/actions visible correctly | Critical |
| Staff page | Only allowed when approved/plan allows | High |
| Analytics page | Only allowed when approved/plan allows | Medium |
| QR/rewards page | Only allowed when approved/payout ready | High |

## 9. Minimum Launch Acceptance Criteria

Before launch, these must be true:

- Vendor can sign up/login.
- Vendor can complete profile/onboarding.
- Vendor can submit verification documents.
- Admin can approve/reject vendor.
- Pending vendors are clearly blocked from approved-only features.
- Approved vendors can set up Stripe payout account.
- Stripe payout status is clear: incomplete, pending requirements, or ready.
- Vendor plan/subscription status is visible and usable.
- Booking/payment actions are blocked unless vendor is approved and payout-ready.
- Flutter developer has clear API/status rules for routing and gating.

## 10. Known High-Risk Items To Confirm

| Risk | Why it matters | Required decision/check |
|---|---|---|
| Stripe platform country | Malaysia platform may not support Express for US vendors | Use US Stripe platform for Express, or switch to Standard |
| Stripe webhook URL | Without webhook, payment/account status can be stale | Need deployed HTTPS backend webhook URL |
| RevenueCat readiness | App subscription flow depends on RevenueCat config | Confirm products/entitlement/webhooks |
| Vendor feature gating | Vendors may access features too early if not consistently blocked | Test backend guards and frontend hiding |
| Founding vendor deadline | Client marketing depends on Oct 5 rules | Confirm date and eligibility logic |
