# 👥 BiteDrop — Community Posts Complete Integration Guide
**Target Audience:** Flutter Mobile Developers & Frontend Engineers  
**Base URL:** `http://<HOST_OR_IP>/api/v1`

---

## 📑 Table of Contents
1. [Community Categories Overview Table](#1-community-categories-overview-table)
2. [Detailed Category Flows & Logic](#2-detailed-category-flows--logic)
3. [UI Screen & Tab Routing (Where does each post show?)](#3-ui-screen--tab-routing)
4. [Step-by-Step API Reference](#4-step-by-step-api-reference)
   - [A. Upload Media](#a-upload-media-images)
   - [B. Create Community Post](#b-create-community-post)
   - [C. List Posts (Feed & Filtering)](#c-list-community-posts-feed--filtering)
   - [D. Post Details](#d-get-post-details)
   - [E. Comments & Reactions](#e-comments--reactions)
   - [F. Vendor Offers on NEED_TRUCK](#f-vendor-offers--quotes-for-need_truck)
   - [G. Vendor Interest on VENDOR_CALLOUT](#g-vendor-interest-for-vendor_callout)
   - [H. Customer Accepts/Rejects Offer](#h-customer-accepts-or-rejects-vendor-offer)

---

## 1. Community Categories Overview Table

| # | Category Enum (`category`) | Purpose & User Intent | Allowed Interactive Vendor Actions | Target UI Location |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **`NEED_TRUCK`** | Customer needs 1 food truck for a private event (wedding, birthday, office catering) | **Send Custom Quote/Offer** (`POST .../offers`) | • Main Community Feed<br>• Vendor **`Requests -> Community`** Tab |
| **2** | **`VENDOR_CALLOUT`** | Event organizer invites multiple food trucks (festival, market, block party) | **Send Interest / Apply** (`POST .../interests`) | • Main Community Feed<br>• Vendor **`Requests -> Community`** Tab |
| **3** | **`HIRING_JOBS`** | Food truck owners hiring cooks/staff or workers seeking jobs | Like, React, Comment | • Main Community Feed (Filter: `HIRING_JOBS`) |
| **4** | **`FOR_SALE`** | Kitchen equipment, trucks, supplies buying and selling | Like, React, Comment | • Main Community Feed (Filter: `FOR_SALE`) |
| **5** | **`COMMUNITY_HELP`** | Questions, recommendations, area tips, permits advice | Like, React, Comment | • Main Community Feed (Filter: `COMMUNITY_HELP`) |
| **6** | **`COMMUNITY`** | General community chat, food photos, discussions | Like, React, Comment | • Main Community Feed (Filter: `COMMUNITY`) |

---

## 2. Detailed Category Flows & Logic

### Flow 1: `NEED_TRUCK` (Private Event Catering Bidding)
1. **Customer creates request**: Fills event date, time, address/GPS, guest count, budget, and cuisine preferences.
2. **Vendors receive notification**: The request appears in the vendor app under **Requests ➔ Community**.
3. **Vendors submit custom quotes**: Approved vendors submit pricing (flat fee or per person), travel charges, and deposit percentage ($\ge 20\%$).
4. **Customer reviews and accepts**: Customer selects the best offer and taps **Accept & Pay Deposit**.
5. **Booking is generated**: Backend converts this accepted offer directly into a confirmed **Booking** record (`communityRequestId` linked).

---

### Flow 2: `VENDOR_CALLOUT` (Festival / Multi-Truck Callout)
1. **Organizer creates callout**: Specifies event date, location, expected crowd size (`attendanceMin`, `attendanceMax`), and available vendor spots (`spotsOpen`).
2. **Vendors view callout**: Vendors view it under **Requests ➔ Community**.
3. **Vendor sends Interest**: Instead of a price quote, vendor sends an "Interest" message stating their truck wants to join the lineup (`POST /api/v1/community/posts/:id/interests`).
4. **Organizer reviews vendor applicants**: Organizer views list of interested food trucks and contacts them directly.

---

### Flow 3: `HIRING_JOBS`, `FOR_SALE`, `COMMUNITY_HELP`, `COMMUNITY` (Social & Classifieds)
1. **User creates post**: Uploads photos, writes a title and description.
2. **Community feed**: Appears immediately on the public Community feed.
3. **Points awarded**: Posters receive loyalty points for active engagement (`rewardStatus: "AWARDED"`).
4. **Community engages**: Users comment, react with emojis, and share.
5. **`allowedActions` response**:
   - `canEdit`: `true` (if caller is the author)
   - `canDelete`: `true` (if caller is the author or admin)
   - `canQuote`: `false` (cannot quote on non-event posts)
   - `canSendInterest`: `false`

---

## 3. UI Screen & Tab Routing

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. MAIN COMMUNITY TAB (Bottom Navigation -> "Community")     │
│    Shows ALL categories:                                    │
│    Filters: [ All ] [ Need Truck ] [ Callouts ] [ Jobs ] ...│
│    API: GET /api/v1/community/posts?category=...            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 2. VENDOR REQUESTS SCREEN (Bottom Navigation -> "Requests") │
│    ├── Tab 1: Bookings  --> GET /api/v1/bookings/vendor/mine?tab=REQUESTS&source=DIRECT
│    ├── Tab 2: Community --> GET /api/v1/community/posts?tab=REQUESTS
│    └── Tab 3: Messages  --> GET /api/v1/conversations
└─────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]  
> The **Vendor Requests ➔ Community** tab (`?tab=REQUESTS`) **ONLY** shows `NEED_TRUCK` and `VENDOR_CALLOUT` posts. Classified posts like `HIRING_JOBS` or `FOR_SALE` will **never** appear in the vendor requests screen.

---

## 4. Step-by-Step API Reference

### A. Upload Media (Images)
Upload images before creating a post to get back image URLs.
- **Endpoint:** `POST /api/v1/community/posts/upload`
- **Headers:**
  ```http
  Authorization: Bearer <TOKEN>
  Content-Type: multipart/form-data
  ```
- **Form Data:** `files` (array of image files, max 5)
- **Response `201 Created`:**
  ```json
  [
    {
      "mediaUrl": "https://res.cloudinary.com/.../image.jpg",
      "mediaType": "IMAGE"
    }
  ]
  ```

---

### B. Create Community Post
- **Endpoint:** `POST /api/v1/community/posts`
- **Headers:** `Authorization: Bearer <TOKEN>`

#### Example 1: `HIRING_JOBS` Post
```json
{
  "category": "HIRING_JOBS",
  "title": "Hiring Food Truck Cook",
  "description": "Looking for an experienced grill chef for weekend events.",
  "allowPublicComments": true,
  "media": [
    {
      "mediaUrl": "https://res.cloudinary.com/.../kitchen.jpg",
      "mediaType": "IMAGE"
    }
  ]
}
```

#### Example 2: `NEED_TRUCK` Post (Event Catering Request)
```json
{
  "category": "NEED_TRUCK",
  "eventType": "WEDDING_RECEPTION",
  "title": "Need Mexican Taco Truck for Wedding",
  "description": "Looking for tacos and appetizers for 100 guests.",
  "eventDate": "2026-10-15T00:00:00.000Z",
  "startTime": "18:00",
  "endTime": "21:00",
  "guestCount": 100,
  "budgetMin": 1500,
  "budgetMax": 2500,
  "address": "Zilker Park, Austin, TX",
  "latitude": 30.2672,
  "longitude": -97.7431,
  "preferredCuisines": ["Mexican", "Tacos"],
  "preferredMenuItems": ["Carne Asada Tacos", "Churros"],
  "media": []
}
```

#### Example 3: `VENDOR_CALLOUT` Post (Festival / Multi-Truck)
```json
{
  "category": "VENDOR_CALLOUT",
  "title": "Austin Fall Street Festival 2026",
  "description": "Calling all dessert and burger food trucks! Large crowd expected.",
  "eventDate": "2026-11-01T00:00:00.000Z",
  "startTime": "12:00",
  "endTime": "20:00",
  "spotsOpen": 6,
  "attendanceMin": 2000,
  "attendanceMax": 3500,
  "address": "Downtown Plaza, Austin, TX",
  "latitude": 30.2672,
  "longitude": -97.7431
}
```

---

### C. List Community Posts (Feed & Filtering)
- **Endpoint:** `GET /api/v1/community/posts`
- **Headers:** `Authorization: Bearer <TOKEN>`

#### Query Parameters:
| Parameter | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| `category` | string | `HIRING_JOBS` | Filter by category (`NEED_TRUCK`, `VENDOR_CALLOUT`, `HIRING_JOBS`, `FOR_SALE`, `COMMUNITY_HELP`, `COMMUNITY`) |
| `tab` | string | `REQUESTS` \| `MINE` | **`REQUESTS`**: for vendor quotes screen (`NEED_TRUCK` & `VENDOR_CALLOUT` only). **`MINE`**: posts created by current user. |
| `latitude` | number | `30.2672` | Geolocation filtering |
| `longitude` | number | `-97.7431` | Geolocation filtering |
| `radiusKm` | number | `40` | Radius in km (default 40km) |
| `search` | string | `taco` | Keyword search in title/description |
| `limit` | number | `20` | Pagination limit |
| `offset` | number | `0` | Pagination offset |

#### Response `200 OK`:
```json
{
  "message": "Community posts retrieved successfully",
  "posts": [
    {
      "id": "c4332092-...",
      "category": "HIRING_JOBS",
      "title": "Hiring / jobs",
      "description": "A Cook",
      "author": {
        "id": "user-uuid",
        "displayName": "Ali Nuhan",
        "avatarUrl": "https://..."
      },
      "counts": {
        "comments": 2,
        "reactions": 5,
        "offers": 0,
        "interestedVendors": 0
      },
      "allowedActions": {
        "canEdit": false,
        "canDelete": false,
        "canQuote": false,
        "canSendInterest": false
      }
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 20,
    "offset": 0,
    "hasMore": false
  }
}
```

---

### D. Get Post Details
- **Endpoint:** `GET /api/v1/community/posts/{postId}`
- **Headers:** `Authorization: Bearer <TOKEN>`
- **Response `200 OK`**: Returns complete details, author info, attached media, comments count, and action permissions.

---

### E. Comments & Reactions

#### 1. Add Comment:
- **Endpoint:** `POST /api/v1/community/posts/{postId}/comments`
- **Body:**
  ```json
  {
    "content": "Is this job position still available?",
    "parentCommentId": null
  }
  ```

#### 2. List Comments:
- **Endpoint:** `GET /api/v1/community/posts/{postId}/comments?limit=20&offset=0`

#### 3. React / Like Post:
- **Endpoint:** `POST /api/v1/community/posts/{postId}/reactions`
- **Body:**
  ```json
  {
    "type": "LIKE"
  }
  ```

---

### F. Vendor Offers / Quotes (for `NEED_TRUCK`)
Approved vendors submit a proposal quote to a customer's `NEED_TRUCK` post.
- **Endpoint:** `POST /api/v1/community/requests/{requestId}/offers`
- **Headers:** `Authorization: Bearer <VENDOR_TOKEN>`
- **Body:**
  ```json
  {
    "foodTruckId": "your-food-truck-uuid",
    "pricingModel": "FLAT_FEE",
    "baseServiceFee": 1200,
    "transportFee": 50,
    "quotedAmount": 1250,
    "paymentPreference": "DEPOSIT_ONLY",
    "depositPercent": 25,
    "depositAmount": 312.50,
    "balanceDueAtEvent": 937.50,
    "noteToClient": "Includes 2 hours of live taco prep and cleanup.",
    "selectedMenuItems": ["Carne Asada Tacos", "Churros"]
  }
  ```
- **Status:** `201 Created`

---

### G. Vendor Interest (for `VENDOR_CALLOUT`)
Vendors register interest for festival/multi-truck callouts.
- **Endpoint:** `POST /api/v1/community/posts/{postId}/interests`
- **Headers:** `Authorization: Bearer <VENDOR_TOKEN>`
- **Body:**
  ```json
  {
    "message": "We specialize in artisan gourmet burgers and would love to join your festival!"
  }
  ```
- **Status:** `201 Created`

---

### H. Customer Accepts or Rejects Vendor Offer

#### 1. Customer Accepts Offer:
- **Endpoint:** `PATCH /api/v1/community/offers/{offerId}/accept`
- **Headers:** `Authorization: Bearer <CUSTOMER_TOKEN>`
- **Status:** `200 OK`
- **Result:** Automatically creates a `Booking` record with status `PAYMENT_PENDING` and links it to the community post.

#### 2. Customer Rejects Offer:
- **Endpoint:** `PATCH /api/v1/community/offers/{offerId}/reject`
- **Headers:** `Authorization: Bearer <CUSTOMER_TOKEN>`
- **Status:** `200 OK`
