# Social API Flow

Base URL: `/api/v1/social`

All Social APIs require a bearer token. Vendor post management APIs also require the `VENDOR` role and an approved/verified vendor account.

## 1. Customer Feed Flow

Use these APIs for the customer Social / Feed tabs.

### Explore Feed

```http
GET /api/v1/social/feed/explore?limit=20&sortBy=newest
```

Purpose: shows public posts from all food trucks. Use this for the Explore tab.

Query params:

| Name | Required | Values | Notes |
|---|---:|---|---|
| `limit` | No | `1` to `50` | Defaults to `20` |
| `cursor` | No | post id | Use response `nextCursor` for pagination |
| `sortBy` | No | `newest`, `trending` | Defaults to `newest` |

Response shape:

```json
{
  "items": [
    {
      "id": "post-id",
      "content": "Fresh tacos ready at Downtown Plaza!",
      "isPromotion": true,
      "isFollowerOnly": false,
      "likeCount": 12,
      "commentCount": 3,
      "shareCount": 4,
      "saveCount": 2,
      "isLiked": false,
      "isSaved": true,
      "media": [],
      "vendor": {},
      "foodTruck": {}
    }
  ],
  "nextCursor": null
}
```

### Following Feed

```http
GET /api/v1/social/feed/following?limit=20
```

Purpose: shows posts only from food trucks the customer follows. Use this for the Following tab.

Query params:

| Name | Required | Values | Notes |
|---|---:|---|---|
| `limit` | No | `1` to `100` | Defaults to `20` |
| `cursor` | No | UUID post id | Use response `nextCursor` for pagination |

## 2. Follow And Favorite Truck Flow

Use these APIs from food truck profile, discovery cards, and favorites page.

### Follow Food Truck

```http
POST /api/v1/social/food-trucks/:foodTruckId/follow
```

Purpose: customer follows a truck. If already followed, backend returns the existing follow. Following also awards follow points once by idempotency.

### Unfollow Food Truck

```http
DELETE /api/v1/social/food-trucks/:foodTruckId/follow
```

Purpose: customer unfollows a truck.

Response:

```json
{
  "unfollowed": true
}
```

### Toggle Follow Notifications

```http
PATCH /api/v1/social/food-trucks/:foodTruckId/follow/notifications
```

Purpose: enable or disable push notifications for a followed truck.

Body:

```json
{
  "notificationsEnabled": true
}
```

### Add Favorite

```http
POST /api/v1/social/food-trucks/:foodTruckId/favorite
```

Purpose: customer adds a truck to favorites.

### Remove Favorite

```http
DELETE /api/v1/social/food-trucks/:foodTruckId/favorite
```

Purpose: customer removes a truck from favorites.

Response:

```json
{
  "unfavorited": true
}
```

### Favorites List

```http
GET /api/v1/social/favorites?tab=ALL&search=Taco&latitude=37.7749&longitude=-122.4194
```

Purpose: favorites/following management screen. Returns favorite/followed trucks with open/closed counts and optional distance.

Query params:

| Name | Required | Values | Notes |
|---|---:|---|---|
| `tab` | No | `ALL`, `OPEN`, `CLOSED` | Defaults to `ALL` |
| `search` | No | text | Searches by truck name or cuisine |
| `latitude` | No | number | Send with longitude for distance |
| `longitude` | No | number | Send with latitude for distance |

## 3. Vendor Post Flow

Use these APIs in the vendor app when a vendor posts updates for their own food truck.

### Get My Posts (Vendor Timeline)

```http
GET /api/v1/social/posts/mine?limit=20
```

Purpose: returns all social posts created by the authenticated vendor (latest first), similar to a Facebook profile feed. Includes likes count, comments count, share count, and bookmark status.

Query params:

| Name | Required | Values | Notes |
|---|---:|---|---|
| `limit` | No | `1` to `100` | Defaults to `20` |
| `cursor` | No | UUID post id | Use response `nextCursor` for pagination |

### Create Post

```http
POST /api/v1/social/posts
```

Purpose: vendor creates a social post for their own food truck. Published posts notify followers.

Body:

```json
{
  "foodTruckId": "food-truck-id",
  "content": "Fresh tacos ready at Downtown Plaza!",
  "status": "PUBLISHED",
  "isPromotion": true,
  "isFollowerOnly": false,
  "media": [
    {
      "mediaType": "IMAGE",
      "mediaUrl": "https://cdn.example.com/post.jpg",
      "sortOrder": 0
    }
  ]
}
```

Notes:

- `status`: `DRAFT` or `PUBLISHED`.
- `isFollowerOnly: true` means only followers can see it.
- Media must already be uploaded somewhere; this Social module does not include a dedicated media upload endpoint.

### Update Post

