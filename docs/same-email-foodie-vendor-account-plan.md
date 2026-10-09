# Same Email Foodie + Vendor Account Plan

এই document-এর purpose হলো client-এর requirement অনুযায়ী same email/account দিয়ে Foodie এবং Vendor—দুই role support করার best scalable backend plan explain করা।

## Client কী চাইছে?

Client চাইছে:

- কোনো user যদি আগে Foodie হিসেবে signup করে, সে যেন same email দিয়েই Vendor profile add করতে পারে।
- কোনো user যদি আগে Vendor হিসেবে signup করে, সে যেন same account দিয়েই Foodie mode ব্যবহার করতে পারে।
- User-এর দুইটা আলাদা email/account লাগবে না।
- App-এ user Foodie Mode এবং Vendor Mode-এর মধ্যে switch করতে পারবে।

সহজভাবে:

```text
One User Account
  ├── Foodie role
  └── Vendor role + Vendor Profile
```

## Current project-এ কী আছে?

Current database design future-friendly, কারণ already user role system আছে:

```text
users
user_roles
vendors
```

Important schema:

```text
User.email is unique
UserRoleAssignment has unique(userId, role)
Vendor.userId is unique
```

এর মানে এক user-এর multiple role technically support করা সম্ভব:

```text
user_roles:
  userId = abc, role = CUSTOMER
  userId = abc, role = VENDOR
```

এবং একই user-এর একটি vendor profile থাকতে পারে:

```text
vendors.userId = abc
```

## তাহলে problem কোথায়?

Problem mainly auth/register flow-এ।

বর্তমানে:

- `registerCustomer()` নতুন email না হলে error দেয়।
- `registerVendor()` নতুন email/phone না হলে error দেয়।
- `ensureUniqueAccount()` email duplicate হলে block করে।

So existing Foodie যদি same email দিয়ে Vendor signup করতে যায়, backend বলবে:

```text
An account already exists with this email address
```

এই behavior client-এর expected flow-এর সাথে match করে না।

## Best scalable approach

Best way হলো:

```text
Signup/register = user account create করার জন্য
Add Vendor Profile = existing user account-এ Vendor role/profile attach করার জন্য
```

মানে existing account থাকলে নতুন account create করা যাবে না। বরং logged-in user নিজের account-এ Vendor role add করবে।

## Recommended final flow

### Case 1: New Foodie signup

```text
User registers as Foodie
→ User row create হবে
→ CUSTOMER role assign হবে
→ User app Foodie mode use করবে
```

### Case 2: Existing Foodie wants to become Vendor

```text
Foodie login করবে
→ "Become a Vendor" click করবে
→ Backend authenticated user-এর জন্য Vendor role add করবে
→ Vendor profile create করবে
→ Vendor onboarding start হবে
→ Same JWT/user now roles = [CUSTOMER, VENDOR]
```

### Case 3: New Vendor signup

```text
User registers as Vendor
→ User row create হবে
→ CUSTOMER role also assign করা ভালো
→ VENDOR role assign হবে
→ Vendor profile create হবে
→ Same account can use Foodie + Vendor mode
```

Why Vendor signup এ CUSTOMER role add করা ভালো?

কারণ client বলেছে যে Vendor account দিয়েও Foodie mode ব্যবহার করা যাবে। তাহলে vendor signup করলেও user-এর roles হওয়া উচিত:

```json
["CUSTOMER", "VENDOR"]
```

### Case 4: Existing Vendor wants Foodie mode

যদি Vendor signup-এর সময় CUSTOMER role automatically দেওয়া হয়, তাহলে extra API লাগবে না। Vendor already Foodie mode use করতে পারবে।

## Recommended backend API changes

### 1. Existing user-এর জন্য Vendor role/profile add API

New endpoint:

```http
POST /api/v1/vendors/me/start-onboarding
```

Auth required:

```text
Bearer token required
```

Purpose:

Existing logged-in user account-এ vendor profile attach করবে।

Request example:

```json
{
  "businessName": "Taco Paradise",
  "businessEmail": "owner@example.com",
  "businessPhone": "+12025550191",
  "description": "Mexican street food truck",
  "websiteUrl": "https://tacoparadise.com"
}
```

Backend behavior:

```text
1. Current user খুঁজবে
2. User active কিনা check করবে
3. user_roles এ VENDOR role না থাকলে add করবে
4. vendors table-এ ওই userId দিয়ে vendor profile আছে কিনা check করবে
5. না থাকলে DRAFT vendor profile create করবে
6. থাকলে existing vendor return করবে
7. Updated auth user / roles / onboarding state return করবে
```

Response example:

```json
{
  "message": "Vendor profile is ready for onboarding",
  "user": {
    "id": "user-id",
    "email": "owner@example.com",
    "roles": ["CUSTOMER", "VENDOR"],
    "vendor": {
      "id": "vendor-id",
      "businessName": "Taco Paradise"
    }
  },
  "onboarding": {
    "requiresProfileSetup": false,
    "requiresVendorOnboarding": true,
    "nextStep": "VENDOR_ONBOARDING",
    "missingFields": ["businessPhone"]
  }
}
```

