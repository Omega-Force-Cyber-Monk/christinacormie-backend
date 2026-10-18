# BiteDrop Flutter Integration Guide — Unified Social Update

এই document Flutter developer-এর জন্য নতুন backend feature ও API integration
handoff। এখানে শুধু ইতোমধ্যে implement ও real staging database-এ verify করা
contract দেওয়া হয়েছে। সব protected request-এ নিচের header দিতে হবে:

```http
Authorization: Bearer <access-token>
Content-Type: application/json
```

`POST /social/media/upload` multipart request; সেখানে JSON content type দেওয়া
যাবে না। Base path: `/api/v1`।

## 1. Release summary

নতুন release-এ:

- Foodie/Customer এবং Vendor উভয়েই social post করতে পারবে।
- Foodie ও Vendor একই feed, follow, tag, like, comment, share ও save flow ব্যবহার
  করবে।
- Foodie ↔ Foodie, Foodie ↔ Vendor এবং Vendor ↔ Vendor follow করা যাবে।
- শুধু নিজের followed account-কে post-এ tag করা যাবে।
- সব authenticated user অন্য Foodie/Vendor profile দেখতে পারবে।
- Profile-এ নিজের posts এবং tagged posts-এর আলাদা grid থাকবে।
- Follow ছাড়াই message করা যাবে; non-follower message প্রথমে Request হবে।
- User block/unblock করা যাবে।
- একজন Vendor-এর একটিই Food Truck থাকবে। Flutter-এ truck selector লাগবে না।
- Leaderboard screen-এ শুধু `Top Rated` এবং `Most Booked` থাকবে।
- Community question/request module অপরিবর্তিত।

## 2. Shared account model

Social API-তে Foodie এবং Vendor একই normalized identity ব্যবহার করে:

```json
{
  "userId": "user-uuid",
  "accountType": "CUSTOMER",
  "displayName": "Alex Rivera",
  "avatarUrl": "https://...",
  "vendorId": null,
  "foodTruckId": null,
  "foodTruckSlug": null,
  "isVerified": false
}
```

Vendor হলে `displayName` ও `avatarUrl` Food Truck identity থেকে আসবে এবং
`vendorId`, `foodTruckId`, `foodTruckSlug` populated থাকবে। Customer হলে এগুলো
`null` হবে। Flutter-এ আলাদা Foodie/Vendor post model না বানিয়ে shared
`SocialAccount` model ব্যবহার করা ভালো।

```dart
enum SocialAccountType { customer, vendor }

class SocialAccount {
  final String userId;
  final SocialAccountType accountType;
  final String displayName;
  final String? avatarUrl;
  final String? vendorId;
  final String? foodTruckId;
  final String? foodTruckSlug;
  final bool isVerified;
}
```

Routing rule:

- `CUSTOMER` tap → unified user profile using `userId`।
- `VENDOR` tap → একই unified profile; Food Truck detail প্রয়োজন হলে
  `foodTruckSlug`/`foodTruckId` ব্যবহার করা যাবে।
- Follow, block, tag ও message-এর canonical identifier সবসময় `userId`।

## 3. Public profile ও social graph

### Profile details

```http
GET /api/v1/social/profiles/:userId
```

Response normalized account-এর সঙ্গে নিচের field দেয়:

```json
{
  "userId": "user-uuid",
  "accountType": "VENDOR",
  "displayName": "Taco Haven",
  "avatarUrl": "https://...",
  "vendorId": "vendor-uuid",
  "foodTruckId": "truck-uuid",
  "foodTruckSlug": "taco-haven",
  "isVerified": true,
  "bio": "Fresh tacos every day",
  "city": "Austin",
  "state": "TX",
  "postCount": 9,
  "followerCount": 120,
  "followingCount": 32,
  "isFollowing": true
}
```

সব account public, তবে endpoint-এ valid JWT লাগে। `isFollowing` current viewer-এর
state; profile owner-এর permanent property নয়।

