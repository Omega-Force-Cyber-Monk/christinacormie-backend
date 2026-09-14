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
- Backend generates a PIN.
- Backend hashes/stores PIN.
- Backend sends PIN to staff email.

Request body:

```json
{
  "email": "maria@example.com"
}
```

Success response example:

```json
{
  "id": "staff-id",
  "email": "maria@example.com",
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
      "status": "ACTIVE",
      "addedAt": "2026-09-14T09:00:00.000Z"
    }
  ]
}
```

Important note:

- PIN should not be returned in production response.
- If UI still needs to show PIN like Figma, we need to decide whether this is only for demo/dev mode or if PIN should be hidden for security.

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
- Backend generates a new PIN.
- Backend sends the new PIN to staff email.

Success response example:

```json
{
  "message": "Staff PIN reset successfully and sent to email"
}
```

Open question:

- Should vendor manually input a new PIN from UI, or should backend auto-generate it?
- Current safest recommendation: backend auto-generates PIN and emails it.

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
  pinHash   String   @map("pin_hash") @db.VarChar(255)
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

Staff can view bookings/orders, but staff should not accept/reject/send quote unless we explicitly allow it later.

Blocked for staff by default:

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

- Store PIN as hash, never plain text.
- Avoid returning PIN from API response in production.
- Consider PIN length: Figma shows 4 digits, but 6 digits is safer.
- Consider rate limiting staff login later.
- Reset PIN should revoke old PIN immediately.

## Open Questions Before Implementation

1. Should PIN be 4 digits like Figma, or 6 digits for better security?
2. Should vendor see staff PIN on the list, or should PIN only be sent by email?
3. Should reset PIN be auto-generate or vendor manually enters new PIN?
4. Should staff be allowed to accept/reject bookings or only view them?
5. If staff email already belongs to a customer/vendor account, should we block it or attach staff role to same user?

## Current Decision Draft

- Role name: `VENDOR_STAFF`
- PIN login: `email + PIN`
- Add staff: backend auto-creates account
- PIN storage: hashed
- PIN delivery: email
- Delete staff: hard delete staff link and disable staff login
- Vendor owner only can manage staff
