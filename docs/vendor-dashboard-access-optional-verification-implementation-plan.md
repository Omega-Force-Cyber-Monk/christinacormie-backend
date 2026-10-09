# Vendor Dashboard Access + Optional Verification Badge — Implementation Plan

Client-এর updated requirement:

```text
Vendor verification documents are optional.
Verification is only for Bite Drop Verified badge.
Vendor dashboard access should not require manual Bite Drop approval.
Vendor can enter dashboard immediately as Unverified Vendor.
Payment onboarding is separate.
Monthly + annual subscription options should be available.
```

এই plan backend implementation-এর জন্য। Goal হলো dashboard access unblock করা, কিন্তু marketplace/payment/public trust-sensitive actions safe রাখা।

## 1. Current problem

Current backend অনেক জায়গায় vendor access block করছে এই condition দিয়ে:

```text
vendor.status === APPROVED && vendor.isVerified === true
```

এটার কারণে:

- Vendor onboarding complete করলেও dashboard আটকে যাচ্ছে।
- Verification document submit না করলে “Verification Pending” flow-তে stuck হচ্ছে।
- `isVerified=false` মানেই vendor unusable হয়ে যাচ্ছে।

Client-এর নতুন rule অনুযায়ী এটা ভুল।

## 2. New meaning of vendor fields

Current fields:

```text
vendor.status
vendor.isVerified
vendor.verificationRequests
```

Recommended meaning:

| Field                          | New meaning                                                            |
| ------------------------------ | ---------------------------------------------------------------------- |
| `status = DRAFT`               | Vendor profile/onboarding incomplete                                   |
| `status = APPROVED`            | Vendor can access platform/dashboard                                   |
| `status = SUSPENDED`           | Vendor blocked by admin                                                |
| `status = REJECTED`            | Only if vendor/business is explicitly rejected/suspended from platform |
| `isVerified = false`           | Vendor does not have Bite Drop Verified badge                          |
| `isVerified = true`            | Vendor has Bite Drop Verified badge                                    |
| `verificationRequests.PENDING` | Badge review pending, but dashboard still accessible                   |

Important:

```text
APPROVED does not mean verified badge.
isVerified means verified badge.
```

## 3. What should be accessible without verification badge?

Unverified Vendor should access:

- Vendor dashboard
- Vendor profile
- Food truck/profile setup
- Menu setup
- Staff management
- Promotions
- Credit acceptance settings
- Subscription screen
- Payment onboarding screen
- Verification badge submission screen

Condition should be:

```text
vendor exists
vendor.status is not SUSPENDED/REJECTED
```

or for onboarding-complete routes:

```text
vendor.status !== DRAFT
```

## 4. What should still require extra checks?

Some actions should remain controlled.

| Feature                           | Required condition                                                  |
| --------------------------------- | ------------------------------------------------------------------- |
| Dashboard access                  | vendor profile exists and not suspended                             |
| Vendor profile edit               | vendor profile exists and not suspended                             |
| Food truck setup/edit             | vendor profile exists and not suspended                             |
| Public marketplace visibility     | food truck active + vendor not suspended                            |
| Customer booking a truck          | food truck active + vendor not suspended                            |
| Payment receiving                 | Stripe/RevenueCat/payment account requirements, not Bite Drop badge |
| Bite Drop Verified badge display  | `vendor.isVerified === true`                                        |
| Admin approval/rejection of badge | affects `isVerified`, not dashboard access                          |

## 5. Backend guard changes needed

Current code uses `ensureVendorApproved()` as a hard gate.

Files found:

```text
src/modules/vendors/vendors.service.ts
src/modules/food-trucks/food-trucks.service.ts
src/modules/bookings/bookings.service.ts
src/modules/payments/payments.service.ts
src/modules/rewards/rewards.service.ts
```

### 5.1 Replace one hard guard with two separate guards

Add two concepts:

```text
ensureVendorCanAccessDashboard(vendor)
ensureVendorVerifiedBadge(vendor)
```