### Follow/unfollow

```http
POST   /api/v1/social/profiles/:userId/follow
DELETE /api/v1/social/profiles/:userId/follow
```

Unfollow response:

```json
{ "unfollowed": true }
```

Follow idempotent: একই target-কে দ্বিতীয়বার follow করলে duplicate row হবে না।
UI optimistic update করতে পারে, তবে API failure হলে count এবং state rollback
করতে হবে। Self-follow ও blocked relation reject হবে।

পুরোনো Food Truck follow endpoint compatibility-এর জন্য আছে:

```http
POST   /api/v1/social/food-trucks/:foodTruckId/follow
DELETE /api/v1/social/food-trucks/:foodTruckId/follow
```

নতুন screen-এ profile-based endpoint ব্যবহার করতে হবে।

### Followers/following list

```http
GET /api/v1/social/profiles/:userId/followers
GET /api/v1/social/profiles/:userId/following
```

Query:

- `type=ALL|CUSTOMER|VENDOR` — default `ALL`
- `search=<name>`
- `limit=1..100` — default `20`
- `offset=0..n` — default `0`

Response:

```json
{
  "items": [
    {
      "followedAt": "2026-10-18T07:00:00.000Z",
      "userId": "user-uuid",
      "accountType": "CUSTOMER",
      "displayName": "Alex Rivera",
      "avatarUrl": "https://...",
      "vendorId": null,
      "foodTruckId": null,
      "foodTruckSlug": null,
      "isVerified": false,
      "isFollowing": true
    }
  ],
  "total": 1,
  "counts": {
    "all": 10,
    "customer": 6,
    "vendor": 4
  },
  "limit": 20,
  "offset": 0,
  "nextOffset": null
}
```

Flutter behavior:

- Screen-এ `All`, `Foodies`, `Vendors` filter রাখুন।
- Search input debounce করুন (প্রস্তাবিত 300–500 ms)।
- Filter/search বদলালে list clear করে `offset=0` থেকে load করুন।
- পরের page-এর জন্য response-এর `nextOffset` ব্যবহার করুন।
- `nextOffset == null` হলে pagination শেষ।

### Block/unblock

```http
POST   /api/v1/social/profiles/:userId/block
DELETE /api/v1/social/profiles/:userId/block
```

Unblock response:

```json
{ "unblocked": true }
```

Block করার আগে confirmation dialog দিন। সফল block-এর পর:

- উভয় direction-এর follow relation remove হবে।
- Blocked account-এর post feed-এ থাকবে না।
- Follow, tag এবং message বন্ধ হবে।
- Existing chat history delete হবে না, কিন্তু নতুন message পাঠানো যাবে না।
- Unblock করলে আগের follow relation automatically ফিরে আসবে না।

## 4. Social post composer

### Recommended create flow

1. User gallery/camera থেকে সর্বোচ্চ 10টি image select করবে।
2. Image থাকলে আগে multipart upload endpoint call করুন।
3. Returned media URL দিয়ে post payload তৈরি করুন।
4. Optional Place select করুন।
5. Following list থেকে optional tagged accounts select করুন।
6. `POST /social/posts` call করুন।
7. Success হলে composer reset করে feed/profile refresh করুন।

### Media upload

```http
POST /api/v1/social/media/upload
Content-Type: multipart/form-data
```

Form key: `files`। একই key-এ একাধিক file attach করতে হবে।

Limits:

- শুধু valid JPG/PNG।
- সর্বোচ্চ 10 files।
- প্রতিটি সর্বোচ্চ 10 MB।

Response:

```json
{
  "media": [
    {
      "mediaType": "IMAGE",
      "mediaUrl": "https://res.cloudinary.com/.../photo.png",
      "sortOrder": 0
    }
  ]
}
```

Upload fail হলে post request পাঠাবেন না। Per-file progress এবং retry রাখা ভালো।

### Place/check-in picker

