# Messaging Backend API and Realtime Handoff

This document explains what is implemented in the backend for messaging, realtime Socket.IO, and push notifications.

This is a backend handoff only. Flutter-specific coding choices should be handled by the Flutter developer.

---

## Current backend status

Messaging backend is implemented with:

- REST APIs for conversation list, conversation details, messages, and read state.
- Socket.IO realtime namespace for active chat screens.
- PostgreSQL/Prisma persistence for conversations, participants, and messages.
- Notification records for message recipients.
- Firebase push delivery through registered device tokens.
- User notification preference support through `messageAlerts`.

Main backend files:

```txt
src/modules/messaging/messaging.controller.ts
src/modules/messaging/messaging.service.ts
src/modules/messaging/messaging.gateway.ts
src/modules/messaging/messaging-realtime.service.ts
src/modules/notifications/notifications.service.ts
src/modules/notifications/notifications.repository.ts
src/modules/users/users.controller.ts
src/infrastructure/firebase/firebase.service.ts
prisma/schema/21-messaging.prisma
prisma/schema/22-notifications.prisma
```

---

## Messaging data model

### Conversation

Stored in `conversations`.

Important fields:

```txt
id
type
createdById
bookingId
communityRequestId
title
lastMessageAt
isClosed
createdAt
```

Supported enum values:

```txt
DIRECT
BOOKING
COMMUNITY_REQUEST
SUPPORT
```

Current normal chat API creates `DIRECT` conversations.

### ConversationParticipant

Stored in `conversation_participants`.

Important fields:

```txt
id
conversationId
userId
lastReadAt
isMuted
```

Purpose:

- controls who can access a conversation;
- stores unread/read state;
- stores muted state for push notification filtering.

Unique rule:

```txt
conversationId + userId
```

### Message

Stored in `messages`.

Important fields:

```txt
id
conversationId
senderId
messageType
content
attachmentUrl
vendorOfferId
createdAt
editedAt
deletedAt
```

Supported enum values:

```txt
TEXT
IMAGE
FILE
SYSTEM
OFFER
```

Public send API currently accepts:

```txt
TEXT
IMAGE
FILE
```

`SYSTEM` is backend-only.

---

## Authentication and authorization

All REST messaging APIs require JWT auth:

```http
Authorization: Bearer <accessToken>
```

All Socket.IO connections require the same JWT token.

Backend checks:

- user must be authenticated;
- user must be an active conversation participant;
- suspended/deactivated/blocked accounts cannot start chats;
- a user cannot start a direct conversation with themself;
- users can only read/send messages in conversations where they are participants.

Unauthorized conversation access returns:

```json
{
  "statusCode": 403,
  "message": "Conversation is not visible to this user",
  "error": "Forbidden"
}
```

---

## REST API list

Base path:

```txt
/api/v1/messaging
```

### 1. List my conversations

```http
GET /api/v1/messaging/conversations?limit=20&offset=0
```

Purpose:

- chat list screen for customer/vendor;
- returns only conversations where current user is a participant.

Response:

```json
{
  "message": "Conversations retrieved successfully",
  "items": [
    {
      "id": "conversation-uuid",
      "type": "DIRECT",
      "title": "Question about Taco Paradise",
      "isClosed": false,
      "createdAt": "2026-09-13T10:00:00.000Z",
      "lastMessageAt": "2026-09-13T10:02:00.000Z",
      "unreadCount": 1,
      "messageCount": 3,
      "otherParticipant": {
        "id": "participant-uuid",
        "userId": "vendor-user-uuid",
        "lastReadAt": null,
        "isMuted": false,
        "user": {
          "id": "vendor-user-uuid",
          "email": "vendor@example.com",
          "displayName": "Taco Paradise",
          "avatarUrl": "https://...",
          "vendor": {
            "id": "vendor-uuid",
            "businessName": "Taco Paradise",
            "logoUrl": "https://..."
          }
        }
      },
      "participants": [],
      "lastMessage": {
        "id": "message-uuid",
        "conversationId": "conversation-uuid",
        "senderId": "customer-user-uuid",
        "messageType": "TEXT",
        "content": "Hi, are you available?",
        "attachmentUrl": null,
        "createdAt": "2026-09-13T10:02:00.000Z",
        "editedAt": null
      }
    }
  ],
  "total": 1,
  "nextOffset": null
}
```

Pagination:

```txt
limit default: 20
limit max: 50
offset default: 0
nextOffset null means no next page
```

---

### 2. Start or reuse direct conversation

```http
POST /api/v1/messaging/conversations/direct
```

Purpose:

- start chat from food truck profile;
- start chat with vendor;
- start chat with known user ID;
- if conversation already exists, backend returns the existing conversation.

Body rule:

Send exactly one of:

```txt
participantUserId
vendorId
foodTruckId
```

Recommended body from food truck profile:

```json
{
  "foodTruckId": "food-truck-uuid",
  "title": "Question about Taco Paradise"
}
```

Body using vendor ID:

```json
{
  "vendorId": "vendor-uuid",
  "title": "Question about Taco Paradise"
}
```

Body using user ID:

```json
{
  "participantUserId": "user-uuid"
}
```

Success:

```json
{
  "message": "Conversation created successfully",
  "conversation": {
    "id": "conversation-uuid",
    "type": "DIRECT",
    "title": "Question about Taco Paradise",
    "isClosed": false,
    "unreadCount": 0,
    "messageCount": 0,
    "otherParticipant": {},
    "participants": [],
    "lastMessage": null
  }
}
```

If already exists:

```json
{
  "message": "Conversation already exists",
  "conversation": {
    "id": "existing-conversation-uuid"
  }
}
```

Important errors:

| Status | Message |
| --- | --- |
| 400 | `Provide exactly one of participantUserId, vendorId, or foodTruckId` |
| 400 | `You cannot start a conversation with yourself` |
| 404 | `Food truck not found` |
| 404 | `Vendor not found` |
| 403 | `User account cannot use messaging` |

---

### 3. Get one conversation

```http
GET /api/v1/messaging/conversations/:conversationId
```

Purpose:

- load selected conversation metadata;
- verify current user can access the conversation.

Success:

```json
{
  "message": "Conversation retrieved successfully",
  "conversation": {
    "id": "conversation-uuid",
    "type": "DIRECT",
    "title": "Question about Taco Paradise",
    "isClosed": false,
    "unreadCount": 1,
    "messageCount": 3,
    "otherParticipant": {},
    "participants": [],
    "lastMessage": {}
  }
}
```

Important error:

```json
{
  "statusCode": 403,
  "message": "Conversation is not visible to this user",
  "error": "Forbidden"
}
```

---

### 4. List messages in a conversation

```http
GET /api/v1/messaging/conversations/:conversationId/messages?limit=30&offset=0
```

Purpose:

- chat details screen message history.

Response:

```json
{
  "message": "Messages retrieved successfully",
  "items": [
    {
      "id": "message-uuid",
      "conversationId": "conversation-uuid",
      "senderId": "sender-user-uuid",
      "messageType": "TEXT",
      "content": "Hi, are you available?",
      "attachmentUrl": null,
      "createdAt": "2026-09-13T10:02:00.000Z",
      "editedAt": null,
      "sender": {
        "id": "sender-user-uuid",
        "email": "customer@example.com",
        "displayName": "Alex Rivera",
        "avatarUrl": "https://...",
        "vendor": null
      }
    }
  ],
  "total": 1,
  "nextOffset": null
}
```

Pagination:

```txt
limit default: 30
limit max: 100
offset default: 0
nextOffset null means no next page
```

Sort order:

```txt
createdAt desc
```

So backend returns newest messages first.

---

### 5. Send message

```http
POST /api/v1/messaging/conversations/:conversationId/messages
```

Text message body:

```json
{
  "messageType": "TEXT",
  "content": "Hi, are you available for this booking?"
}
```

Image message body:

```json
{
  "messageType": "IMAGE",
  "attachmentUrl": "https://res.cloudinary.com/demo/image/upload/v1/bitedrop/messages/photo.jpg",
  "content": "Menu reference photo"
}
```

File message body:

```json
{
  "messageType": "FILE",
  "attachmentUrl": "https://res.cloudinary.com/demo/raw/upload/v1/bitedrop/messages/file.pdf",
  "content": "Event requirement PDF"
}
```

Success:

```json
{
  "message": "Message sent successfully",
  "item": {
    "id": "message-uuid",
    "conversationId": "conversation-uuid",
    "senderId": "current-user-uuid",
    "messageType": "TEXT",
    "content": "Hi, are you available for this booking?",
    "attachmentUrl": null,
    "createdAt": "2026-09-13T10:02:00.000Z",
    "editedAt": null,
    "sender": {
      "id": "current-user-uuid",
      "email": "customer@example.com",
      "displayName": "Alex Rivera",
      "avatarUrl": "https://...",
      "vendor": null
    }
  }
}
```

Backend side effects:

1. Creates a `Message` row.
2. Updates `Conversation.lastMessageAt`.
3. Updates sender participant `lastReadAt`.
4. Emits Socket.IO `message:new` to the conversation room.
5. Creates notification for other unmuted participants.
6. Sends Firebase push notification if recipient has active device token and `messageAlerts` is enabled.

Important errors:

| Status | Message |
| --- | --- |
| 400 | `Message content or attachmentUrl is required` |
| 400 | `Text message content is required` |
| 400 | `attachmentUrl is required for image or file messages` |
| 400 | `This conversation is closed` |
| 403 | `Conversation is not visible to this user` |