### 2. Vendor registration behavior update

Current:

```text
registerVendor() duplicate email দেখলে error দেয়।
```

Recommended:

```text
If email not exists:
  create user + CUSTOMER role + VENDOR role + vendor profile

If email exists:
  Do not create duplicate user.
  Tell app/user to login first and call Become Vendor API.
```

Important:

For security, password-based vendor registration should not silently attach vendor role to an existing email without login. Otherwise someone could type another user's email and try to create vendor profile.

So for existing email:

```json
{
  "message": "An account already exists with this email. Please login and continue vendor onboarding from your account."
}
```

### 3. Firebase login role behavior update

Current Firebase login already looks up user by Firebase UID or email.

Recommended update:

If existing user logs in with Firebase and requests `role = VENDOR`:

```text
If user exists:
  ensure VENDOR role exists
  ensure vendor profile exists
  return updated roles and onboarding state
```

This is safe because Firebase token proves the user owns that email.

## App side mode switching

Backend should return roles in auth response:

```json
{
  "roles": ["CUSTOMER", "VENDOR"]
}
```

Flutter app should decide available modes from roles:

```text
roles contains CUSTOMER → Foodie Mode available
roles contains VENDOR → Vendor Mode available
```

Recommended app behavior:

```text
If user has both roles:
  show mode switcher

If user only has CUSTOMER:
  show Foodie mode + "Become a Vendor"

If user only has VENDOR:
  still allow Foodie mode if backend starts assigning CUSTOMER role to all vendors
```

## JWT impact

Current JWT includes roles:

```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "roles": ["CUSTOMER", "VENDOR"]
}
```

After adding Vendor role, app should refresh auth state/token.

Best options:

1. `start-onboarding` API returns new `accessToken` and `refreshToken`
2. Or app calls refresh/login again after role update

Recommended:

```text
Return fresh auth response after role/profile update.
```

Reason:

Old token may still have only:

```json
["CUSTOMER"]
```

Vendor-protected APIs need:

```json
["VENDOR"]
```

## Database migration needed?

Probably no new table needed.

Current schema already supports:

- one user
- multiple roles
- one vendor profile per user

But check existing data:

- Vendor users may currently have only `VENDOR` role.
- For client requirement, existing vendor users should also receive `CUSTOMER` role.

Recommended data backfill:

```text
For every user with VENDOR role:
  add CUSTOMER role if missing
```

This can be done as a safe migration or one-time script.

## Important validation rules

### Email

`users.email` remains unique. This is good.

Same email should mean same account, not duplicate account.

### Phone

Current `users.phone` is unique.

If existing Foodie has no phone and becomes Vendor, vendor onboarding can add phone to user or vendor business phone.

Need avoid conflict:

```text
If businessPhone belongs to another user → reject
If same user's phone → allow
```

### Vendor profile

One user should have only one vendor profile:

```text
Vendor.userId unique
```

This is good for now.

Future scale option:

If one user may own multiple businesses in future, current `Vendor.userId @unique` will be limiting. Then we would need owner/member model:

```text
vendors
vendor_members
  vendorId
  userId
  role = OWNER / MANAGER / STAFF
```

But current Bite Drop flow seems one vendor profile per account, so current schema is fine.

## Existing endpoints that may be affected

Vendor-protected routes currently use JWT role:

```text
@Roles(UserRole.VENDOR)
```

After user gets VENDOR role and fresh token, these routes should work.

Foodie/customer routes should continue to work because user keeps CUSTOMER role.

## Implementation phases

### Phase 1 — Backend role/profile attach

- Add authenticated "Become Vendor" API.
- Add helper:

```text
ensureUserRole(userId, VENDOR)
ensureVendorProfile(userId, dto)
```

- Return fresh auth response.

### Phase 2 — Vendor register update

- New vendor signup should create both CUSTOMER + VENDOR roles.
- Existing email should not create duplicate user.
- Existing email should tell user to login and continue vendor onboarding.

### Phase 3 — Firebase flow update

- If Firebase user exists and requested role is VENDOR:
  - add VENDOR role
  - create vendor draft profile if missing
  - return fresh roles/onboarding state

### Phase 4 — Backfill existing vendors

- Add CUSTOMER role for all existing VENDOR users if missing.

### Phase 5 — Flutter update

- App reads `user.roles`.
- If both roles exist, show mode switcher.
- "Become Vendor" button calls new authenticated backend API.
- After API success, app stores new token/user and moves to Vendor onboarding.

## Best final behavior

Expected final behavior:

```text
Same email = same user account
One user can have CUSTOMER + VENDOR role
Foodie can become Vendor after login
Vendor can use Foodie mode
Vendor onboarding remains separate from verification/payment onboarding
No duplicate user accounts
No security risk from someone registering vendor using another user's email
```

## Short developer note

Do not solve this by removing email unique constraint.

Correct solution:

```text
Keep email unique.
Use user_roles for multi-role.
Create/attach vendor profile to existing authenticated user.
Return refreshed token with updated roles.
```