```http
GET /api/v1/social/places?search=downtown&marketId=<uuid>&limit=20&offset=0
```

`search` ও `marketId` optional। App endpoint শুধু active Place return করে। এটি
social location attachment—QR check-in নয়; loyalty, verified visit বা
leaderboard score পরিবর্তন করে না।

### Tag picker

Tag picker-এর data source:

```http
GET /api/v1/social/profiles/<currentUserId>/following?type=ALL&search=&limit=20&offset=0
```

Rules:

- সর্বোচ্চ 20 tagged account।
- শুধু followed active account tag করা যাবে।
- Self-tag করা যাবে না।
- Blocked account tag করা যাবে না।
- Tag শুধু post-এ; comment payload-এ `taggedUserIds` পাঠানো যাবে না।

### Create post

```http
POST /api/v1/social/posts
```

```json
{
  "content": "Fresh tacos are ready!",
  "locationId": "place-uuid",
  "taggedUserIds": ["followed-user-uuid"],
  "status": "PUBLISHED",
  "isPromotion": false,
  "isFollowerOnly": false,
  "media": [
    {
      "mediaType": "IMAGE",
      "mediaUrl": "https://res.cloudinary.com/.../photo.png",
      "sortOrder": 0
    }
  ]
}
```

Rules:

- `content` অথবা অন্তত একটি media required।
- `content` সর্বোচ্চ 2,200 characters।
- `status`: `DRAFT` বা `PUBLISHED`; omitted হলে backend default প্রযোজ্য।
- Image-only post-এর জন্য content empty/omitted হতে পারে।
- Foodie কখনো `foodTruckId` পাঠাবে না।
- Vendor-এর truck backend automatically resolve করে; Flutter-এ truck selector
  দেখাবেন না। Compatibility field থাকলেও সাধারণ create request-এ
  `foodTruckId` omit করুন।

### Update/delete/my posts

```http
PATCH  /api/v1/social/posts/:postId
DELETE /api/v1/social/posts/:postId
GET    /api/v1/social/posts/mine?limit=20&cursor=<postId>
```

Update payload create payload-এর partial version; field থাকলেই replace/update
হবে। `media` বা `taggedUserIds` পাঠালে সম্পূর্ণ নতুন list পাঠানো নিরাপদ। Draft
publish করতে:

```json
{ "status": "PUBLISHED" }
```

Delete response:

```json
{ "deleted": true }
```

`posts/mine` draft-সহ current user-এর posts দেয়। Cursor pagination response:

```json
{
  "items": [],
  "nextCursor": "next-post-uuid-or-null"
}
```

## 5. Feed, profile grids ও Post Detail

### Feed endpoints

```http
GET /api/v1/social/feed/following?limit=20&cursor=<postId>
GET /api/v1/social/feed/explore?limit=20&cursor=<postId>&sortBy=newest
```

Explore `sortBy`: `newest` বা `trending`। Following feed-এ account-level follow
ব্যবহৃত হয়। Blocked author-এর post কোনো feed-এ আসবে না। Response:

```json
{
  "items": [/* normalized posts */],
  "nextCursor": "post-uuid-or-null"
}
```

Pull-to-refresh-এ cursor clear করুন। Infinite scroll-এ server-provided
`nextCursor` পাঠান; local index/offset ব্যবহার করবেন না।

### Profile tabs

```http
GET /api/v1/social/profiles/:userId/posts?limit=20&cursor=<postId>
GET /api/v1/social/profiles/:userId/tagged-posts?limit=20&cursor=<postId>
```

- প্রথম endpoint: profile owner-এর authored posts।
- দ্বিতীয় endpoint: অন্য/নিজের post যেখানে profile owner tagged।
- Draft/hidden/removed/inaccessible post public grid-এ আসবে না।
- Tagged profile post edit/delete করতে পারবে না; ownership original author-এর।

UI tabs:

