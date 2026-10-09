# Same Email Foodie + Vendor Test Flow

এই docs follow করে step-by-step test করা যাবে যে same email/account দিয়ে Foodie এবং Vendor—দুই role কাজ করছে কিনা।

## Base URL

Local:

```text
http://localhost:3000
```

Server:

```text
https://api.bitedropapp.com
```

এই docs-এ placeholder:

```text
BASE_URL=http://localhost:3000
```

## Flow A — New Foodie signup, then same account becomes Vendor

এই flow সবচেয়ে important, কারণ client specifically বলেছে existing Foodie যেন Vendor হতে পারে।

## Step 1 — Register as Foodie

API:

```http
POST /api/v1/auth/register/customer
```

Body:

```json
{
  "name": "Alex Foodie Vendor",
  "email": "alex.foodie.vendor@example.com",
  "password": "Password123!",
  "dateOfBirth": "1998-05-20"
}
```

Expected:

```json
{
  "success": true,
  "status": "PENDING",
  "message": "Registration successful. Verify the 6-digit code sent to your email.",
  "email": "alex.foodie.vendor@example.com"
}
```

## Step 2 — Verify Foodie email

Backend log/console থেকে verification code নিতে হবে।

API:

```http
POST /api/v1/auth/verify-email
```

Body:

```json
{
  "email": "alex.foodie.vendor@example.com",
  "code": "123456"
}
```

Expected:

```json
{
  "accessToken": "CUSTOMER_ACCESS_TOKEN",
  "refreshToken": "CUSTOMER_REFRESH_TOKEN",
  "user": {
    "email": "alex.foodie.vendor@example.com",
    "roles": ["CUSTOMER"]
  }
}
```

Save:

```text
CUSTOMER_ACCESS_TOKEN
```

## Step 3 — Same Foodie account becomes Vendor

API:

```http
POST /api/v1/auth/me/become-vendor
```

Headers:

```text
Authorization: Bearer CUSTOMER_ACCESS_TOKEN
Content-Type: application/json
```

Body:

```json
{
  "businessName": "Alex Taco Truck",
  "businessEmail": "alex.foodie.vendor@example.com",
  "businessPhone": "+12025550191",
  "description": "Mexican street food truck",
  "websiteUrl": "https://alextacotruck.example.com"
}
```

Expected:

```json
{
  "accessToken": "NEW_ACCESS_TOKEN",
  "refreshToken": "NEW_REFRESH_TOKEN",
  "user": {
    "email": "alex.foodie.vendor@example.com",
    "roles": ["CUSTOMER", "VENDOR"],
    "vendor": {
      "id": "vendor-id",
      "businessName": "Alex Taco Truck"
    }
  },
  "authFlow": "LOGIN",
  "isNewUser": false,
  "onboarding": {
    "requiresVendorOnboarding": true,
    "nextStep": "VENDOR_ONBOARDING"
  }
}
```

Important:

Use `NEW_ACCESS_TOKEN` for vendor routes.

## Step 4 — Check Vendor profile with new token

API:

```http
GET /api/v1/vendors/me
```

Headers:

```text
Authorization: Bearer NEW_ACCESS_TOKEN
```

Expected:

```json
{
  "id": "vendor-id",
  "businessName": "Alex Taco Truck",
  "status": "DRAFT",
  "user": {
    "email": "alex.foodie.vendor@example.com",
    "userRoles": [{ "role": "CUSTOMER" }, { "role": "VENDOR" }]
  }
}
```

## Step 5 — Check old token behavior

Use old `CUSTOMER_ACCESS_TOKEN` on vendor route:

```http
GET /api/v1/vendors/me
```

Expected:

```text
May fail with Forbidden because old token has only CUSTOMER role.
```

This is expected.

App must save `NEW_ACCESS_TOKEN` from `become-vendor` response.

---

# Flow B — New Vendor signup should get both roles

## Step 1 — Register as Vendor

API:

```http
POST /api/v1/auth/register/vendor
```

Body:

```json
{
  "email": "new.vendor.both@example.com",
  "phone": "+12025550192",
  "password": "Password123!",
  "dateOfBirth": "1994-08-12",
  "businessName": "Both Role Burger Truck",
  "businessEmail": "new.vendor.both@example.com",
  "businessPhone": "+12025550192",
  "description": "Burger food truck",
  "websiteUrl": "https://bothroleburger.example.com",
  "firstName": "Taylor",
  "lastName": "Vendor",
  "displayName": "Taylor Vendor",
  "timezone": "America/New_York"
}
```

Expected:

```json
{
  "success": true,
  "status": "PENDING",
  "message": "Registration successful. Verify the 6-digit code sent to your email.",
  "email": "new.vendor.both@example.com"
}
```

## Step 2 — Verify Vendor email

API:

```http
POST /api/v1/auth/verify-email
```

Body:

```json
{
  "email": "new.vendor.both@example.com",
  "code": "123456"
}
```

Expected:

```json
{
  "accessToken": "VENDOR_ACCESS_TOKEN",
  "refreshToken": "VENDOR_REFRESH_TOKEN",
  "user": {
    "email": "new.vendor.both@example.com",
    "roles": ["CUSTOMER", "VENDOR"],
    "vendor": {
      "id": "vendor-id",
      "businessName": "Both Role Burger Truck"
    }
  }
}
```

## Step 3 — Vendor can access Vendor route

API:

```http
GET /api/v1/vendors/me
```

Headers:

```text
Authorization: Bearer VENDOR_ACCESS_TOKEN
```

Expected:

```text
Vendor profile returns successfully.
```

## Step 4 — Vendor can still use Foodie/customer features

Use same token on any normal customer/foodie route.

Example:

```http
GET /api/v1/users/me
```

Headers:

```text
Authorization: Bearer VENDOR_ACCESS_TOKEN
```

Expected:

```text
User profile returns successfully with roles CUSTOMER + VENDOR.
```

---

# Flow C — Existing Foodie email tries Vendor password registration

This should not silently attach vendor role.

Reason:

Unauthenticated password registration cannot prove the user owns that existing email.

## Step 1 — Try register vendor with existing Foodie email

API:

```http
POST /api/v1/auth/register/vendor
```

Body:

```json
{
  "email": "alex.foodie.vendor@example.com",
  "phone": "+12025550193",
  "password": "Password123!",
  "businessName": "Should Not Auto Attach"
}
```

Expected:

```json
{
  "statusCode": 409,
  "message": "An account already exists with this email. Please login and continue vendor onboarding from your account.",
  "error": "Conflict"
}
```

Then app should:

```text
Login user
Call POST /api/v1/auth/me/become-vendor
```

---

# Flow D — Existing Vendor old account should get CUSTOMER role on login/refresh

Use an old vendor account that previously had only:

```json
["VENDOR"]
```

## Step 1 — Login old vendor

API:

```http
POST /api/v1/auth/login
```

Body:

```json
{
  "email": "old.vendor@example.com",
  "password": "Password123!"
}
```

Expected:

```json
{
  "user": {
    "roles": ["VENDOR", "CUSTOMER"]
  }
}
```

Order may be different. Important is both roles exist.

---

# Flow E — Firebase existing Foodie requests Vendor role

Use Flutter/Firebase token.

API:

```http
POST /api/v1/auth/firebase
```

Body:

```json
{
  "idToken": "FIREBASE_ID_TOKEN",
  "role": "VENDOR",
  "businessName": "Firebase Taco Vendor"
}
```

Expected if user already exists as Foodie:

```json
{
  "authFlow": "LOGIN",
  "isNewUser": false,
  "user": {
    "roles": ["CUSTOMER", "VENDOR"],
    "vendor": {
      "id": "vendor-id",
      "businessName": "Firebase Taco Vendor"
    }
  },
  "onboarding": {
    "requiresVendorOnboarding": true,
    "nextStep": "VENDOR_ONBOARDING"
  }
}
```

---

# Quick curl examples

## Become Vendor

```bash
curl -X POST "$BASE_URL/api/v1/auth/me/become-vendor" \
  -H "accept: application/json" \
  -H "Authorization: Bearer CUSTOMER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Alex Taco Truck",
    "businessEmail": "alex.foodie.vendor@example.com",
    "businessPhone": "+12025550191",
    "description": "Mexican street food truck",
    "websiteUrl": "https://alextacotruck.example.com"
  }'
```

## Get Vendor Profile

```bash
curl -X GET "$BASE_URL/api/v1/vendors/me" \
  -H "accept: application/json" \
  -H "Authorization: Bearer NEW_ACCESS_TOKEN"
```

## Expected pass/fail summary

| Test                                               | Expected                                         |
| -------------------------------------------------- | ------------------------------------------------ |
| New Foodie signup                                  | roles = CUSTOMER                                 |
| Foodie calls become-vendor                         | roles = CUSTOMER + VENDOR                        |
| New Vendor signup                                  | roles = CUSTOMER + VENDOR                        |
| Existing Foodie email tries vendor password signup | 409 conflict, login first message                |
| Old Vendor login                                   | roles include CUSTOMER + VENDOR                  |
| Old customer token after role update               | May fail vendor route until app stores new token |
| New token from become-vendor                       | Vendor routes work                               |

## Important notes for Flutter

- App must update stored auth tokens after `POST /api/v1/auth/me/become-vendor`.
- Mode switch should be based on `user.roles`.
- If roles contains both:

```json
["CUSTOMER", "VENDOR"]
```

Then show:

```text
Foodie Mode
Vendor Mode
```
