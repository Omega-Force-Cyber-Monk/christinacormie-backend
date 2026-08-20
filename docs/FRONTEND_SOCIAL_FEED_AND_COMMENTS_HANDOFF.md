# Frontend Social Feed, Comments & Replies Integration Guide

Use this guide to connect the **Social Feed (Vendor & Customer)** and **Comments Bottom Sheet** to the backend NestJS APIs.

---

## 1. UI Screen to API Endpoint Mapping

### A. Customer & Vendor Feed Screens

```text
+-------------------------------------------------------------+
| Feed                 [ Following ]   [ Explore ]            |
|                      GET /feed/following  GET /feed/explore |
+-------------------------------------------------------------+
| 🌮 Taco Paradise                                            |
|    15 min ago • Union Square, SF                            |
|    We're at Union Square today! 🌮 Come grab our new...     |
|    [ Food Photo Media ]                                     |
|                                                             |
|    ❤️ 234         💬 18           🔗 Share                  |
|    POST /like    GET /comments   POST /share                |
+-------------------------------------------------------------+
```

| UI Element | API Endpoint | HTTP Method | Notes |
| :--- | :--- | :--- | :--- |
| **"Following" Tab** | `/api/v1/social/feed/following?limit=20&cursor=...` | `GET` | Posts from followed food trucks. |
| **"Explore" Tab** | `/api/v1/social/feed/explore?limit=20&sortBy=newest` | `GET` | All food truck posts (`?sortBy=newest` or `?sortBy=trending`). |
| **Vendor "Share Post" Box** | `/api/v1/social/posts` | `POST` | Vendor creates post with caption and media images. |
| **Like Post Button** | `/api/v1/social/posts/:postId/like` | `POST` | Toggles post like (`likeCount`). |
| **Share Post Button** | `/api/v1/social/posts/:postId/share` | `POST` | Increments `shareCount`, returns deep link & preview text. |

---

### B. Comments Bottom Sheet (with 1-Level Nested Replies)

```text
+-------------------------------------------------------------+
| Comments (4 comments)                                  [X]  |
|                                                             |
| 🌮 Taco Paradise (Original Post Pin)                        |
|    We're at Union Square today! 🌮 Come grab our new...     |
+-------------------------------------------------------------+
| [Avatar] Mike Chen                                          |
|          Those fish tacos look amazing! 🔥                  |
|          5 min ago    ❤️ 12 (Like)    Reply                 |
|                                                             |
|      [Avatar] Taco Paradise (Vendor Reply)                  |
|               Thanks! Mention code BITEDROP for a free drink|
|               3 min ago    ❤️ 2 (Like)     Reply            |
|                                                             |
| [Avatar] Sarah Johnson                                      |
|          I'll be there! Can't wait to try the new menu 🌮   |
|          10 min ago   ❤️ 8 (Like)     Reply                 |
+-------------------------------------------------------------+
| [Avatar] [ Add a comment...                             ] ✈️|
|          POST /api/v1/social/posts/:postId/comments         |
+-------------------------------------------------------------+
```

| UI Element | API Endpoint | HTTP Method | Notes |
| :--- | :--- | :--- | :--- |
| **Open Comments Sheet** | `/api/v1/social/posts/:postId/comments` | `GET` | Returns top-level comments with `replies: []`, `likeCount`, and `isLiked`. |
| **Send Top-Level Comment** | `/api/v1/social/posts/:postId/comments` | `POST` | `{ "content": "..." }` |
| **Send Reply to Comment** | `/api/v1/social/posts/:postId/comments` | `POST` | `{ "content": "...", "parentCommentId": "..." }` |
| **Like Comment Button** | `/api/v1/social/comments/:commentId/like` | `POST` | Toggles like on comment / reply. |

---

## 2. API Endpoints Specification

### 2.1 Fetch Comments Tree (1-Level Nested)
```http
GET /api/v1/social/posts/{{postId}}/comments?limit=20&offset=0
Authorization: Bearer {{accessToken}}
```

**Response Example:**
```json
{
  "totalCount": 4,
  "comments": [
    {
      "id": "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      "postId": "p1eebc99-9c0b-4ef8-bb6d-6bb9bd380a99",
      "content": "Those fish tacos look amazing! 🔥",
      "likeCount": 12,
      "isLiked": true,
      "createdAt": "2026-08-20T14:50:00.000Z",
      "author": {
        "id": "u1eebc99-9c0b-4ef8-bb6d-6bb9bd380a44",
        "displayName": "Mike Chen",
        "avatarUrl": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100"
      },
      "replies": [
        {
          "id": "r1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
          "postId": "p1eebc99-9c0b-4ef8-bb6d-6bb9bd380a99",
          "parentCommentId": "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          "content": "Thanks Mike! Mention code BITEDROP for a free drink!",
          "likeCount": 2,
          "isLiked": false,
          "createdAt": "2026-08-20T14:52:00.000Z",
          "author": {
            "id": "v1eebc99-9c0b-4ef8-bb6d-6bb9bd380a88",
            "displayName": "Taco Paradise",
            "avatarUrl": "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=100"
          }
        }
      ]
    }
  ]
}
```

---

### 2.2 Post a Comment or Reply
```http
POST /api/v1/social/posts/{{postId}}/comments
Authorization: Bearer {{accessToken}}
Content-Type: application/json

{
  "content": "I'll be there! Can't wait to try the new menu 🌮",
  "parentCommentId": "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
}
```
*Note: For top-level comments, omit `parentCommentId` or set it to `undefined`.*

---

### 2.3 Like a Comment
```http
POST /api/v1/social/comments/{{commentId}}/like
Authorization: Bearer {{accessToken}}
```

**Response Example:**
```json
{
  "liked": true,
  "likeCount": 13
}
```

---

### 2.4 Share a Post
```http
POST /api/v1/social/posts/{{postId}}/share
Authorization: Bearer {{accessToken}}
```

**Response Example:**
```json
{
  "success": true,
  "postId": "p1eebc99-9c0b-4ef8-bb6d-6bb9bd380a99",
  "shareCount": 15,
  "shareUrl": "/api/v1/food-trucks/profile/taco-paradise/posts/p1eebc99-9c0b-4ef8-bb6d-6bb9bd380a99",
  "shareText": "We're at Union Square today! 🌮 Come grab our new Baja Fish Tacos..."
}
```