- বাম grid icon → authored posts।
- ডান tag icon → tagged posts।
- Grid thumbnail হিসেবে first media ব্যবহার করুন।
- Multi-image হলে media-count indicator দিন।
- Text-only post-এর জন্য text placeholder/card দেখান।
- Grid tap → সরাসরি Post Detail, full-screen image নয়।

### Post detail

```http
GET /api/v1/social/posts/:postId
```

Post-এর গুরুত্বপূর্ণ response shape:

```json
{
  "id": "post-uuid",
  "authorUserId": "user-uuid",
  "content": "Fresh tacos are ready!",
  "status": "PUBLISHED",
  "likeCount": 3,
  "commentCount": 2,
  "shareCount": 1,
  "publishedAt": "2026-10-18T07:00:00.000Z",
  "author": {
    "userId": "user-uuid",
    "accountType": "VENDOR",
    "displayName": "Taco Haven",
    "avatarUrl": "https://...",
    "vendorId": "vendor-uuid",
    "foodTruckId": "truck-uuid",
    "foodTruckSlug": "taco-haven",
    "isVerified": true
  },
  "media": [
    {
      "id": "media-uuid",
      "mediaType": "IMAGE",
      "mediaUrl": "https://...",
      "sortOrder": 0
    }
  ],
  "location": {
    "id": "place-uuid",
    "name": "Downtown Food Park",
    "address": "Austin, TX"
  },
  "taggedAccounts": [],
  "isLiked": true,
  "isSaved": false
}
```

কিছু nullable relation/field থাকতে পারে; model defensive nullable রাখুন। Media
`sortOrder` দিয়ে sort করুন। Detail media tap করলে full-screen swipe viewer খুলুন;
back করলে Post Detail এবং তারপর previous grid/feed scroll position restore করুন।

Deep link canonical key হলো `postId`। Share API-এর `shareUrl` ব্যবহার করুন।

## 6. Engagement APIs

```http
POST /api/v1/social/posts/:postId/like
POST /api/v1/social/posts/:postId/save
POST /api/v1/social/posts/:postId/share
GET  /api/v1/social/posts/:postId/comments?limit=20&offset=0
POST /api/v1/social/posts/:postId/comments
POST /api/v1/social/comments/:commentId/like
```

Like এবং save toggle endpoint। Response state (`liked`/`saved`) অনুসারে UI set
করুন; blindly invert না করাই নিরাপদ। Share response:

```json
{
  "success": true,
  "postId": "post-uuid",
  "shareCount": 2,
  "shareUrl": "/api/v1/social/posts/post-uuid",
  "shareText": "Fresh tacos are ready!"
}
```

Comment:

```json
{
  "content": "Looks delicious!",
  "parentCommentId": "optional-parent-comment-uuid"
}
```

শুধু one-level reply support। Comment-এ tagging নেই। Existing comment list
offset pagination ব্যবহার করে।

## 7. Messaging ও Message Requests

### Recipient search

```http
GET /api/v1/messaging/recipients?type=ALL&search=alex&limit=20&offset=0
```

- `type=ALL|CUSTOMER|VENDOR`
- `limit=1..50`
- Self এবং blocked accounts response-এ আসে না।
- Result normalized name/avatar/account type দেয়।

### Start/reuse conversation

```http
POST /api/v1/messaging/conversations/direct
```

Preferred payload:

```json
{ "participantUserId": "target-user-uuid" }
```

Food Truck detail-এর legacy/direct button চাইলে:

```json
{ "foodTruckId": "truck-uuid" }
```

`participantUserId`, `vendorId`, `foodTruckId`—ঠিক একটি field পাঠাতে হবে। একই দুই
user-এর existing direct conversation থাকলে backend সেটিই reuse করবে।

### Conversation statuses

`directStatus` তিন ধরনের:

- `ACTIVE`: normal chat; text/image/file পাঠানো যাবে।
- `REQUESTED`: recipient sender-কে follow করে না; Requests inbox-এ দেখাবে।
- `DECLINED`: request reject হয়েছে; আর message পাঠানো যাবে না।