```http
PATCH /api/v1/social/posts/:postId
```

Purpose: vendor updates their own post.

Body supports any subset:

```json
{
  "content": "Updated post content",
  "status": "PUBLISHED",
  "isPromotion": false,
  "isFollowerOnly": false,
  "media": []
}
```

If `media` is sent, it replaces the previous media list.

### Delete Post

```http
DELETE /api/v1/social/posts/:postId
```

Purpose: vendor soft-deletes their own post.

Response:

```json
{
  "deleted": true
}
```

## 4. Post Engagement Flow

Use these APIs from post cards/details.

### Like Post

```http
POST /api/v1/social/posts/:postId/like
```

Purpose: likes a post. Current implementation returns existing like if already liked; it does not unlike on second click.

### Save / Bookmark Post

```http
POST /api/v1/social/posts/:postId/save
```

Purpose: toggles save/bookmark for the authenticated user.

Response:

```json
{
  "saved": true
}
```

or:

```json
{
  "saved": false
}
```

### Share Post

```http
POST /api/v1/social/posts/:postId/share
```

Purpose: increments share count and returns a share/deep link payload.

Response:

```json
{
  "success": true,
  "postId": "post-id",
  "shareCount": 5,
  "shareUrl": "/api/v1/food-trucks/profile/taco-paradise/posts/post-id",
  "shareText": "Fresh tacos ready at Downtown Plaza!"
}
```

## 5. Comments Flow

Use this for post detail comments and replies.

### Get Comments

```http
GET /api/v1/social/posts/:postId/comments?limit=20&offset=0
```

Purpose: returns top-level comments and 1-level replies.

Query params:

| Name | Required | Values | Notes |
|---|---:|---|---|
| `limit` | No | `1` to `50` | Defaults to `20` |
| `offset` | No | `0+` | Defaults to `0` |

### Add Comment Or Reply

```http
POST /api/v1/social/posts/:postId/comments
```

Purpose: creates a top-level comment or one-level reply.

Top-level comment body:

```json
{
  "content": "Looks delicious!"
}
```

Reply body:

```json
{
  "content": "See you there!",
  "parentCommentId": "comment-id"
}
```

Notes:

- Replies are flattened to one level. If frontend replies to a reply, backend attaches it to the top-level parent.

### Like / Unlike Comment

```http
POST /api/v1/social/comments/:commentId/like
```

Purpose: toggles comment like.

Response:

```json
{
  "liked": true,
  "likeCount": 2
}
```

or:

```json
{
  "liked": false,
  "likeCount": 1
}
```

## 6. Recommended Frontend Screen Mapping

| Screen / Action | API |
|---|---|
| Explore tab | `GET /social/feed/explore` |
| Following tab | `GET /social/feed/following` |
| Food truck profile follow button | `POST /social/food-trucks/:foodTruckId/follow` |
| Food truck profile unfollow | `DELETE /social/food-trucks/:foodTruckId/follow` |
| Follow notification toggle | `PATCH /social/food-trucks/:foodTruckId/follow/notifications` |
| Favorite button | `POST /social/food-trucks/:foodTruckId/favorite` |
| Remove favorite | `DELETE /social/food-trucks/:foodTruckId/favorite` |
| Favorites page | `GET /social/favorites` |
| Vendor create update/post | `POST /social/posts` |
| Vendor edit post | `PATCH /social/posts/:postId` |
| Vendor delete post | `DELETE /social/posts/:postId` |
| Like post | `POST /social/posts/:postId/like` |
| Save post | `POST /social/posts/:postId/save` |
| Share post | `POST /social/posts/:postId/share` |
| Open comments | `GET /social/posts/:postId/comments` |
| Add comment/reply | `POST /social/posts/:postId/comments` |
| Like comment | `POST /social/comments/:commentId/like` |

## 7. Common Errors

| Status | Common cause |
|---:|---|
| `400` | Invalid query/body validation, such as bad `limit`, invalid `sortBy`, or invalid UUID |
| `401` | Missing, invalid, or expired bearer token |
| `403` | Vendor not approved/verified, truck unavailable, or vendor trying to edit another vendor's post |
| `404` | Food truck, post, comment, or parent comment not found |
| `500` | Server error. If feed endpoints return `posts.share_count does not exist`, deploy/apply the latest migration |

## 8. Notes For Current Backend Behavior

- `POST /posts/:postId/like` is not a toggle unlike; it returns the existing like if already liked.
- `POST /comments/:commentId/like` is a true toggle.
- `POST /posts/:postId/save` is a true toggle.
- Social post image/file upload is not implemented in this module; frontend must provide `mediaUrl`.
- `feed/explore` only returns non-follower-only published posts.
- `feed/following` returns published posts from followed trucks.
