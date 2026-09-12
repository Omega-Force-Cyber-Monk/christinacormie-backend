# Shared Community Posts — Manual API Flow

Base path: `/api/v1`. Authorize Swagger with a customer token or an approved/verified vendor token. Use two different vendor accounts to check vendor-as-organizer and vendor-as-provider behavior.

## 1. Prepare the Database

The change adds Community categories, callout fields, interest/ignore records, and per-person quote prices. Review pending migrations before applying them in your target environment.

```bash
npx prisma migrate status
npx prisma migrate deploy
npx prisma generate
```

Restart the backend. This guide assumes migrations have been applied. No automated tests or database migration were run by the assistant.

## 2. Upload Optional Attachments

```http
POST /api/v1/community/media/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

Use repeated `files` fields. Maximum five files, 10 MB each; JPG, PNG, and PDF only. Cloudinary must be configured.

Expected 201:

```json
{
  "message": "Attachments uploaded successfully",
  "media": [
    { "mediaUrl": "https://your-upload-host/flyer.png", "mediaType": "IMAGE" }
  ]
}
```

Copy `media` into a create/edit body. An empty array means no attachments.

## 3. Create Posts as Both Roles

All six types use:

```http
POST /api/v1/community/posts
```

Need a truck (use a future date when testing):

```json
{
  "category": "NEED_TRUCK",
  "eventType": "BIRTHDAY_PARTY",
  "eventDate": "2026-12-20",
  "startTime": "11:00",
  "endTime": "14:00",
  "eventTimezone": "America/Los_Angeles",
  "address": "Golden Gate Park, San Francisco",
  "latitude": 37.7694,
  "longitude": -122.4862,
  "guestCount": 50,
  "budgetMin": 500,
  "budgetMax": 800,
  "description": "Looking for a truck with tacos and vegetarian options.",
  "preferredMenuItems": ["Tacos", "Vegetarian platter"],
  "media": []
}
```

Callout:

```json
{
  "category": "VENDOR_CALLOUT",
  "description": "Offering spots at our neighborhood festival. Vendors keep their own sales.",
  "eventDate": "2026-12-21",
  "startTime": "11:00",
  "endTime": "20:00",
  "address": "Market Street Plaza",
  "spotsOpen": 6,
  "attendanceMin": 2000,
  "attendanceMax": 2500,
  "media": []
}
```

For sale:

```json
{
  "category": "FOR_SALE",
  "title": "Commercial flat top grill",
  "description": "Used grill in good condition. Contact me for details.",
  "media": []
}
```

For the remaining categories, use the same body and change the category to `HIRING_JOBS`, `COMMUNITY_HELP`, or `COMMUNITY`:

```json
{
  "category": "COMMUNITY",
  "description": "Food truck meetup this weekend!",
  "media": []
}
```

Expected 201: `message`, `post`, and `rewardStatus`. Save `post.id`. The post contains `author`, `counts`, `viewer`, and `allowedActions`. If reward processing is unconfirmed, the response still confirms that the post was created; do not repost.

## 4. Lists, Details, Edit, Delete

```http
GET /api/v1/community/posts?limit=20&offset=0
GET /api/v1/community/posts?category=FOR_SALE
GET /api/v1/community/posts?latitude=37.7694&longitude=-122.4862&radiusKm=40
GET /api/v1/community/posts?tab=REQUESTS
GET /api/v1/community/posts/mine
GET /api/v1/community/posts/<postId>
PATCH /api/v1/community/posts/<postId>
DELETE /api/v1/community/posts/<postId>
```

Edit example:

```json
{ "description": "Updated event details.", "media": [] }
```

`media: []` removes attachments; omitting `media` keeps them. Optional fields cannot be set to null. Category changes are rejected. Editing/deleting requests after they receive any quotes returns 409. Delete is soft deletion.

Check pagination via `pagination.nextOffset`; null means the final page. `REQUESTS` contains actionable public Need-a-Truck and Callout posts by other users; it is not the organizer's received-quotes list.

## 5. Public Request Quotes

Log in as a different approved vendor:

```http
POST /api/v1/community/posts/<needTruckPostId>/offers
```

```json
{
  "foodTruckId": "REPLACE_WITH_REAL_TRUCK_UUID",
  "pricingModel": "PER_PERSON",
  "pricePerPerson": 25,
  "selectedMenuItems": ["Tacos", "Vegetarian platter"],
  "transportFee": 50,
  "extraCharges": [{ "label": "Setup", "amount": 20 }],
  "paymentPreference": "DEPOSIT_ONLY",
  "depositPercent": 20,
  "noteToClient": "Includes setup and serving."
}
```

For 50 guests: base fee $1,250; total $1,320; deposit $264; balance at event $1,056. Commission uses the server's configured rate. With the 10% fallback, commission is $132 and the vendor receives $132 through the app. A rate greater than 20% would require increasing this sample deposit.

For flat fee, use `pricingModel: FLAT_FEE`, provide `baseServiceFee`, and omit `pricePerPerson`. Total, balance, and deposit amount may be omitted so the backend computes them; if supplied, they must agree with the breakdown.

Expected 201: `message` and `offer`. Save `offer.id`.

```http
GET /api/v1/community/posts/<postId>/offers
PATCH /api/v1/community/offers/<offerId>/withdraw
PATCH /api/v1/community/offers/<offerId>/reject
PATCH /api/v1/community/offers/<offerId>/accept
```

- Organizer sees received quotes and can accept/reject them.
- Quoting vendor sees its own quotes and can withdraw pending ones.
- A duplicate active quote from the same truck receives 409. Withdraw first, then send a revised quote.
- Acceptance creates the payer/organizer's booking and rejects other pending quotes. A vendor organizer uses the same owner flow as a customer organizer.
- If end time was omitted, the Community booking reserves three hours. Provide `endTime` to use a different duration.

Continue using the existing payment flow:

```http
GET /api/v1/bookings/mine
POST /api/v1/payments/bookings/<bookingId>/payment-intent
```

Use the payment endpoint's existing Swagger DTO; the organizer must be the payer. Payment testing is a separate manual step and may contact Stripe.

## 6. Direct Personal Booking Quotes

The direct booking endpoints remain:

```http
POST /api/v1/bookings
GET /api/v1/bookings/vendor/mine
POST /api/v1/bookings/<bookingId>/quotes
PATCH /api/v1/bookings/quotes/<quoteId>/accept
```

Use the existing booking creation DTO. The direct quote body now also supports `pricePerPerson`; it does not include `foodTruckId` because the booking identifies the truck. Calculation rules match Community quotes, and the response includes `message`, `quote`, `booking`, and `breakdown`.

## 7. Vendor Callout Interest and Ignore/Pass

As a different approved vendor:

```http
POST /api/v1/community/posts/<calloutId>/interests
```

```json
{ "message": "We serve fresh tacos and would love to join your event." }
```

Expected 201 with success message. Duplicate interest returns 409; self-interest returns 403. No booking/payment is created, and spots are not automatically consumed.

```http
GET /api/v1/community/posts/<calloutId>/interests?limit=20&offset=0
DELETE /api/v1/community/posts/<calloutId>/interests/me
POST /api/v1/community/posts/<postId>/ignore
DELETE /api/v1/community/posts/<postId>/ignore
```

Only the organizer can read interest messages. Ignore and Undo use empty bodies and persist per account across sessions. Other users' feeds are unaffected.

## 8. Comments and Reactions

```http
POST /api/v1/community/posts/<postId>/comments
```

```json
{ "content": "Sounds great!" }
```

For a reply, add `parentCommentId` belonging to this post.

```http
GET /api/v1/community/posts/<postId>/comments?limit=20&offset=0
POST /api/v1/community/posts/<postId>/reactions
```

Reaction body:

```json
{ "reaction": "LIKE" }
```

## 9. Negative Checks

| Action                                                  | Expected                                               |
| ------------------------------------------------------- | ------------------------------------------------------ |
| Missing/expired token                                   | 401 with authentication message                        |
| Unapproved vendor creates post, quote, or interest      | 403 with approval message                              |
| Invalid post category                                   | 400 with allowed categories                            |
| Missing event date/guest count/address for Need a truck | 400 naming the missing field                           |
| Blank description or For Sale item name                 | 400 with field-specific message                        |
| Past event date or invalid IANA time zone               | 400 explaining the invalid event field                 |
| Minimum budget/attendance greater than maximum          | 400 explaining the range                               |
| Only latitude or only longitude                         | 400 requiring both                                     |
| Six attachments / wrong upload field                    | 400 explaining the five-file/files-field requirement   |
| File above 10 MB                                        | 413                                                    |
| Invalid file signature or unsupported format            | 400                                                    |
| Upload provider unavailable                             | 503 with safe retry message                            |
| Invalid UUID path parameter                             | 400                                                    |
| Other user edits/deletes a post                         | 403                                                    |
| Post missing/deleted                                    | 404                                                    |
| Category changed during edit                            | 400                                                    |
| Edit/delete request with quotes                         | 409                                                    |
| Vendor quotes own request                               | 403                                                    |
| Quote on For Sale, Community, or Callout                | 400                                                    |
| Duplicate active offer or interest                      | 409                                                    |
| Mismatched total/deposit/percentage/balance             | 400 describing the mismatch                            |
| Deposit below commission                                | 400 giving minimum deposit                             |
| Non-organizer reads callout messages                    | 403                                                    |
| Public open list                                        | Must exclude all private requests and expired requests |
| Two simultaneous offer acceptances                      | Only one should succeed                                |

Example validation response:

```json
{
  "statusCode": 400,
  "message": "Item name is required for a For Sale post",
  "error": "Bad Request"
}
```

DTO validation can return a `message` array. Flutter should display either the string or the joined array. Unexpected Community failures return a safe 500 message; inspect server logs for the underlying cause.