Important direction rule: recipient যদি sender-কে follow করে, নতুন conversation
সরাসরি `ACTIVE`; অন্যথায় `REQUESTED`।

### Conversation inbox বনাম requests

```http
GET /api/v1/messaging/conversations?limit=20&offset=0
GET /api/v1/messaging/requests?limit=20&offset=0
```

Incoming `REQUESTED` conversation normal inbox-এ আসে না; Requests endpoint-এ
আসে। Sender তার outgoing request normal conversation list-এ দেখতে পারে। দুটোই
`nextOffset` pagination ব্যবহার করে।

Conversation response-এর মূল fields:

```json
{
  "id": "conversation-uuid",
  "type": "DIRECT",
  "title": null,
  "isClosed": false,
  "directStatus": "REQUESTED",
  "requestedRecipientId": "recipient-user-uuid",
  "acceptedAt": null,
  "createdAt": "2026-10-18T07:00:00.000Z",
  "lastMessageAt": null,
  "unreadCount": 0,
  "messageCount": 0,
  "otherParticipant": {
    "userId": "target-user-uuid",
    "lastReadAt": null,
    "isMuted": false,
    "user": {
      "id": "target-user-uuid",
      "accountType": "VENDOR",
      "displayName": "Taco Haven",
      "avatarUrl": "https://...",
      "vendor": {}
    }
  },
  "participants": [],
  "lastMessage": null
}
```

Messaging-এর nested user identity-তে key `id`; social identity-তে `userId`।
Flutter mapping-এ এই পার্থক্য handle করুন।

### Accept/decline

```http
PATCH /api/v1/messaging/conversations/:conversationId/accept
PATCH /api/v1/messaging/conversations/:conversationId/decline
```

শুধু `requestedRecipientId` user action করতে পারবে। Accept response status
`ACTIVE`, decline response `DECLINED`। Recipient request message-এর reply দিলেও
backend automatically accept করে।

### Send/read messages

```http
GET   /api/v1/messaging/conversations/:conversationId
GET   /api/v1/messaging/conversations/:conversationId/messages?limit=20&offset=0
POST  /api/v1/messaging/conversations/:conversationId/messages
PATCH /api/v1/messaging/conversations/:conversationId/read
```

Text payload:

```json
{
  "messageType": "TEXT",
  "content": "Hi, are you open today?"
}
```

Attachment payload:

```json
{
  "messageType": "IMAGE",
  "attachmentUrl": "https://...",
  "content": "Optional caption"
}
```

`messageType`: `TEXT`, `IMAGE`, `FILE`; content max 5,000 characters। Requested
state-এ sender শুধু একটি initial `TEXT` message পাঠাতে পারবে। Recipient accept
বা reply করার আগে sender দ্বিতীয় message বা attachment পাঠাতে পারবে না। UI-তে
composer disable করে “Waiting for acceptance” দেখান।

Requested recipient-এর UI actions:

- Accept
- Decline
- Block
- Reply (reply করলে auto-accept)

Socket.IO/new-message handling existing flow-ই থাকবে। REST response পাওয়ার পর
socket event এলে message ID দিয়ে deduplicate করুন।

## 8. Leaderboard screen

শুধু দুইটি filter/tab রাখুন:

```http
GET /api/v1/leaderboards/top-rated
GET /api/v1/leaderboards/most-booked
```

Remove করুন:

- Most Followed
- Trending
- Rising
- Most Visited বা অন্য পুরোনো filter

Removed slug call করলে `400 Bad Request` আসবে। Existing generic endpoint
`GET /api/v1/leaderboards/:leaderboardId` শুধু valid UUID-এর জন্য।

## 9. Community module

Community question/request এবং social feed এক জিনিস নয়। Existing Community API,
screen, question, request, offer, reaction, comment, interest/ignore ও moderation
flow পরিবর্তন করবেন না। Social post tagging/location logic Community payload-এ
যোগ করবেন না।

