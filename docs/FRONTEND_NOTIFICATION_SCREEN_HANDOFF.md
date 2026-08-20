# Frontend Notification Screen Integration Guide

Use this guide to connect the **Notifications UI Screen** (Mobile Flutter / React Native / Web) directly to the backend NestJS Notification APIs and Firebase FCM Push Notifications.

---

## 1. UI Component to Backend API Mapping

Based on the Notifications UI design:

```text
+-------------------------------------------------------------+
| Notifications                    [✓ Mark all read]          |
| (4 unread) -> GET /api/v1/notifications/unread-count        |
|                                                              |
| [ All (06) ]              [ Unread (02) ]                    |
| GET /api/v1/notifications  GET /api/v1/notifications?unreadOnly=true
+-------------------------------------------------------------+
| 📍 Taco Paradise is nearby                                   |
|    0.3 miles away at Union Square. Open until 9 PM!          |
|    5 min ago                                                |
|                                                             |
| 🎁 Special Offer: 20% OFF                                   |
|    Burger Bliss is offering 20% off all burgers...           |
|    15 min ago                                               |
|                                                             |
| 🩵 Seoul Street just posted                                 |
|    Check out their new Korean Fried Chicken Sandwich!        |
|    1 hour ago                                               |
+-------------------------------------------------------------+
```

---

## 2. API Endpoints Specification

### 2.1 Fetch Notifications List
Fetch list of notifications for the active user (paginated).

```http
GET /api/v1/notifications?unreadOnly=false&limit=20&offset=0
Authorization: Bearer {{accessToken}}
```

**Query Parameters:**
- `unreadOnly` *(optional, boolean)*: Set to `true` when user clicks **"Unread"** tab.
- `limit` *(optional, number)*: Items per page (default: `20`, max: `50`).
- `offset` *(optional, number)*: Pagination offset (default: `0`).

**Response Example:**
```json
[
  {
    "id": "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "userId": "3545216f-0fee-49d2-bef2-f49dc3d20d44",
    "type": "NEARBY_DROP",
    "title": "Taco Paradise is nearby",
    "message": "0.3 miles away at Union Square. Open until 9 PM!",
    "isRead": false,
    "createdAt": "2026-08-20T11:45:00.000Z",
    "data": {
      "foodTruckId": "25c93048-f875-4019-a0bd-40801ad45755",
      "slug": "taco-paradise"
    }
  },
  {
    "id": "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
    "type": "PROMOTION",
    "title": "Special Offer: 20% OFF",
    "message": "Burger Bliss is offering 20% off all burgers for the next 2 hours!",
    "isRead": false,
    "createdAt": "2026-08-20T11:35:00.000Z",
    "data": {
      "foodTruckId": "25c93048-f875-4019-a0bd-40801ad45755",
      "promotionId": "prom_123"
    }
  }
]
```

---

### 2.2 Fetch Unread Counter Badge
Fetch real-time unread count for top header badge (`Notifications 4 unread`).

```http
GET /api/v1/notifications/unread-count
Authorization: Bearer {{accessToken}}
```

**Response Example:**
```json
{
  "unreadCount": 4
}
```

---

### 2.3 Mark Single Notification as Read
Triggered when user taps on an individual notification card.

```http
PATCH /api/v1/notifications/{{notificationId}}/read
Authorization: Bearer {{accessToken}}
```

**Response Example:**
```json
{
  "id": "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  "isRead": true
}
```

---

### 2.4 Mark All Notifications as Read
Triggered when user clicks top-right **"✓ Mark all read"** button.

```http
PATCH /api/v1/notifications/read-all
Authorization: Bearer {{accessToken}}
```

**Response Example:**
```json
{
  "updatedCount": 4
}
```

---

## 3. Firebase Push Notification (FCM) Integration Flow

### Step 1: Device Token Registration (App Launch / Login)
When user logs in or opens the mobile app, register the FCM device token with backend:

```http
POST /api/v1/users/me/device-tokens
Authorization: Bearer {{accessToken}}
Content-Type: application/json

{
  "token": "fcm_device_token_string_from_firebase_sdk",
  "platform": "IOS",
  "deviceName": "John's iPhone 14"
}
```

### Step 2: Push Notification Payload Received on Phone
When backend triggers a push notification via Firebase Admin SDK, FCM delivers this payload to the mobile device:

```json
{
  "notification": {
    "title": "Taco Paradise is nearby",
    "body": "0.3 miles away at Union Square. Open until 9 PM!"
  },
  "data": {
    "notificationId": "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "type": "NEARBY_DROP",
    "foodTruckId": "25c93048-f875-4019-a0bd-40801ad45755"
  }
}
```

### Step 3: Handling Deep Linking on Push Tap
In Flutter / React Native, listen to `FirebaseMessaging.onNotificationOpenedApp`:

```javascript
FirebaseMessaging.onNotificationOpenedApp.listen((RemoteMessage message) {
  final type = message.data['type'];
  final foodTruckId = message.data['foodTruckId'];

  if (type == 'NEARBY_DROP' || type == 'TRUCK_POST') {
    Navigator.pushNamed(context, '/food-truck-profile', arguments: foodTruckId);
  } else if (type == 'BOOKING_CONFIRMED') {
    Navigator.pushNamed(context, '/booking-details', arguments: message.data['bookingId']);
  }
});
```

---

## 4. Icon & Color Palette Mapping

| Notification Type (`type`) | Icon Symbol | Icon Background Color | Tap Deep Link Action |
| :--- | :--- | :--- | :--- |
| `NEARBY_DROP` | 📍 Map Pin | Dark Red / Orange | Open Food Truck Profile / Live Map |
| `PROMOTION` | 🎁 Gift Box | Gold / Amber | Open Special Offer / Truck Deals |
| `TRUCK_POST` | 🩵 Heart / Social | Cyan / Teal | Open Food Truck Feed / Social Post |
| `BOOKING_CONFIRMED` | 📅 Calendar | Orange / Brown | Open Booking Details Screen |
| `POINTS_EARNED` | 🎁 Gift / Coins | Gold / Amber | Open Customer Loyalty Points Screen |
| `TRENDING_TRUCK` | 📈 Growth Arrow | Deep Teal | Open Trending Food Trucks Leaderboard |
