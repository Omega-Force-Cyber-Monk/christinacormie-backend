# BiteDrop — Previous Implementation vs. Current Client Additions

This document compares **what was previously implemented** versus **what the client has newly added / modified** in the latest update.

---

## 1. Quick Comparison Table

| # | Feature Area | Previous State (What We Had) | Current State (What Client Newly Added) |
| :- | :--- | :--- | :--- |
| **1** | **Platform Commission Rate** | Fixed static **20%** platform fee across all vendors and all bookings. | **Dynamic Tier-Based Commission**: Determined by vendor's active subscription tier:<br/>• **Free ($0/mo)** $\rightarrow$ **25%**<br/>• **Starter ($10/mo)** $\rightarrow$ **20%**<br/>• **Pro ($19/mo)** $\rightarrow$ **15%**<br/>• **Elite ($49/mo)** $\rightarrow$ **12%** |
| **2** | **Minimum Deposit Validation Rule** | Quotes with `DEPOSIT_ONLY` strictly required $\ge 20\%$ deposit. | Deposit percentage requirement dynamically matches vendor's tier ($\ge 25\%$, $\ge 20\%$, $\ge 15\%$, or $\ge 12\%$). |
| **3** | **Platform Business Scope** | Exclusively focused on **Event Bookings** (Catering, Parties, Festivals). | Expanding into **Daily Food Ordering**:<br/>• **Pickup** (Customer orders & picks up at truck)<br/>• **Delivery** (DoorDash Drive On-Demand API dispatches drivers). |
| **4** | **Delivery Logistics Strategy** | No food delivery system. | Bite Drop provides ordering UI/UX; **DoorDash Drive API** handles driver dispatch & delivery (Bite Drop does NOT employ drivers). |
| **5** | **Leaderboard & Gamification** | Rankings existed only for **Food Trucks** (Top-Rated, Most-Booked, Most-Visited, Trending). | Added **Dual Leaderboards**:<br/>• **Food Trucks**: Check-ins, bookings, ratings.<br/>• **Food Lovers**: QR check-ins & Bite Drop loyalty points earned. |
| **6** | **Food Lover (Customer) Onboarding** | Basic auth (Name, Email, Password, OTP verify, Preferred Cuisines). | **5-Step Onboarding Questionnaire**:<br/>Captures pain points finding trucks, event booking experience, and primary value drivers before account activation. |
| **7** | **Vendor (Truck Owner) Onboarding** | Basic truck profile creation (Truck name, logo, menu, service area, photo shoot). | **3-Step Business Profiling Survey**:<br/>Captures biggest challenges, current booking sources, and primary growth goals stored in database for analytics & marketing. |

---

## 2. Detailed Point-by-Point Breakdown

---

### 1. Vendor Pricing & Commission Structure

* **Previous State (Before)**:
  - Fixed 20% platform commission hardcoded or configured in `.env` (`PLATFORM_COMMISSION_RATE=0.20`).
  - Every quote with `DEPOSIT_ONLY` was validated to ensure deposit was at least 20% of the total quote amount.

* **Current State (Client Newly Added)**:
  - Vendor subscription tiers finalized:
    - **Free**: $0/month
    - **Starter**: $10/month
    - **Pro**: $19/month
    - **Elite**: $49/month
  - Commission is now **dynamic based on subscription**:
    - Free tier vendor booking $\rightarrow$ **25%** platform commission (Min deposit $\ge 25\%$).
    - Starter tier vendor booking $\rightarrow$ **20%** platform commission (Min deposit $\ge 20\%$).
    - Pro tier vendor booking $\rightarrow$ **15%** platform commission (Min deposit $\ge 15\%$).
    - Elite tier vendor booking $\rightarrow$ **12%** platform commission (Min deposit $\ge 12\%$).
  - Stripe split dynamically transfers the correct fee to Bite Drop LLC platform account based on vendor tier.

---

### 2. Platform Scope: Event Bookings vs. Online Food Ordering

* **Previous State (Before)**:
  - System was strictly designed for Event Bookings (Community Requests & Direct Profile Bookings).
  - Customers could only book food trucks for future dates/events.

* **Current State (Client Newly Added)**:
  - Client wants Bite Drop to expand beyond event bookings to allow direct daily food ordering:
    - **Pickup**: Customer orders food via app $\rightarrow$ pays via Stripe $\rightarrow$ picks up food directly from the truck.
    - **Delivery**: Customer orders food via app $\rightarrow$ pays food + delivery fee + tip $\rightarrow$ **DoorDash Drive On-Demand API** assigns a driver $\rightarrow$ driver picks up from truck and delivers to customer.
  - Client confirmed: Bite Drop will **NOT** manage or hire drivers. DoorDash handles all logistics.
  - Architectural requirement: Ensure current menu and database architecture can support adding pickup and delivery without rewriting the platform.

---

### 3. Leaderboards & Gamification

* **Previous State (Before)**:
  - Only Food Trucks were ranked (Top-Rated, Most-Booked, Most-Visited, Trending).
  - No ranking or public competitive leaderboard for regular customers/foodies.

* **Current State (Client Newly Added)**:
  - Add ranking functionality for **both Food Trucks and Food Lovers**:
    - **Food Trucks**: Ranked by check-ins, completed bookings, ratings, and engagement.
    - **Food Lovers**: Ranked by QR check-in frequency and total Bite Drop Points earned.
  - Goal: Drive user retention, repeated scans, and friendly community competition.

---

### 4. Food Lover (Foodie) Onboarding Flow

* **Previous State (Before)**:
  - Customer registered with Email, Password, Name $\rightarrow$ Verified 6-digit OTP $\rightarrow$ Selected preferred cuisines.

* **Current State (Client Newly Added)**:
  - 5-step visual questionnaire added to onboarding:
    1. **Screen 1**: Welcome screen ("Find food trucks near you, book events, earn rewards").
    2. **Screen 2 (Challenge)**: "What's the hardest part about finding food trucks?" (Knowing where they are, knowing when they're open, finding ones I'll like, keeping up with favorites).
    3. **Screen 3 (Events & Bookings)**: "Have you ever wanted a food truck for an event but didn't know where to start?" (Yes definitely, A few times, Not yet but I might, Just here to find food).
    4. **Screen 4 (What Matters Most)**: "What would make Bite Drop worth using for you?" (Finding trucks near me, Booking trucks for events, Earning rewards, Following favorites, Discovering new trucks).
    5. **Screen 5**: "You're all set!"

---

### 5. Food Truck Owner (Vendor) Onboarding Flow

* **Previous State (Before)**:
  - Vendor onboarding focused purely on profile setup: truck name, logo, menu, service area, photo shoot request, and payout account.

* **Current State (Client Newly Added)**:
  - 3-step business discovery survey added during vendor onboarding:
    1. **Screen 1 (Challenge)**: "What's your biggest challenge running your food truck?" (Getting discovered, finding events & bookings, keeping customers coming back, promoting location).
    2. **Screen 2 (Current Bookings)**: "How do you currently get most of your bookings?" (Social media, word of mouth, calls/texts/DMs, booking platforms, not many yet).
    3. **Screen 3 (Growth Goals)**: "What would help your food truck grow the most?" (More visibility, more event bookings, more followers, easier online management).
  - Responses stored directly in database for personalization, marketing segmentation, and analytics.