---

### 6. Mark conversation as read

```http
PATCH /api/v1/messaging/conversations/:conversationId/read
```

Purpose:

- updates current participant `lastReadAt`;
- unread count becomes zero for messages before that timestamp.

Success:

```json
{
  "message": "Conversation marked as read"
}
```

Backend side effects:

1. Updates `ConversationParticipant.lastReadAt`.
2. Emits Socket.IO `conversation:read` to the conversation room.

---

## Socket.IO realtime

Namespace:

```txt
/messaging
```

Backend gateway:

```txt
src/modules/messaging/messaging.gateway.ts
```

### Socket auth

Socket connection requires JWT access token.

Backend accepts token in:

```txt
handshake.auth.token
```

or:

```http
Authorization: Bearer <accessToken>
```

If invalid:

```json
{
  "message": "Invalid or expired access token"
}
```

Then backend disconnects the socket.

### Connection behavior

On successful socket connection:

```txt
client joins room: user:<userId>
```

Current implementation mostly uses conversation rooms for messaging events.

---

### Client event: join conversation

```txt
conversation:join
```

Payload:

```json
{
  "conversationId": "conversation-uuid"
}
```

Backend checks:

- socket user is authenticated;
- user is participant of this conversation.

Then socket joins:

```txt
conversation:<conversationId>
```

Acknowledgement:

```json
{
  "event": "conversation:joined",
  "data": {
    "message": "Conversation retrieved successfully",
    "conversation": {}
  }
}
```

---

### Client event: leave conversation

```txt
conversation:leave
```

Payload:

```json
{
  "conversationId": "conversation-uuid"
}
```

Acknowledgement:

```json
{
  "event": "conversation:left",
  "data": {
    "conversationId": "conversation-uuid"
  }
}
```

---

### Client event: send message

```txt
message:send
```

Payload:

```json
{
  "conversationId": "conversation-uuid",
  "messageType": "TEXT",
  "content": "Hi, are you available?"
}
```

This uses the same backend service as the REST send-message API.

Acknowledgement:

```json
{
  "event": "message:sent",
  "data": {
    "message": "Message sent successfully",
    "item": {}
  }
}
```

Side effects are the same as REST send:

- DB message created;
- conversation updated;
- `message:new` emitted;
- notification created;
- push attempted.

---

### Client event: mark read

```txt
conversation:read
```

Payload:

```json
{
  "conversationId": "conversation-uuid"
}
```

Acknowledgement:

```json
{
  "event": "conversation:read",
  "data": {
    "message": "Conversation marked as read"
  }
}
```

---

### Server event: new message

```txt
message:new
```

Room:

```txt
conversation:<conversationId>
```

Payload:

```json
{
  "id": "message-uuid",
  "conversationId": "conversation-uuid",
  "senderId": "sender-user-uuid",
  "messageType": "TEXT",
  "content": "Hi",
  "attachmentUrl": null,
  "createdAt": "2026-09-13T10:02:00.000Z",
  "editedAt": null,
  "sender": {
    "id": "sender-user-uuid",
    "email": "sender@example.com",
    "displayName": "Alex Rivera",
    "avatarUrl": "https://...",
    "vendor": null
  }
}
```

Important:

- This event is emitted only to sockets currently joined to the conversation room.
- It is not currently emitted globally to the chat-list screen.
- Chat list updates can be handled by refresh/polling, push notification, or a future `conversation:updated` socket event.

---

### Server event: conversation read

```txt
conversation:read
```

Room:

```txt
conversation:<conversationId>
```

Payload:

```json
{
  "conversationId": "conversation-uuid",
  "userId": "reader-user-uuid",
  "readAt": "2026-09-13T10:03:00.000Z"
}
```

---

## Push notification implementation

Backend push flow is implemented through:

```txt
src/modules/notifications/notifications.service.ts
src/infrastructure/firebase/firebase.service.ts
```

When a message is sent, backend calls:

```txt
NotificationsService.notify()
```

with:

```txt
type: MESSAGE
title: New message
message: <message content or default text>
conversationId: <conversationId>
actionUrl: /api/v1/messaging/conversations/<conversationId>
pushPreferenceKey: messageAlerts
pushData.eventType: MESSAGE_CREATED
pushData.conversationId
pushData.messageId
```

Notification payload sent to Firebase:

```json
{
  "notification": {
    "title": "New message",
    "body": "Hi, are you available?"
  },
  "data": {
    "notificationId": "notification-uuid",
    "type": "MESSAGE",
    "eventType": "MESSAGE_CREATED",
    "conversationId": "conversation-uuid",
    "messageId": "message-uuid"
  }
}
```

Backend push checks:

1. Creates DB notification first.
2. Loads recipient notification preferences.
3. If `messageAlerts === false`, push is skipped but DB notification remains.
4. Loads active device tokens.
5. Sends Firebase multicast push.
6. Invalid Firebase tokens are deactivated.

