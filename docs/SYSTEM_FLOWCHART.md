# BiteDrop — Complete System Visual Flowchart & Architecture

This document visualizes all backend workflows, modules, and API data flows implemented to date.

---

## 1. High-Level System Architecture

```mermaid
flowchart TB
    subgraph Clients["📱 Client Platforms"]
        CustomerApp["Customer Mobile App<br/>(iOS / Android / Web)"]
        VendorApp["Vendor Mobile App<br/>& Web Dashboard"]
        AdminDashboard["Admin Portal"]
    end

    subgraph Gateway["🛡️ API Gateway & Security"]
        AuthGuard["JWT Auth Guard & Roles Guard<br/>(CUSTOMER, VENDOR, ADMIN)"]
        ValidationPipe["Global Validation & Serialization"]
    end

    subgraph CoreModules["⚙️ Core Business Modules"]
        AuthModule["🔐 Auth & Users Module"]
        TrucksModule["🚚 Food Trucks & Drops Module"]
        QRCheckInModule["📷 Smart QR & Check-Ins Module"]
        RewardsModule["🎁 Loyalty, Points & Redemption"]
        SocialModule["💬 Social Feed & 1-Level Comments"]
        BookingsModule["📅 Event Bookings & Quotes Module"]
        PaymentsModule["💳 Stripe Connect & Payments Module"]
        NotifModule["🔔 Notifications (In-App & FCM Push)"]
        LeaderboardsModule["🏆 Leaderboards & Discovery"]
    end

    subgraph DataStorage["🗄️ Database & Cloud Infrastructure"]
        PostgresDB[("PostgreSQL Database<br/>(Neon Serverless / Prisma ORM)")]
        FirebaseFCM["Firebase Cloud Messaging (FCM)<br/>Push Notification Server"]
        StripeAPI["Stripe Connect & Webhooks"]
    end

    Clients --> Gateway
    Gateway --> CoreModules
    CoreModules --> PostgresDB
    NotifModule --> FirebaseFCM
    PaymentsModule --> StripeAPI
```

---

## 2. Authentication & User Onboarding Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Customer / Vendor
    participant Client as Mobile / Web App
    participant Auth as AuthService & Controller
    participant Mail as MailService (SMTP)
    participant DB as PostgreSQL (Prisma)

    User->>Client: Enter Registration Details (Email, Password, Name)
    Client->>Auth: POST /api/v1/auth/register/customer OR /vendor
    Auth->>DB: Create User (Status: PENDING) + Generate 6-Digit OTP
    Auth->>Mail: Send Verification Email with 6-Digit Code
    Mail-->>User: Delivers Verification Code (Expires in 10m)
    Auth-->>Client: Return { status: "PENDING", message: "Verify email" }

    User->>Client: Input 6-Digit Code
    Client->>Auth: POST /api/v1/auth/verify-email { email, code }
    Auth->>DB: Verify OTP Hash -> Set Status: ACTIVE
    Auth->>DB: Create Refresh Token Record
    Auth-->>Client: Return Ultra-Minimal Auth Payload<br/>{ accessToken, refreshToken, user: { id, email, displayName, roles, vendor? } }
```

---

## 3. Food Truck Discovery & Smart QR Check-In Flow

```mermaid
flowchart TD
    StartScan(["Customer Arrives at Food Truck"]) --> ScanQR["Scan Vendor's BiteDrop QR Code"]
    ScanQR --> APIReq["POST /api/v1/qr/:code/check-ins<br/>Body: { latitude, longitude }"]
    
    APIReq --> GeofenceCheck{"Within Truck Proximity<br/>& Location Valid?"}
    GeofenceCheck -- No --> Reject["Status: REJECTED<br/>Fraud Prevention Triggered"]
    
    GeofenceCheck -- Yes --> DupCheck{"Checked In Within<br/>Last 12 Hours?"}
    DupCheck -- Yes --> DupState["experienceState: ALREADY_CHECKED_IN_TODAY<br/>Points Earned: 0"]
    
    DupCheck -- No --> CalcPoints["Award +10 Loyalty Points<br/>Update Tier Progress"]
    CalcPoints --> CheckBalance{"Total Points >= 500<br/>($5+ Credit Available)?"}
    
    CheckBalance -- Yes --> CreditState["experienceState: HAS_CREDIT_AVAILABLE<br/>availableCreditAmount: $5.00+<br/>Prompt Credit Usage"]
    CheckBalance -- No --> PointsState["experienceState: HAS_POINTS_NO_CREDIT<br/>Show Points Balance & Tier Bar"]

    DupState --> Response(["Return Smart JSON Payload to Mobile App"])
    CreditState --> Response
    PointsState --> Response
    Reject --> Response
