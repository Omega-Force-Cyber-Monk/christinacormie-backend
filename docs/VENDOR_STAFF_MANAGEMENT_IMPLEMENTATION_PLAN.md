# Vendor Staff Management — Implementation Plan

This document is the working plan for the vendor staff role flow. We will update this step by step before final implementation.

## Goal

Vendor can create staff accounts using staff email. Backend will automatically create the staff account, generate a PIN, email the PIN to the staff member, and allow staff login with email + PIN. Vendor can reset staff PIN and delete staff.

## UI Flow From Figma

### Vendor Staff Management Screen

Vendor can:

- View staff list.
- Add staff by email.
- See staff email and added date.
- See staff PIN/reset option.
- Reset staff PIN.
- Delete staff.

### Staff Login

Staff can login with:

- Email
- PIN

Staff will receive limited vendor-side access only.

### Staff App Screens

Staff can access only these screens from the Figma flow:

- Staff login
- Staff home
- Today’s bookings
- Booking details / my orders detail
- Vendor QR code screen
- Show vendor QR code
- Scan customer QR code
- Manual customer code redemption
- Redemption complete screen

Staff should not access full vendor owner screens such as vendor profile editing, verification, payment settings, staff management, or business setup.

## Proposed API Flow

### 1. Add Staff

```http
POST /api/v1/vendors/me/staff
```

Purpose:

- Vendor adds a staff member by email.
- Backend creates staff account automatically if needed.
- Vendor manually sets a 4-digit PIN.
- Backend securely stores PIN for login and vendor list display.
- Backend sends PIN to staff email.

Request body:

```json
{
  "email": "maria@example.com",
  "pin": "1504"
}
```

Success response example:

```json
{
  "id": "staff-id",
  "email": "maria@example.com",
  "pin": "1504",
  "status": "ACTIVE",
  "addedAt": "2026-09-14T09:00:00.000Z",
  "message": "Staff account created and PIN sent to email"
}
```

### 2. Staff List

```http
GET /api/v1/vendors/me/staff
```

Purpose:

- Vendor sees all staff under their vendor account.

Success response example:

```json
{
  "items": [
    {
      "id": "staff-id",
      "email": "maria@example.com",
      "pin": "1504",
      "status": "ACTIVE",
      "addedAt": "2026-09-14T09:00:00.000Z"
    }
  ]
}
```

Important note:

- Vendor can see the staff PIN on the list as required by the Figma UI.
- Because vendor must see PIN later, hash-only storage is not enough. We need secure reversible storage/encryption or another agreed display strategy.

### 3. Staff Login

```http
POST /api/v1/auth/staff/login
```

Purpose:

- Staff logs in using email + PIN.
- Backend returns JWT tokens.

Request body:

```json
{
  "email": "maria@example.com",
  "pin": "1504"
}
```

Success response example:

```json
{
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "user": {
    "id": "staff-user-id",
    "email": "maria@example.com",
    "roles": ["VENDOR_STAFF"],
    "staff": {
      "vendorId": "vendor-id",
      "staffId": "staff-id"
    }
  }
}
```

### 4. Reset Staff PIN

```http
POST /api/v1/vendors/me/staff/:staffId/reset-pin
```

Purpose:

- Vendor resets staff PIN.
- Vendor manually enters a new 4-digit PIN.
- Backend sends the new PIN to staff email.

Request body:

```json
{
  "pin": "5678"
}
```

Success response example:

```json
{
  "message": "Staff PIN reset successfully and sent to email"
}
```


### 5. Delete Staff

```http
DELETE /api/v1/vendors/me/staff/:staffId
```

Purpose:

- Vendor deletes/removes staff.
- Staff immediately loses login/access.

Success response example:

```json
{
  "deleted": true,
  "message": "Staff member deleted successfully"
}
```

## Database Plan

### User Role

Add new role:

```prisma
VENDOR_STAFF
```

Reason:

- Staff is not a normal customer.
- Staff is not vendor owner.
- Staff should have limited access.

### New Model: VendorStaff

Draft:

```prisma
model VendorStaff {
  id        String   @id @default(uuid()) @db.Uuid
  vendorId  String   @map("vendor_id") @db.Uuid
  userId    String   @unique @map("user_id") @db.Uuid
  email     String   @db.VarChar(255)
  pinHash      String @map("pin_hash") @db.VarChar(255)
  pinEncrypted String @map("pin_encrypted")
  status    StaffStatus @default(ACTIVE)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime @default(now()) @map("updated_at") @db.Timestamptz(6)
  deletedAt DateTime? @map("deleted_at") @db.Timestamptz(6)

  vendor Vendor @relation(fields: [vendorId], references: [id])
  user   User   @relation(fields: [userId], references: [id])

  @@unique([vendorId, email])
  @@map("vendor_staff")
}
```

Draft enum:

```prisma
enum StaffStatus {
  ACTIVE
  DISABLED
}
```

