# QR Check-In & Credit Redemption API Testing Flow

Use this guide to test the end-to-end **Smart QR Check-In** and **Credit Redemption** APIs for both Customer and Vendor/Food Truck mobile applications.

## Table of Contents
1. [Overview & Prerequisites](#overview--prerequisites)
2. [Vendor QR Display & Retrieval](#1-vendor-qr-display--retrieval)
3. [Customer Smart QR Check-In](#2-customer-smart-qr-check-in)
4. [Customer Credit Redemption Request (6-Digit Backup Code)](#3-customer-credit-redemption-request-6-digit-backup-code)
5. [Vendor Redemption Confirmation (QR & 6-Digit Code)](#4-vendor-redemption-confirmation-qr--6-digit-code)
6. [Testing Matrix & Expected States](#5-testing-matrix--expected-states)

---

## Overview & Prerequisites

### Base URL
```text
http://localhost:3000
```

### Swagger Documentation
```text
GET /api/v1/docs
```

### Environment / Auth Tokens Needed
- `{{customerToken}}` — Customer user JWT token.
- `{{vendorToken}}` — Vendor user JWT token.
- `{{qrCode}}` — Active food truck QR code string (e.g. seeded code from database or `GET /api/v1/vendors/me/qr-code`).

---

## 1. Vendor QR Display & Retrieval

### 1.1 Get My Vendor BiteDrop QR Code (Vendor)
Retrieves the vendor's BiteDrop QR code payload, image URL, and sharing details for the "Show My QR Code" modal in the vendor dashboard.

```http
GET /api/v1/vendors/me/qr-code
Authorization: Bearer {{vendorToken}}
```

**Response Example:**
```json
{
  "vendorId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3d0001",
  "businessName": "Demo Gourmet Bites",
  "foodTruckId": "11111111-1111-1111-1111-111111111111",
  "qrCode": "QR_TRUCK_BURGER_BLISS",
  "qrCodeUrl": "/api/v1/qr/QR_TRUCK_BURGER_BLISS/profile",
  "downloadUrl": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400",
  "shareMessage": "Scan our BiteDrop QR code at Demo Gourmet Bites to check in and earn rewards!"
}
```

---

## 2. Customer Smart QR Check-In

### 2.1 Customer Scans QR Code & Checks In
Scans the food truck's QR code. The API evaluates customer status and returns an explicit `experienceState` payload (`NEW_USER`, `HAS_POINTS_NO_CREDIT`, `HAS_CREDIT_AVAILABLE`, `ALREADY_CHECKED_IN_TODAY`).

```http
POST /api/v1/qr/{{qrCode}}/check-ins
Authorization: Bearer {{customerToken}}
Content-Type: application/json

{
  "latitude": 30.2672,
  "longitude": -97.7431,
  "locationAccuracyMeters": 10
}
```

**Response Example (`NEW_USER` / `HAS_POINTS_NO_CREDIT`):**
```json
{
  "checkIn": {
    "id": "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a77",
    "foodTruckId": "11111111-1111-1111-1111-111111111111",
    "status": "VERIFIED"
  },
  "experienceState": "NEW_USER",
  "availableCreditAmount": 0,
  "pointsEarned": 10,
  "currentPoints": 10,
  "tierName": "Drop Hunter",
  "nextTierPoints": 2500,
  "message": "Check-in complete! Earned +10 points."
}
```

**Response Example (`HAS_CREDIT_AVAILABLE` when user has 500+ points / $5+ credit):**
```json
{
  "checkIn": {
    "id": "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a77",
    "status": "VERIFIED"
  },
  "experienceState": "HAS_CREDIT_AVAILABLE",
  "availableCreditAmount": 10.00,
  "pointsEarned": 10,
  "currentPoints": 1000,
  "tierName": "Drop Hunter",
  "nextTierPoints": 2500,
  "message": "Check-in complete! Earned +10 points."
}
```

**Response Example (`ALREADY_CHECKED_IN_TODAY`):**
```json
{
  "checkIn": {
    "id": "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a77",
    "status": "DUPLICATE"
  },
  "experienceState": "ALREADY_CHECKED_IN_TODAY",
  "availableCreditAmount": 10.00,
  "pointsEarned": 0,
  "currentPoints": 1000,
  "tierName": "Drop Hunter",
  "nextTierPoints": 2500,
  "message": "Already checked in today."
}
```

---

## 3. Customer Credit Redemption Request (6-Digit Backup Code)

### 3.1 Request Credit Redemption (Customer)
Generates a 15-minute `redemptionToken` and random **6-digit backup code** (e.g. `847291`) for staff to scan or manually enter.

```http
POST /api/v1/rewards/me/redemption-codes
Authorization: Bearer {{customerToken}}
Content-Type: application/json

{
  "amount": 5,
  "foodTruckId": "11111111-1111-1111-1111-111111111111"
}
```

**Response Example:**
```json
{
  "redemptionId": "r1eebc99-9c0b-4ef8-bb6d-6bb9bd380a99",
  "redemptionToken": "rdm_847291_l5z9x1y2",
  "backupCode": "847291",
  "amount": 5,
  "pointsSpent": 500,
  "expiresAt": "2026-08-19T09:45:00.000Z",
  "status": "PENDING",
  "message": "Show this screen to staff or provide 6-digit backup code: 847291"
}
```

---

## 4. Vendor Redemption Confirmation (QR & 6-Digit Code)

### 4.1 Confirm Redemption via 6-Digit Backup Code (Vendor Option A)
Staff enters the 6-digit code shown on the customer's phone.

```http
POST /api/v1/vendors/me/redemptions/confirm
Authorization: Bearer {{vendorToken}}
Content-Type: application/json

{
  "manualCode": "847291"
}
```

### 4.2 Confirm Redemption via Scanned QR Token (Vendor Option B)
Staff scans the redemption QR code from the customer's phone.

```http
POST /api/v1/vendors/me/redemptions/confirm
Authorization: Bearer {{vendorToken}}
Content-Type: application/json

{
  "redemptionToken": "rdm_847291_l5z9x1y2"
}
```

**Response Example (Redemption Complete):**
```json
{
  "success": true,
  "amountApplied": 5.00,
  "customerName": "Demo Customer",
  "remainingCustomerBalance": 5.00,
  "message": "Redemption Complete. $5.00 credit applied for Demo Customer."
}
```

---

## 5. Testing Matrix & Expected States

| Test Case | API | Inputs / Token | Expected Outcome |
| :--- | :--- | :--- | :--- |
| **Vendor QR View** | `GET /api/v1/vendors/me/qr-code` | `vendorToken` | Returns QR string, image URL, and share message. |
| **New Customer Check-In** | `POST /api/v1/qr/:code/check-ins` | `customerToken` | `experienceState = NEW_USER`, +10 points awarded. |
| **Check-In Duplicate Today** | `POST /api/v1/qr/:code/check-ins` | `customerToken` (same day) | `experienceState = ALREADY_CHECKED_IN_TODAY`, 0 points earned. |
| **Check-In With Credit** | `POST /api/v1/qr/:code/check-ins` | `customerToken` (500+ pts) | `experienceState = HAS_CREDIT_AVAILABLE`, `availableCreditAmount = 5.00`. |
| **Generate 6-Digit Code** | `POST /api/v1/rewards/me/redemption-codes` | `customerToken`, `amount: 5` | Returns 6-digit `backupCode` & `redemptionToken` valid for 15 mins. |
| **Vendor Confirm 6-Digit** | `POST /api/v1/vendors/me/redemptions/confirm` | `vendorToken`, `manualCode: "847291"` | `success = true`, `amountApplied = 5.00`, status updated to `COMPLETED`. |
| **Expired / Invalid Code** | `POST /api/v1/vendors/me/redemptions/confirm` | `vendorToken`, invalid code | Returns `404 Not Found` with message *"Invalid or expired redemption code"*. |
