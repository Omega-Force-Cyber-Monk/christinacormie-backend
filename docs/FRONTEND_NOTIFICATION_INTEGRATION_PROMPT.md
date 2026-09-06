# BiteDrop Frontend Notification Integration Prompt

Project: BiteDrop

Goal: Integrate Firebase push notifications for both Flutter app and web app against an existing NestJS backend.

## Important Context

- Backend already supports:
  - in-app notifications in DB
  - notification list/read APIs
  - device token registration API
  - Firebase Admin push sending
- We need client-side implementation only
- Keep implementation practical and production-sensible
- Do not overengineer
- Web and Flutter should both use the same backend token registration flow

## Backend APIs Expected

```text
POST /api/v1/users/me/device-tokens
DELETE /api/v1/users/me/device-tokens/:id
GET /api/v1/notifications
GET /api/v1/notifications/unread-count
PATCH /api/v1/notifications/:id/read
PATCH /api/v1/notifications/read-all
```

Device token payload:

```json
{
  "token": "fcm-token",
  "platform": "ANDROID",
  "deviceId": "optional-device-id"
}
```

## 1. Flutter Notification Integration

Implement Firebase Messaging integration in Flutter app.

Requirements:

- initialize Firebase
- request notification permission
- get FCM token
- send token to backend after login
- refresh token handling
- foreground message handling
- background message handling
- notification tap handling
- open correct screen based on notification metadata
- unregister or deactivate token on logout if app supports it

Expected behavior:

- after login, app registers current FCM token with backend
- if token changes, app updates backend
- on push receive, app shows local handling if needed
- app notification center uses backend notification APIs as source of truth

## 2. Flutter Architecture Expectations

Keep it clean:

- one notification service
- one API service method for device token registration
- one notification model matching backend response
- optional notification state provider/bloc/controller based on existing app architecture

Need:

- notification model
- token registration logic
- unread count fetch
- notification list fetch
- mark one read
- mark all read

## 3. Flutter Deep Linking Behavior

Use notification metadata from backend to navigate.

Examples:

- booking notification -> open booking detail
- payment notification -> open payment/booking detail
- post notification -> open truck post or truck profile
- reward notification -> open rewards screen
- check-in notification -> open check-in/reward related screen

If exact destination screen is not available, route to the nearest logical screen.

## 4. Web Notification Integration

Implement Firebase Cloud Messaging for web app.

Requirements:

- initialize Firebase web SDK
- request browser notification permission
- get FCM web token using VAPID key
- register token with backend
- support foreground messages
- support background messages with service worker
- handle notification click behavior
- fetch notification list from backend for in-app notification center

Important:

- web push requires HTTPS
- service worker is required
- use `firebase-messaging-sw.js`
- handle permission denied gracefully

## 5. Web Architecture Expectations

Need:

- firebase messaging setup
- service worker setup
- token registration to backend
- notification dropdown/page using backend APIs
- unread badge count using backend unread-count API

## 6. Shared Behavior Across Flutter And Web

For both clients:

- backend DB notifications are the source of truth
- push is only instant delivery
- notification list UI should come from backend API
- unread badge should come from backend API
- mark-read actions should update backend

## 7. Device Token Lifecycle

Implement these lifecycle rules:

- login -> register token
- token refresh -> update token in backend
- logout -> remove/deactivate token in backend
- if notification permission denied, app/web should still work with in-app notifications only

## 8. Error Handling

Do not break app flow if:

- permission denied
- token not available
- push setup fails
- service worker registration fails on unsupported browser

In those cases:

- continue with in-app notifications from backend APIs

## 9. Deliverables

Provide:

- files added/updated
- how token registration works
- how foreground/background messages are handled
- what environment/config values are needed
- any browser/platform limitations

## 10. Keep Implementation Practical

Do not:

- add unnecessary abstraction layers
- build a full custom local notification engine unless needed
- overcomplicate routing
- add unsupported browser hacks

Do:

- keep setup minimal
- follow existing frontend project structure
- use Firebase recommended approach
- make sure backend integration is correct

If needed, you may assume:

- authenticated API client already exists
- app/web has a current user session concept
- routing/navigation system already exists