```

---

## 4. Credit Redemption Flow (6-Digit Backup Code)

```mermaid
sequenceDiagram
    autonumber
    actor Cust as Customer
    participant CustApp as Customer App
    participant Backend as NestJS Backend (Rewards Module)
    participant VendApp as Vendor App
    actor Vend as Food Truck Staff

    Cust->>CustApp: Selects Credit to Redeem ($1 to $5)
    CustApp->>Backend: POST /api/v1/rewards/me/redemption-codes { amount: 5 }
    Backend->>Backend: Deduct 500 Points & Generate:<br/>1. 15-min redemptionToken<br/>2. 6-Digit backupCode (e.g. 857949)
    Backend-->>CustApp: Return { redemptionToken, backupCode: "857949", expiresAt: 15m }
    CustApp->>Cust: Displays QR Code & Large 6-Digit Code

    Cust->>Vend: Shows Phone or Tells 6-Digit Code: 857949
    alt Option A: Vendor Scans QR Token
        VendApp->>Backend: POST /api/v1/vendors/me/redemptions/confirm { redemptionToken }
    else Option B: Vendor Enters 6-Digit Code
        VendApp->>Backend: POST /api/v1/vendors/me/redemptions/confirm { manualCode: "857949" }
    end

    Backend->>Backend: Verify Token/Code & Status = PENDING & expiresAt >= now()
    Backend->>Backend: Set Status: COMPLETED, vendorId: vendor.id
    Backend-->>VendApp: Return { success: true, amountApplied: 5.00, customerName: "Maria Chen", remainingBalance: 15.00 }
    VendApp->>Vend: Shows "Redemption Complete! $5.00 Applied"
```

---

## 5. Social Feed, 1-Level Comments & Interaction Flow

```mermaid
flowchart TD
    subgraph FeedActions["📰 Feeds & Sharing"]
        ExploreTab["Explore Feed Tab<br/>GET /api/v1/social/feed/explore<br/>(?sortBy=newest | trending)"]
        FollowingTab["Following Feed Tab<br/>GET /api/v1/social/feed/following"]
        CreatePost["Vendor Post Creation<br/>POST /api/v1/social/posts"]
        LikePost["Like Post<br/>POST /api/v1/social/posts/:id/like"]
        SharePost["Share Post<br/>POST /api/v1/social/posts/:id/share<br/>(Increments shareCount & deep link)"]
    end

    subgraph CommentTree["💬 1-Level Nested Comments Engine"]
        FetchComments["Open Comments Bottom Sheet<br/>GET /api/v1/social/posts/:id/comments"]
        TopComment["Add Top-Level Comment<br/>POST /api/v1/social/posts/:id/comments<br/>{ content: 'Looks delicious!' }"]
        ReplyComment["Reply to a Comment<br/>POST /api/v1/social/posts/:id/comments<br/>{ content: '...', parentCommentId: 'parent_id' }"]
        FlattenCheck{"Is Target Comment<br/>Already a Reply?"}
        
        ReplyComment --> FlattenCheck
        FlattenCheck -- Yes --> Flatten["Automatically Flatten to Top-Level Parent ID<br/>(Strictly Enforces 1-Level Depth)"]
        FlattenCheck -- No --> DirectAttach["Attach as direct reply to parent comment"]
        
        LikeComment["Like a Comment<br/>POST /api/v1/social/comments/:id/like<br/>(Updates likeCount)"]
    end

    ExploreTab --> FetchComments
    FollowingTab --> FetchComments
    FetchComments --> TopComment
    FetchComments --> LikeComment
```

---

## 6. Event Booking & Payment Split Workflows

For the dedicated, end-to-end multi-diagram document covering all 3 booking types, state machines, and the 20% minimum deposit rule, see [ALL_BOOKING_FLOWS_FLOWCHART.md](file:///Users/softvence/arif/project/christinacormie-backend/docs/ALL_BOOKING_FLOWS_FLOWCHART.md).

### Flow 1: Public Community Request (Open Bidding)
```text
Customer Posts Event in Feed -> Multiple Food Trucks Submit Quotes (Deposit >= 20%) 
-> Customer Accepts Best Quote -> Pays Deposit/Full via Stripe 
-> 20% Platform Fee to BiteDrop, Net to Vendor -> CONFIRMED
```

### Flow 2: Direct Food Truck Profile Booking
```mermaid
sequenceDiagram
    autonumber
    actor Cust as Customer
    participant App as Mobile App
    participant BookAPI as Bookings Module
    participant PayAPI as Payments Module (Stripe)
    participant Vend as Food Truck Vendor

    Cust->>App: Completes 5-Step Wizard (Event Type, Date/Time, Menus, Budget, Consents)
    App->>BookAPI: POST /api/v1/bookings { foodTruckId, eventType, startsAt, endsAt, guestCount, paymentPreference }
    BookAPI-->>App: Return { bookingId, status: "PENDING" }
    BookAPI->>Vend: Sends New Booking Push & In-App Notification

    Vend->>BookAPI: POST /api/v1/bookings/:id/quotes { subtotal, transportFee, depositAmount (>=20%) }
    BookAPI-->>Cust: Notification: "Vendor submitted a quote for your event"

    Cust->>BookAPI: PATCH /api/v1/bookings/quotes/:quoteId/accept
    BookAPI-->>Cust: Return { status: "PAYMENT_PENDING", holdExpiresAt }

    Cust->>PayAPI: POST /api/v1/payments/bookings/:id/payment-intent
    PayAPI->>PayAPI: Creates Stripe Destination Charge (Deposit / Full Amount + 20% Platform Fee)
    Cust->>PayAPI: Completes Payment via Card / Apple Pay
    PayAPI->>BookAPI: Set Booking Status: CONFIRMED
    BookAPI->>Cust: Push Notification: "Booking Confirmed!"
    BookAPI->>Vend: Push Notification: "Payment Received & Booking Confirmed!"
