# Vendor Verification / Dashboard Access — Client Feedback Bangla Explanation

এই ডকুমেন্টে client যে Vendor Verification / Dashboard Access নিয়ে feedback দিয়েছে, সেটার আসল meaning, সে কী চাইছে, এবং current system flow-তে কী change দরকার হতে পারে সেটা সহজভাবে explain করা হলো।

## ১. Client আসলে কী বলেছে?

Client vendor signup flow test করেছে।

সে কোনো verification document submit করেনি, কারণ তার expectation হলো:

```text
Bite Drop verification badge optional.
```

কিন্তু app behavior ছিল:

```text
Vendor signup/onboarding করার পর app তাকে “Verification Pending” screen-এ পাঠিয়েছে।
“Documents Submitted” completed হিসেবে দেখিয়েছে।
Vendor Dashboard access block করেছে।
```

Client বলছে এই flow ভুল।

## ২. Client কী চায়?

Client চায়:

```text
Vendor যেন verification document submit না করলেও dashboard-এ ঢুকতে পারে।
```

মানে:

```text
Vendor account create/onboarding complete
→ Vendor dashboard access immediately allowed
→ Vendor status can be Unverified
→ Verification badge optional
```

Vendor যদি Bite Drop Verified badge নিতে চায়, তখন সে documents submit করবে।

## ৩. Important distinction: Vendor Dashboard Access vs Verified Badge

Client দুইটা জিনিস আলাদা করতে বলছে:

| বিষয় | Client-এর expectation |
|---|---|
| Vendor Dashboard Access | Vendor onboarding complete করলে immediately dashboard access পাবে |
| Bite Drop Verified Badge | Optional; vendor চাইলে documents submit করবে |
| Document Review | শুধু badge পাওয়ার জন্য review হবে |
| Documents Pending | Dashboard access block করবে না |
| Documents Rejected | Vendor unverified থাকবে, কিন্তু dashboard access থাকা উচিত |

## ৪. Current app/backend flow-এ সম্ভবত কী ভুল হচ্ছে?

Current flow সম্ভবত verification approval এবং dashboard access একই condition-এর উপর depend করছে।

Example:

```text
vendor.status = PENDING_APPROVAL
or
vendor.isVerified = false
```

এগুলো দেখেই app dashboard block করছে।

Client বলছে এটা করা যাবে না।

Correct logic হওয়া উচিত:

```text
Dashboard access depends on vendor onboarding/profile completion.
Verified badge depends on document verification.
```

## ৫. Correct vendor status thinking

Client-এর requirement অনুযায়ী system-এ status concept এমন হওয়া উচিত:

```text
Vendor can be active but unverified.
```

Example:

```json
{
  "vendorDashboardAccess": true,
  "verificationBadge": false,
  "verificationStatus": "NOT_SUBMITTED"
}
```

আর যদি documents submit করে:

```json
{
  "vendorDashboardAccess": true,
  "verificationBadge": false,
  "verificationStatus": "PENDING_REVIEW"
}
```

Documents approve হলে:

```json
{
  "vendorDashboardAccess": true,
  "verificationBadge": true,
  "verificationStatus": "APPROVED"
}
```

## ৬. Client-এর expected flow

### Case A: Vendor skips verification

```text
Vendor signup
→ Email verify
→ Vendor onboarding/profile complete
→ No document upload
→ Vendor dashboard access allowed
→ Vendor shown as Unverified Vendor
→ No Bite Drop Verified badge
```

### Case B: Vendor submits documents

```text
Vendor signup
→ Email verify
→ Vendor onboarding/profile complete
→ Vendor dashboard access allowed
→ Vendor submits verification documents for badge
→ Documents under review
→ Vendor still can use dashboard
→ Badge pending
→ Admin approves documents
→ Vendor gets Bite Drop Verified badge
```

### Case C: Documents rejected

```text
Vendor dashboard access stays allowed
→ Vendor remains Unverified
→ Badge not shown
→ Vendor may resubmit documents later
```

## ৭. Payment onboarding is separate

Client আরও বলেছে payment onboarding আলাদা বিষয়।

মানে:

```text
Vendor dashboard access ≠ Stripe/Payment onboarding complete
```

যেসব vendor Bite Drop-এর মাধ্যমে payment receive করতে চায়, তাদের payment setup complete করতে হবে:

```text
identity
business info
banking info
tax info
```

কিন্তু payment onboarding incomplete হলেও basic vendor dashboard access block করা উচিত কিনা সেটা আলাদা decision।

Recommended:

```text
Dashboard access allowed
Payment receiving features locked until payment onboarding complete
```

Example:

```text
Vendor dashboard দেখতে পারবে
Profile/menu/truck manage করতে পারবে
কিন্তু payout/payment receive করতে হলে payment setup complete করতে হবে
```

## ৮. Sandbox webhook issue নিয়ে client-এর question

Client জিজ্ঞেস করেছে:

```text
Payment setup test করতে না পারার কারণ কি sandbox webhook issue?
```

এর meaning:

সে payment onboarding বা subscription/payment flow test করতে গিয়ে blocked হয়েছে।

Possible reasons:

```text
Stripe sandbox/test credential issue
Webhook secret mismatch
Connect onboarding issue
RevenueCat/subscription config issue
Server env not matching dashboard
```

এটা verification document issue থেকে separate।

## ৯. Monthly এবং Annual subscription option

Client বলেছে:

```text
Payment/subscription-এর ক্ষেত্রে monthly এবং annual দুই option থাকা উচিত।
```

কিন্তু সে app-এ শুধু monthly option দেখেছে।

এর meaning:

Backend/App subscription plan response-এ annual package/product support নেই বা app annual option render করছে না।

Need to check:

```text
RevenueCat annual products configured আছে কিনা
Backend providerProducts annual product return করছে কিনা
GET /subscriptions/plans response monthly + annual দুটো দিচ্ছে কিনা
Flutter app annual option show করছে কিনা
```

## ১০. Backend/App-এর জন্য required change summary

| Area | Required change |
|---|---|
| Dashboard access | Vendor onboarding complete হলে dashboard access allow করতে হবে |
| Verification documents | Optional করতে হবে |
| Verified badge | Only approved documents থাকলে show হবে |
| Pending documents | Dashboard block করবে না |
| Rejected documents | Dashboard block করবে না |
| Payment onboarding | Verification badge থেকে separate রাখতে হবে |
| Subscription options | Monthly + annual দুই option support/show করতে হবে |

## ১১. Most important rule

Client-এর main requirement:

```text
Manual Bite Drop approval should not be required just to use the vendor platform.
```

Verification should mean:

```text
Verified Badge
```

Not:

```text
Dashboard Access
```

## ১২. Simple explanation for developer

Current wrong assumption:

```text
Vendor is not approved/verified
→ Block dashboard
```

Correct assumption:

```text
Vendor onboarding/profile complete
→ Allow dashboard
→ If documents approved, show Verified badge
→ If documents not submitted/pending/rejected, show Unverified badge/status
```

## ১৩. Suggested response to client

```text
Thank you for explaining this clearly. I understand now that Bite Drop verification documents are only for the optional Verified badge and should not block a vendor from accessing the dashboard.

We will separate vendor dashboard access from document verification. Vendors who complete basic onboarding will be able to enter the dashboard as Unverified Vendors, even if they skip verification or their documents are still under review.

Payment onboarding will also remain separate. Vendors can access the dashboard, but payment receiving features will require completing the payment setup.

We will also review the subscription setup so both monthly and annual options are supported and visible.
```