## 10. Error handling

Standard NestJS error shape:

```json
{
  "message": "Only followed active accounts can be tagged",
  "error": "Forbidden",
  "statusCode": 403
}
```

Validation error-এ `message` string অথবা string array হতে পারে। Common handling:

- `400`: invalid UUID/payload, empty post, limit violation, self-action।
- `401`: token missing/expired → refresh token flow বা login।
- `403`: blocked relation, unauthorized owner action, invalid tag, request-state
  restriction।
- `404`: profile/post/place/conversation পাওয়া যায়নি বা visible নয়।
- `409`: Vendor-এর ইতোমধ্যে Food Truck আছে বা identity conflict।

Post Detail `404` হলে cached post দেখাবেন না; deleted/unavailable state দেখিয়ে
previous screen-এ ফেরার action দিন। `403` message request error toast-এর বদলে
clear state banner হিসেবে দেখানো ভালো।

## 11. Suggested Flutter architecture

Suggested models:

- `SocialAccount`
- `PublicSocialProfile`
- `SocialPost`
- `PostMedia`
- `SocialPlace`
- `FollowListResponse`
- `CursorPage<T>` এবং `OffsetPage<T>`
- `DirectConversation`
- `ConversationParticipant`
- `ChatMessage`
- `DirectConversationStatus`

Suggested repositories/services:

- `SocialRepository`: profile, follow, block, feeds, post CRUD, engagement।
- `PostComposerRepository`: media upload, places, tags, create/update।
- `MessagingRepository`: recipients, conversations, requests, messages।
- Existing `CommunityRepository` unchanged রাখুন।

State/cache rules:

- Follow/unfollow হলে profile এবং follower-list cache invalidate করুন।
- Post create/update/delete হলে feed, profile posts এবং post detail invalidate।
- Like/save-এর viewer state detail ও feed card—দুই cache-এ sync করুন।
- Block হলে target profile, feeds, follower lists ও chat composer state refresh।
- Message accept/decline হলে inbox এবং requests—দুই list refresh।
- Cursor page ও offset page একই pagination helper দিয়ে mix করবেন না।

## 12. Flutter implementation checklist

- [ ] Shared Foodie/Vendor account card এবং avatar fallback।
- [ ] Public profile with Follow, Message, Block actions।
- [ ] Followers/Following with All/Foodies/Vendors filters, search, pagination।
- [ ] Composer: caption, removable images, Place, tag picker, draft/publish।
- [ ] Multipart image upload progress ও retry।
- [ ] Following এবং Explore feeds।
- [ ] Profile authored/tagged grids।
- [ ] Post Detail, media carousel ও full-screen viewer।
- [ ] Like, save, comment/reply এবং platform share।
- [ ] Recipient search এবং profile/post থেকে Start Chat।
- [ ] Separate Message Requests screen/badge।
- [ ] Accept, decline, block এবং reply-to-accept UI।
- [ ] `REQUESTED` sender composer restriction।
- [ ] Leaderboard-এ শুধু Top Rated ও Most Booked।
- [ ] Community flows untouched regression test।
- [ ] 400/401/403/404/409 user-facing error mapping।
- [ ] Deep link by `postId`।

## 13. Verified status

Backend featureগুলো real Neon staging database ও live API দিয়ে E2E test করা হয়েছে:

- 57 scenarios passed, 0 failed।
- Social CRUD, follow, tagging, profile grids, engagement verified।
- Message request/accept/decline/reply/block verified।
- Existing Food Truck, Community, notifications ও booking smoke tests passed।
- Test database cleanup complete।

Flutter implementation-এর source of truth হলো live Swagger এবং এই document।
Backend field nullable হলে Flutter model-ও nullable রাখুন; response থেকে unknown
extra field এলে parsing fail না করার ব্যবস্থা রাখুন।