Recommended behavior:

```ts
ensureVendorCanAccessDashboard(vendor):
  if vendor.status === SUSPENDED or REJECTED:
    throw Forbidden
  if vendor.status === DRAFT:
    allow only onboarding/profile completion routes
  otherwise allow dashboard

ensureVendorVerifiedBadge(vendor):
  if !vendor.isVerified:
    throw Forbidden only for badge-only features
```

Avoid using:

```text
status APPROVED + isVerified
```

for normal dashboard access.

## 6. Vendor onboarding completion behavior

Current `completeOnboarding()` likely keeps vendor in a state that can lead to pending approval.

Required update:

After basic vendor onboarding is complete:

```text
vendor.status should become APPROVED
vendor.isVerified should remain false
```

Meaning:

```text
Vendor can use dashboard as Unverified Vendor.
Vendor does not have verified badge.
```

This should not create a verification request unless vendor actually submits documents.

Expected response should clearly include:

```json
{
  "vendor": {
    "status": "APPROVED",
    "isVerified": false
  },
  "verification": {
    "badgeStatus": "NOT_SUBMITTED",
    "dashboardAccess": true
  }
}
```

## 7. Verification document flow behavior

Verification documents are optional and only for badge.

### Submit documents

API:

```http
POST /api/v1/vendors/me/verification
```

Expected behavior:

```text
Create VendorVerificationRequest with PENDING
Do not remove dashboard access
Do not set vendor.status = PENDING_APPROVAL
Keep vendor.status = APPROVED
Keep vendor.isVerified = false until admin approves
```

So update repository:

Current:

```text
submitVerificationRequest() sets vendor.status = PENDING_APPROVAL
```

Change to:

```text
submitVerificationRequest() should NOT change vendor.status to PENDING_APPROVAL
```

It should only create verification request.

### Admin approves verification

Current admin approve probably sets:

```text
status = APPROVED
isVerified = true
```

New behavior:

```text
status remains APPROVED
isVerified = true
verifiedAt = now
```

This is fine.

### Admin rejects verification

Current reject probably sets:

```text
status = REJECTED
isVerified = false
```

New behavior:

```text
status should remain APPROVED
isVerified = false
rejectionReason set
```

Dashboard remains accessible.

Only badge is rejected.

## 8. API response fields needed for Flutter

Vendor profile response should clearly tell app:

```json
{
  "status": "APPROVED",
  "isVerified": false,
  "dashboardAccess": true,
  "verificationBadge": {
    "status": "NOT_SUBMITTED",
    "isVerified": false,
    "canSubmit": true,
    "message": "Verification is optional and only affects the Bite Drop Verified badge."
  }
}
```

Possible badge statuses:

```text
NOT_SUBMITTED
PENDING
APPROVED
REJECTED
```

This can be computed from:

```text
vendor.isVerified
latest verificationRequest.status
```

## 9. Flutter app behavior

### Do not block dashboard because of:

```text
isVerified = false
verification request pending
documents not submitted
```

### Dashboard should block only if:

```text
vendor profile missing
vendor.status = SUSPENDED
vendor.status = REJECTED
```

### Show badge UI separately

If `isVerified=false`:

```text
Show "Unverified Vendor"
Show optional "Apply for Bite Drop Verified badge"
```

If verification pending:

```text
Show "Verification badge review pending"
Still allow dashboard
```

If approved:

```text
Show Bite Drop Verified badge
```

## 10. Payment onboarding clarification

Payment onboarding should not depend on Bite Drop badge verification.

Payment setup should depend on:

```text
Stripe/Connect or RevenueCat/payment account requirements
bank/tax/business information completion
```

Not:

```text
vendor.isVerified
verification documents
```

So payment routes should avoid checking Bite Drop badge status.

## 11. Monthly + annual subscription options

Client says only monthly was visible.

Need check:

```http
GET /api/v1/subscriptions/plans
```