Muted conversations:

- `ConversationParticipant.isMuted` is checked before notification.
- If recipient participant is muted, backend does not notify that participant.

---

## Device token APIs

Device tokens are required for push notifications.

### Register device token

```http
POST /api/v1/users/me/device-tokens
```

Body:

```json
{
  "token": "fcm-or-web-push-token",
  "platform": "ANDROID",
  "deviceId": "optional-device-id"
}
```

Supported platform values:

```txt
ANDROID
IOS
WEB
```

Backend behavior:

- if token already exists, it updates owner/platform/device and marks active;
- if token does not exist, it creates new device token;
- token is unique.

### Remove/deactivate device token

```http
DELETE /api/v1/users/me/device-tokens/:id
```

Success:

```json
{
  "removed": true
}
```

Backend behavior:

- does not hard delete;
- sets `isActive = false`.

---

## Notification preference API

Message push uses `messageAlerts`.

```http
PATCH /api/v1/users/me/notification-preferences
```

Body example:

```json
{
  "messageAlerts": true
}
```

Other preference fields also exist:

```txt
nearbyDropAlerts
followedTruckUpdates
favoriteTruckAlerts
promotionAlerts
bookingAlerts
paymentAlerts
messageAlerts
rewardAlerts
checkInAlerts
marketingAlerts
```

For messaging, the important one is:

```txt
messageAlerts
```

---

## Notification center APIs

Push notification also creates a DB notification. These APIs read/update notification center data.

### List notifications

```http
GET /api/v1/notifications?limit=20&offset=0
```

Optional:

```http
GET /api/v1/notifications?unreadOnly=true&limit=20&offset=0
```

### Get unread count

```http
GET /api/v1/notifications/unread-count
```

Response:

```json
{
  "unreadCount": 3
}
```

### Mark one notification as read

```http
PATCH /api/v1/notifications/:notificationId/read
```

### Mark all notifications as read

```http
PATCH /api/v1/notifications/read-all
```

Response:

```json
{
  "updatedCount": 3
}
```

---

## Firebase configuration requirement

Push delivery depends on Firebase Admin configuration.

Backend code loads Firebase config from:

```txt
src/config/firebase.config.ts
```

If Firebase config is missing:

- message sending still works;
- DB notification still gets created;
- Socket.IO realtime still works;
- push delivery is skipped safely.

If Firebase Admin SDK is unavailable or Firebase send fails:

- backend logs a warning;
- message sending does not fail because of push failure.

---

## Normal messaging vs booking issue messages

Do not confuse these two systems.

### Normal app chat

Use:

```http
/api/v1/messaging
```

Realtime:

```txt
Socket.IO /messaging
```

Push:

```txt
MESSAGE / MESSAGE_CREATED
```

### Booking issue/admin messages

Use:

```http
GET  /api/v1/bookings/:bookingId/issues/:issueId/messages
POST /api/v1/bookings/:bookingId/issues/:issueId/messages
```

This is for booking completion disputes/admin booking management.

Decision:

```txt
No Socket.IO required for booking issue messages.
HTTP-only is enough.
```

---

## Current known limitation

Current Socket.IO realtime is conversation-room focused.

Implemented:

- live messages inside opened chat details screen;
- live read event inside opened chat details screen.

Not currently implemented as a dedicated socket event:

- global chat-list realtime update event like `conversation:updated`;
- typing indicator;
- online/offline presence;
- delivered/read receipt per individual message;
- message edit/delete API;
- file upload endpoint specifically for messaging.

For current backend, chat list can be refreshed through REST after push notification or on screen focus.

---

## Backend manual test checklist

1. Login as customer and vendor.
2. Register device token for both accounts:

```http
POST /api/v1/users/me/device-tokens
```

3. Customer creates/reuses conversation:

```http
POST /api/v1/messaging/conversations/direct
```

4. Customer sends REST message:

```http
POST /api/v1/messaging/conversations/:conversationId/messages
```

5. Confirm DB notification exists for recipient:

```http
GET /api/v1/notifications
```

6. Confirm unread count:

```http
GET /api/v1/notifications/unread-count
```

7. Vendor lists conversations:

```http
GET /api/v1/messaging/conversations
```

8. Vendor lists messages:

```http
GET /api/v1/messaging/conversations/:conversationId/messages
```

9. Vendor marks read:

```http
PATCH /api/v1/messaging/conversations/:conversationId/read
```

10. Socket.IO test:

```txt
connect /messaging with JWT
emit conversation:join
send message from other user
listen for message:new
```

11. Preference test:

```http
PATCH /api/v1/users/me/notification-preferences
```

with:

```json
{
  "messageAlerts": false
}
```

Then send another message. Expected:

- DB notification is created;
- Firebase push is skipped.

