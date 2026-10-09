# Flutter Developer Doc — Vendor Dashboard Access & Optional Verification

## Purpose

Client updated the vendor flow:

- Vendor verification documents are optional.
- Verification documents are only for the Bite Drop Verified badge.
- Vendor dashboard access should not be blocked by document verification.
- Vendor can enter dashboard immediately after vendor onboarding as an Unverified Vendor.
- Payment onboarding is separate from Bite Drop document verification.

## Backend behavior changed

### Before

Backend treated this as access requirement:

```text
vendor.status === APPROVED
AND
vendor.isVerified === true
```

So if vendor did not submit documents, or documents were pending, app could get stuck on Verification Pending.

### Now

Backend treats these separately:

```text
vendor.status = dashboard/platform access state
vendor.isVerified = Bite Drop Verified badge only
```

Current meaning:

| Field | Meaning |
| --- | --- |
| `vendor.status = APPROVED` | Vendor onboarding is complete and dashboard access is allowed |
| `vendor.status = PENDING_APPROVAL` | Old/pending verification state; dashboard access is still allowed for compatibility |
| `vendor.isVerified = false` | Vendor does not have Bite Drop Verified badge |
| `vendor.isVerified = true` | Vendor has Bite Drop Verified badge |

## API response change

### `GET /api/v1/vendors/me`

Backend now returns these helper objects:

```json
{
  "status": "APPROVED",
  "isVerified": false,
  "dashboardAccess": {
    "allowed": true,
    "status": "AVAILABLE",
    "reason": null
  },
  "verificationBadge": {
    "isVerified": false,
    "status": "UNVERIFIED",
    "optional": true,
    "message": "Vendor can use the dashboard as an Unverified Vendor.",
    "rejectionReason": null
  },
  "verificationRequirements": {
    "optional": true,
    "purpose": "Bite Drop Verified badge only",
    "pendingUntilApproved": false
  }
}
```

## Flutter app should update

### 1. Do not block dashboard using `isVerified`

Do not use this logic anymore:

```text
if vendor.isVerified == false:
  show Verification Pending
  block dashboard
```

Use this instead:

```text
if vendor.dashboardAccess.allowed == true:
  allow Vendor Dashboard
else:
  show onboarding-required screen/message
```

Fallback if old app model does not have `dashboardAccess` yet:

```text
allow dashboard if vendor.status is APPROVED or PENDING_APPROVAL
```

## 2. Verification screen should be optional

Verification screen should be shown as an optional badge flow, not as required onboarding.

Recommended UI labels:

| Backend state | App UI |
| --- | --- |
| `verificationBadge.status = UNVERIFIED` | Show “Get Bite Drop Verified” optional CTA |
| `verificationBadge.status = PENDING` | Show “Verification under review” but still allow dashboard |
| `verificationBadge.status = REJECTED` | Show “Verification needs attention” and allow resubmit |
| `verificationBadge.status = VERIFIED` | Show Bite Drop Verified badge |

## 3. Documents Submitted should not mean onboarding completed

The app should not mark core vendor onboarding as blocked by document submission.

Document submission status belongs only to:

```text
Bite Drop Verified badge
```

Not:

```text
Vendor dashboard access
Payment setup
Subscription setup
Food truck profile management
```

## 4. Payment setup remains separate

Payment onboarding should still use the Stripe/Connect/payment setup APIs.

Do not depend on:

```text
vendor.isVerified
```

for Stripe/payment setup.

Payment setup should depend on payment account status fields only, such as:

```text
onboardingCompleted
chargesEnabled
payoutsEnabled
disabledReason
```

## 5. Expected Flutter flow after update

```text
Vendor signs up / logs in
→ Vendor completes vendor onboarding
→ App calls GET /vendors/me
→ If dashboardAccess.allowed = true
→ Enter Vendor Dashboard
→ Show Unverified Vendor state if isVerified = false
→ Optional: user can open Bite Drop Verified badge flow
→ Payment setup is handled separately
```

## 6. Testing checklist for Flutter

### Test 1 — Vendor skips verification documents

Expected:

- Vendor can enter dashboard.
- App shows Unverified Vendor / Get Verified CTA.
- App must not show blocking Verification Pending screen.

### Test 2 — Vendor submits verification documents

Expected:

- Vendor can still enter dashboard.
- App shows verification badge status as pending.
- App must not block dashboard while documents are under review.

### Test 3 — Admin approves badge

Expected:

- `isVerified = true`
- App shows Bite Drop Verified badge.

### Test 4 — Admin rejects badge

Expected:

- Vendor can still enter dashboard.
- App shows rejected/needs-attention message for badge only.
- App allows document resubmit if UI supports it.

### Test 5 — Payment setup

Expected:

- Payment setup is not blocked by Bite Drop document verification.
- Payment setup UI should check Stripe/payment account fields, not `isVerified`.

## Short note

For Flutter, the main change is:

```text
isVerified should only control the Verified badge UI.
dashboardAccess.allowed should control Vendor Dashboard access.
```