## Access Plan

Staff should have limited access only.

Decision:

- Use existing vendor APIs where the feature already exists.
- Do not create duplicate staff-only APIs for the same behavior.
- Add staff-aware role/guard/vendor-scope checks so `VENDOR_STAFF` can access only approved routes for their assigned vendor.
- Create new APIs only for staff management and staff login.

### Allowed Staff Access

- Staff login
- Staff home summary for assigned vendor
- View today’s bookings for assigned vendor
- View booking/order details for assigned vendor
- View assigned vendor QR code
- Show/download/share vendor QR code if already supported by vendor QR response
- Scan customer QR for credit redemption
- Enter manual customer backup code for credit redemption
- Confirm redemption

### Existing Vendor APIs That Staff Can Reuse

These APIs already exist for vendor. During implementation we should allow `VENDOR_STAFF` on these specific routes only, scoped to the staff member’s assigned vendor.

| Staff screen/action | Existing API candidate | Access type |
|---|---|---|
| Staff home vendor info | `GET /api/v1/vendors/me` | Read only |
| Vendor QR code screen | `GET /api/v1/vendors/me/qr-code` | Read only |
| Today’s bookings | `GET /api/v1/bookings/vendor/mine` | Read only |
| Booking/order details | `GET /api/v1/bookings/:bookingId` | Read only, assigned vendor only |
| Scan customer QR/manual redemption | `POST /api/v1/vendors/me/redemptions/confirm` | Action allowed |
| QR analytics | `GET /api/v1/check-ins/food-trucks/:foodTruckId/qr-analytics` | Optional/read only if needed |

### APIs Staff Must Not Access

- `PATCH /api/v1/vendors/me`
- `POST /api/v1/vendors/me/onboarding`
- `POST /api/v1/vendors/me/onboarding/upload`
- `POST /api/v1/vendors/me/verification-requests`
- `POST /api/v1/vendors/me/verification-requests/upload`
- `GET /api/v1/vendors/me/analytics`, unless we explicitly decide staff can see analytics later
- Staff management APIs
- Payment settings / payout APIs
- Vendor profile ownership update
- Vendor verification submission
- Delete vendor account
- Admin APIs

### Booking Permissions Decision

Final decision: staff can only view booking list and booking details exactly like the staff UI.

Allowed for staff:

- `GET /api/v1/bookings/vendor/mine`
- `GET /api/v1/bookings/:bookingId`

Blocked for staff:

- `PATCH /api/v1/bookings/:bookingId/accept`
- `PATCH /api/v1/bookings/:bookingId/reject`
- `POST /api/v1/bookings/:bookingId/quotes`

Reason:

- Figma staff flow shows bookings and order detail, not quote/decision management.
- Owner-level financial or booking decision actions should stay vendor-owner-only unless approved.

## Error Handling Plan

Add clear API errors:

| Case | Status | Message |
|---|---:|---|
| Email missing/invalid | `400` | `Staff email must be a valid email address` |
| Vendor profile missing | `403` or `404` | `Vendor profile is required` |
| Vendor not approved/verified | `403` | `Vendor must be approved before managing staff` |
| Staff already exists | `409` | `Staff member already exists for this vendor` |
| Staff not found | `404` | `Staff member not found` |
| Invalid staff PIN | `401` | `Invalid email or PIN` |
| Deleted staff tries login | `401` | `Staff account is inactive or deleted` |

## Email Plan

### Add Staff Email

Subject:

```txt
Your BiteDrop staff PIN
```

Body:

```txt
You have been added as staff for {vendorBusinessName}.
Your login PIN is {pin}.
```

### Reset PIN Email

Subject:

```txt
Your BiteDrop staff PIN was reset
```

Body:

```txt
Your new staff login PIN is {pin}.
```

## Security Notes

- PIN length: 4 digits.
- Vendor manually sets PIN.
- Vendor can see staff PIN on staff list.
- Store PIN hash for login verification.
- Because vendor can see PIN later, we also need secure reversible storage/encryption for display. Do not store plain text PIN.
- Consider rate limiting staff login later.
- Reset PIN should revoke old PIN immediately.

## Open Questions Before Implementation

1. If staff email already belongs to a vendor-owner account, should we block it? Current draft allows attaching staff access to existing users.
2. Confirm PIN display storage strategy: encrypted PIN display value + hash for login.

## Current Decision Draft

- Role name: `VENDOR_STAFF`
- PIN login: `email + PIN`
- PIN length: 4 digits
- Vendor manually sets PIN
- Vendor can see staff PIN on list
- Add staff: backend auto-creates account
- PIN storage: hash for login + secure encrypted display value for vendor list
- PIN delivery: email
- Delete staff: hard delete staff link and disable staff login
- Vendor owner only can manage staff
- Existing email behavior: attach staff access to existing user unless final rule says otherwise
- Staff booking access: list + details only, no accept/reject/quote