Expected:

Each plan should expose provider products for both monthly and annual if configured.

Backend should return something like:

```json
{
  "items": [
    {
      "code": "STARTER",
      "providerProducts": [
        {
          "billingPeriod": "MONTHLY",
          "providerProductId": "..."
        },
        {
          "billingPeriod": "ANNUAL",
          "providerProductId": "..."
        }
      ]
    }
  ]
}
```

If annual product is missing, this may be RevenueCat/admin seed config issue, not dashboard verification issue.

Implementation check:

- Confirm DB has annual provider products.
- Confirm RevenueCat has annual packages/products.
- Confirm `GET /subscriptions/plans` returns annual product mappings.

## 12. Files likely to change

| File                                                 | Change                                                                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/modules/vendors/vendors.service.ts`             | Replace dashboard guard logic, add badge status response                                                |
| `src/modules/vendors/vendors.repository.ts`          | Do not set status `PENDING_APPROVAL` on document submit; reject badge without rejecting vendor          |
| `src/modules/food-trucks/food-trucks.service.ts`     | Allow unverified vendors to manage own trucks                                                           |
| `src/modules/bookings/bookings.service.ts`           | Booking/public availability should check vendor not suspended, not badge                                |
| `src/modules/payments/payments.service.ts`           | Payment access should not require Bite Drop badge                                                       |
| `src/modules/rewards/rewards.service.ts`             | Vendor credit/reward confirmation should not require verified badge unless business wants verified-only |
| `src/modules/subscriptions/subscriptions.service.ts` | Verify monthly + annual products return                                                                 |

## 13. Minimal implementation order

Recommended order:

```text
1. Add vendor access helper:
   canAccessDashboard = status not SUSPENDED/REJECTED

2. Update completeOnboarding:
   status = APPROVED
   isVerified remains false

3. Update submitVerificationRequest:
   create request only
   do not set vendor.status = PENDING_APPROVAL

4. Update admin approve:
   set isVerified = true
   keep status APPROVED

5. Update admin reject:
   set isVerified = false
   keep status APPROVED
   save rejectionReason

6. Update routes/services that currently require APPROVED + isVerified:
   split dashboard/manage routes vs public/payment-sensitive routes

7. Add verificationBadge/dashboardAccess fields in vendor profile response

8. Check subscription plans response for monthly + annual products
```

## 14. Testing plan

### Test 1 — Vendor skips verification

```text
Vendor completes onboarding
Does not submit documents
Expected:
  can open dashboard
  status APPROVED
  isVerified false
  badge NOT_SUBMITTED
```

### Test 2 — Vendor submits badge documents

```text
Submit verification documents
Expected:
  dashboard still accessible
  status remains APPROVED
  isVerified false
  badge PENDING
```

### Test 3 — Admin approves badge

```text
Admin approves
Expected:
  dashboard accessible
  status APPROVED
  isVerified true
  badge APPROVED
```

### Test 4 — Admin rejects badge

```text
Admin rejects
Expected:
  dashboard still accessible
  status APPROVED
  isVerified false
  badge REJECTED
```

### Test 5 — Payment onboarding

```text
Unverified vendor opens payment setup
Expected:
  allowed to start payment onboarding
  Stripe/RevenueCat handles payment requirements
```

### Test 6 — Subscription plans

```text
GET /api/v1/subscriptions/plans
Expected:
  monthly and annual options returned if configured
```

## 15. Acceptance criteria

This requirement is complete when:

- Vendor can access dashboard without submitting verification documents.
- Vendor can access dashboard while verification badge is pending.
- Verification documents only affect `isVerified` badge.
- Admin rejection of badge does not block platform access.
- Payment onboarding is separate from Bite Drop badge verification.
- Flutter can show monthly and annual subscription products.
- Flutter can show clear status:

```text
Unverified Vendor
Verification Pending
Bite Drop Verified
Verification Rejected
```

without blocking dashboard.