```

---

## 7. Push & In-App Notification Pipeline

```mermaid
flowchart LR
    EventTrigger["System Event Triggered<br/>(Nearby Drop, Post Published,<br/>Booking Confirmed, Points Earned)"] --> NotifService["NotificationsService.notify()"]
    
    NotifService --> DBWrite["1. Write to PostgreSQL DB<br/>(Persistent Notification Record)"]
    NotifService --> PrefCheck{"2. Check User Preference<br/>(e.g. nearbyDropAlerts, promotionAlerts)"}
    
    PrefCheck -- Disabled --> Done[Skip Push Delivery]
    PrefCheck -- Enabled --> FetchTokens["3. Fetch User Active Device FCM Tokens"]
    
    FetchTokens --> FirebaseFCM["4. Firebase Admin SDK<br/>(sendEachForMulticast)"]
    FirebaseFCM --> Device["5. Delivered to Phone Lock Screen / Status Bar"]
    
    DBWrite --> InAppAPI["In-App Notification Center<br/>• GET /unread-count<br/>• GET /api/v1/notifications<br/>• PATCH /read-all"]
```

---

## 8. Summary of Implemented API Endpoints

| Category | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/v1/auth/register/customer` | Customer registration + 6-digit email OTP |
| **Auth** | `POST` | `/api/v1/auth/register/vendor` | Vendor registration + food truck draft creation |
| **Auth** | `POST` | `/api/v1/auth/verify-email` | Verifies 6-digit email code & activates account |
| **Auth** | `POST` | `/api/v1/auth/login` | Returns ultra-minimal auth payload & tokens |
| **Auth** | `POST` | `/api/v1/auth/logout` | Revokes refresh token |
| **Food Trucks** | `GET` | `/api/v1/food-trucks/drops/nearby` | Proximity live food truck drops |
| **Food Trucks** | `GET` | `/api/v1/food-trucks/profile/:slug` | Public food truck profile & active menu |
| **QR & Check-In** | `GET` | `/api/v1/vendors/me/qr-code` | Vendor food truck QR payload & sharing link |
| **QR & Check-In** | `POST` | `/api/v1/qr/:code/check-ins` | Smart check-in returning experience state & credit |
| **Rewards** | `POST` | `/api/v1/rewards/me/redemption-codes` | Generates 15-min token & 6-digit backup code |
| **Rewards** | `POST` | `/api/v1/vendors/me/redemptions/confirm` | Vendor confirms redemption via QR or 6-digit code |
| **Social** | `GET` | `/api/v1/social/feed/following` | Personalized feed from followed trucks |
| **Social** | `GET` | `/api/v1/social/feed/explore` | Explore feed across all trucks (newest/trending) |
| **Social** | `POST` | `/api/v1/social/posts` | Vendor creates post with media images |
| **Social** | `POST` | `/api/v1/social/posts/:id/like` | Toggle like on post |
| **Social** | `POST` | `/api/v1/social/posts/:id/share` | Share post & increment shareCount |
| **Social** | `GET` | `/api/v1/social/posts/:id/comments` | Fetch comments tree with 1-level nested replies |
| **Social** | `POST` | `/api/v1/social/posts/:id/comments` | Add comment or 1-level reply (auto-flattened) |
| **Social** | `POST` | `/api/v1/social/comments/:id/like` | Toggle like on a comment |
| **Bookings** | `POST` | `/api/v1/bookings` | Customer 5-step event booking request |
| **Bookings** | `POST` | `/api/v1/bookings/:id/quotes` | Vendor submits event quote |
| **Bookings** | `PATCH` | `/api/v1/bookings/:id/accept` | Accept booking request |
| **Payments** | `POST` | `/api/v1/payments/bookings/:id/payment-intent` | Stripe payment intent for booking |
| **Notifications**| `GET` | `/api/v1/notifications` | User notification list (All / Unread filter) |
| **Notifications**| `GET` | `/api/v1/notifications/unread-count` | Real-time unread badge counter |
| **Notifications**| `PATCH` | `/api/v1/notifications/read-all` | "Mark all read" button |
| **Notifications**| `POST` | `/api/v1/users/me/device-tokens` | Register FCM push token from device |
| **Leaderboards** | `GET` | `/api/v1/leaderboards/top-rated` | Top rated food trucks |
| **Leaderboards** | `GET` | `/api/v1/leaderboards/trending` | Trending food trucks in city |
