# Same Email Foodie + Vendor — Minimal Implementation Plan

এই plan শুধুমাত্র implementation-এর জন্য। Goal হলো client-এর requirement solve করা:

```text
One email/account can use both Foodie Mode and Vendor Mode.
```

আমরা unnecessary complex flow avoid করবো এবং current project-এর existing schema/role system reuse করবো।

## 1. Current codebase reality

Current project already multi-role support করার জন্য ready:

```text
users
user_roles
vendors
```

Important existing behavior:

- `users.email` unique আছে।
- `user_roles` table আছে।
- `user_roles` already multiple role per user support করে।
- `vendors.userId` unique আছে, meaning one user can own one vendor profile.
- JWT token already `roles` include করে।

So new major DB structure লাগবে না।

## 2. What we will NOT do

এই partগুলো intentionally বাদ:

| Avoid                                                                 | Reason                                                    |
| --------------------------------------------------------------------- | --------------------------------------------------------- |
| Email unique constraint remove করা                                    | Same email should mean same account, duplicate account না |
| Separate Foodie account + Vendor account merge flow                   | Too risky and unnecessary for current need                |
| New `account_modes` table                                             | Existing `user_roles` enough                              |
| Multi-vendor ownership/member table                                   | Future feature হতে পারে, current requirement না           |
| Existing email দিয়ে password signup করলে silently Vendor role add করা | Security risk; user must login first                      |
| Admin approval কে Foodie/Vendor mode switching-এর সাথে mix করা        | Vendor verification/payment onboarding separate flow      |

## 3. Final target behavior

### New Foodie signup

```text
register/customer
→ User create
→ CUSTOMER role
→ Foodie mode available
```

### Existing Foodie becomes Vendor

```text
Foodie login
→ call Become Vendor API
→ VENDOR role added
→ Draft Vendor profile created if missing
→ fresh token returned with roles ["CUSTOMER", "VENDOR"]
→ app can switch to Vendor Mode / Vendor onboarding
```

### New Vendor signup

```text
register/vendor
→ User create
→ CUSTOMER + VENDOR roles
→ Draft Vendor profile create
→ after email verify, both modes available
```

### Existing Vendor uses Foodie mode

```text
Vendor user already has CUSTOMER role after update
→ Foodie mode available from same account
```

## 4. Implementation steps

## Step 1 — Add shared helper methods in AuthService

File:

```text
src/modules/auth/auth.service.ts
```

Add reusable private helpers:

```text
ensureUserRole(tx, userId, role)
ensureVendorProfile(tx, user, dto)
getAuthUserById(userId)
```

Purpose:

- Avoid duplicate role insert.
- Avoid duplicate vendor profile insert.
- Keep logic same for password auth, Firebase auth, and Become Vendor API.

Expected behavior:

```text
If role already exists → do nothing
If role missing → create user_roles row

If vendor profile exists → return it
If missing → create DRAFT vendor profile
```

## Step 2 — New authenticated Become Vendor API

Recommended endpoint:

```http
POST /api/v1/auth/me/become-vendor
```

Why Auth module?

Because this endpoint changes the authenticated user's roles and needs to return fresh auth tokens. It is not just vendor profile update.

Auth required:

```text
Bearer token
```

Request DTO:

```json
{
  "businessName": "Taco Paradise",
  "businessEmail": "owner@example.com",
  "businessPhone": "+12025550191",
  "description": "Mexican street food truck",
  "websiteUrl": "https://tacoparadise.com"
}
```

Fields can be optional except `businessName` can be auto-filled if missing:

```text
businessName fallback:
profile displayName → email prefix → "Pending Vendor Profile"
```

Backend behavior:

```text
1. Get current user from token
2. Check user exists and active
3. Add VENDOR role if missing
4. Keep CUSTOMER role if exists
5. If CUSTOMER role missing, add CUSTOMER too
6. Create DRAFT vendor profile if missing
7. Return fresh auth response with new roles
```

Response:

```json
{
  "accessToken": "new-access-token",
  "refreshToken": "new-refresh-token",
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

Important:

Fresh token is required because old token may only contain:

```json
["CUSTOMER"]
```

Vendor APIs need:

```json
["VENDOR"]
```

## Step 3 — Vendor registration should create both roles

File:

```text
src/modules/auth/auth.service.ts
```

Current:

```text
registerVendor() creates only VENDOR role
```

Update:

```text
registerVendor() should create CUSTOMER + VENDOR roles
```

Why?

Client wants vendor account to also use Foodie mode.

Expected:

```json
"roles": ["CUSTOMER", "VENDOR"]
```

## Step 4 — Existing email in vendor registration

Current:

```text
registerVendor() duplicate email → ConflictException
```

Keep conflict, but improve message.

Do not silently attach vendor role in password register flow.

Reason:

If someone enters another person's email, backend must not add vendor access to that account without proving ownership.

Recommended error message:

```text
An account already exists with this email. Please login and continue vendor onboarding from your account.
```

This tells Flutter to redirect user to login, then call:

```http
POST /api/v1/auth/me/become-vendor
```

## Step 5 — Firebase login existing user + requested VENDOR

File:

```text
src/modules/auth/auth.service.ts
```

Current Firebase flow:

```text
If Firebase user exists, backend logs in and updates profile.
```

Update:

If existing user logs in with Firebase and sends:

```json
{
  "role": "VENDOR"
}
```

Then:

```text
1. Add VENDOR role if missing
2. Add CUSTOMER role if missing
3. Create vendor draft profile if missing
4. Return fresh auth response
```

This is safe because Firebase token proves email ownership.

## Step 6 — Auth response examples update

File:

```text
src/modules/auth/auth.controller.ts
```

Update Swagger examples:

Vendor user should show:

```json
"roles": ["CUSTOMER", "VENDOR"]
```

Add example for:

```http
POST /api/v1/auth/me/become-vendor
```

## Step 7 — Optional existing data backfill

Existing vendors may currently have only:

```json
["VENDOR"]
```

For requirement consistency, add CUSTOMER role for existing vendor users.

Implementation options:

### Option A — Migration SQL

```sql
INSERT INTO user_roles (id, user_id, role)
SELECT gen_random_uuid(), ur.user_id, 'CUSTOMER'
FROM user_roles ur
WHERE ur.role = 'VENDOR'
ON CONFLICT (user_id, role) DO NOTHING;
```

### Option B — Admin one-time script

Safe alternative if migration conflicts exist.

Recommendation:

Use migration only if local migration history is clean. Otherwise use a safe one-time script on server after deploy.

## 5. Files likely to change

| File                                          | Change                                                                                 |
| --------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/modules/auth/auth.service.ts`            | Add helpers, become vendor method, update vendor register, update Firebase role attach |
| `src/modules/auth/auth.controller.ts`         | Add authenticated become-vendor route + Swagger docs                                   |
| `src/modules/auth/dto/register-vendor.dto.ts` | Usually no required change                                                             |
| `src/modules/auth/dto/firebase-auth.dto.ts`   | Usually no required change because `role` already exists                               |
| `src/modules/auth/dto/become-vendor.dto.ts`   | New DTO                                                                                |
| `prisma/schema/migrations/...`                | Optional backfill only                                                                 |

## 6. API testing plan

### Test 1 — New customer signup

```text
POST /api/v1/auth/register/customer
Verify email
Expected roles: ["CUSTOMER"]
```

### Test 2 — Customer becomes vendor

```text
Login as customer
POST /api/v1/auth/me/become-vendor
Expected roles: ["CUSTOMER", "VENDOR"]
Expected vendor exists
Expected new token works on vendor protected route
```

### Test 3 — New vendor signup

```text
POST /api/v1/auth/register/vendor
Verify email
Expected roles: ["CUSTOMER", "VENDOR"]
Expected vendor exists
```

### Test 4 — Duplicate vendor registration with existing customer email

```text
POST /api/v1/auth/register/vendor using existing customer email
Expected: Conflict
Expected message tells user to login and continue vendor onboarding
```

### Test 5 — Firebase existing customer requests vendor role

```text
POST /api/v1/auth/firebase
role = VENDOR
Expected roles: ["CUSTOMER", "VENDOR"]
Expected vendor draft profile exists
```

### Test 6 — Mode switch app behavior

```text
Login response has roles ["CUSTOMER", "VENDOR"]
Flutter should show Foodie Mode + Vendor Mode
```

## 7. Acceptance criteria

Implementation is complete when:

- Existing Foodie can become Vendor without a new email.
- Existing Vendor can use Foodie mode.
- New Vendor gets both roles.
- No duplicate user account is created for same email.
- Email unique constraint remains unchanged.
- Fresh token includes updated roles.
- Existing vendor users can be backfilled with CUSTOMER role.
- Vendor onboarding/payment/verification remain separate from account role switching.

## 8. Short implementation order

Recommended order:

```text
1. Add BecomeVendorDto
2. Add AuthService helper functions
3. Add AuthService.becomeVendor()
4. Add AuthController route
5. Update registerVendor() roles
6. Update Firebase existing-user role attach
7. Update Swagger examples
8. Build/test
9. Optional backfill existing vendors
```

## 9. Final note

The main rule:

```text
Do not create duplicate account for same email.
Do not remove email uniqueness.
Use user_roles to add capabilities to the same account.
```
