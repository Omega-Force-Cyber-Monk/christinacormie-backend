# Check-In & Rewards Customer/Vendor Flow

This doc summarizes the customer and vendor/food truck app screens for QR check-in, rewards, credit redemption, and review points.

## Points Per Action

These are the intended customer reward points shown in the Figma flow.

| Action | Points |
| --- | ---: |
| QR code check-in | `+10` |
| Leave a verified review | `+25` |
| Follow a food truck | `+5` |
| Make a booking | `+100` |
| Community post | `+10` |
| Refer a friend | `+500` |
| Daily app streak | `+5` |
| Complete profile setup | `+50` |
| Birthday bonus | `+50` |

Implementation notes:

- QR code check-in points are awarded only once after the customer's first successful vendor QR scan.
- Follow food truck points are awarded once per truck, even if the customer unfollows and follows again.
- Review points should be awarded only after a verified review is submitted.
- Referral points should be awarded only after the referred friend qualifies according to the referral rule.
- Booking points should be awarded after a booking reaches the completed/qualified state, not only when the request is created.
- Profile setup points are awarded once when the required profile fields are complete.
- Birthday bonus is awarded once per year on the customer's birthday.
- Daily streak is awarded once per calendar day.
- Expired pending credit redemption codes should refund the reserved points.

## Customer Flow

### 1. QR Check-In

The vendor/food truck QR code is fixed for the truck. The customer opens the QR check-in screen and scans that QR code.

Only a first-time customer check-in can earn scan points. After the customer's first successful vendor QR check-in, the backend adds `+10` points to the customer's total points.

Possible outcomes:

- First-time eligible customer: check-in succeeds and customer earns `+10` points.
- Customer has enough points to redeem credit: app shows a prompt asking if they want to use available credit.
- Customer does not have enough redeemable credit: app shows the total points/progress page.
- Customer selects `No thanks`: app skips redemption and shows the total points/progress page.
- Existing/non-eligible customer: app shows a message like `You are not eligible for check-in points right now`.

### 2. Redeem Credit Prompt

If the first-time check-in succeeds and the customer has enough points to use credit, the app shows an available credit prompt after check-in.

Customer choices:

- `Yes, use it`: continue to redeem credit.
- `No thanks`: skip redemption and continue to the points/progress page.

### 3. Customer Redeems Credit

If the customer selects `Yes, use it`, the app shows how much credit is available.

Rules:

- Customer can redeem available credit during the visit.
- Maximum redemption per visit is `$5`.
- Customer cannot redeem more than their tier-based available credit.
- If a pending redemption code expires before vendor confirmation, the reserved points are refunded.
- The app generates a customer redemption QR code.
- The app also shows a 6-digit backup code.

Vendor approval is required before the credit is applied.

If the customer generated the redemption code for a specific food truck, only the owner vendor of that food truck can confirm it.

Vendor can approve by:

- Scanning the customer's redemption QR code.
- Manually entering the customer's 6-digit backup code.

After vendor approval, the customer sees a credit redeemed success screen.

### 4. Points/Progress Page

If the customer has no redeemable credit or selects `No thanks`, the app shows the points/progress page.

This screen shows:

- `+10` points earned from check-in.
- Customer total points.
- Current tier.
- Maximum points/progress target.
- Points needed for the next tier.

If the customer is not eligible for check-in points, the app should not show `+10` earned. It should show the not-eligible message and keep the customer's total points unchanged.

The customer can:

- View truck profile.
- Write a verified review and earn `+25` points.

### 5. Review After Check-In

After check-in, the customer can choose `Write a review and earn +25`.

The customer gives a rating and submits a review for the food truck.

After successful review submission:

- Customer earns `+25` more points.
- App shows the updated total points page.
- App shows tier/progress details again.

### Customer Screens

- QR check-in scanner.
- Credit prompt after check-in, if eligible.
- Redeem credit.
- Credit redeemed success.
- Points/progress page with `+10` check-in points.
- Review form.
- Review submitted page with `+25` review points.
- Customer rewards/profile page.

### 6. Customer Rewards/Profile Page

The customer profile page summarizes the user's reward status and account actions.

Main information:

- Customer name and current level.
- Available credit amount.
- Redeem button when credit is available.
- Progress to BiteDrop Legend.
- Current points and maximum points target.
- Tier badges and current tier.
- Recent reward activity.
- Points per action.

Tier badge examples:

- Foodie: `0 pts`
- Explorer: `500 pts`, `$5 credit`
- Drop Hunter: `2,000 pts`, `$10 credit`
- BiteDrop Legend: `10,000 pts`, `$25 credit`

Recent activity can show:

- Food truck name.
- Activity type, such as check-in, review, or booking.
- Location or short detail.
- Time.
- Points earned.

Additional customer actions:

- Invite Friends: customer can share an invite and earn `500` points for each friend who joins.
- Request a Truck: customer can suggest/request a food truck for the platform.
- Settings: customer can manage profile/account settings.
- Help & Support: customer can get help or submit a ticket.
- Sign Out: customer logs out of the app.

### Recommended API Design for Customer Rewards/Profile Page

Use one read API for the main rewards/profile page, and keep separate mutation APIs for actions.

Recommended read endpoint:

```http
GET /api/v1/rewards/me/profile-summary
Authorization: Bearer {{customerToken}}
```

Why one read API is better for this page:

- The screen needs profile, points, credit, tiers, badges, and recent activity together.
- One response keeps the Flutter UI simpler and avoids multiple loading states.
- Backend can calculate the current tier, next tier, available credit, progress percentage, and recent activity consistently.
- Action buttons can still call their own APIs.

Suggested response shape:

```json
{
  "profile": {
    "name": "Alex Rivera",
    "avatarUrl": "https://example.com/avatar.jpg",
    "level": 1
  },
  "loyalty": {
    "availablePoints": 2450,
    "lifetimePoints": 2450,
    "availableCreditAmount": 10,
    "maxRedeemPerVisit": 5,
    "currentTier": {
      "name": "Drop Hunter",
      "requiredPoints": 2000,
      "creditAmount": 10
    },
    "nextTier": {
      "name": "BiteDrop Legend",
      "requiredPoints": 10000,
      "pointsRemaining": 7550
    },
    "progress": {
      "current": 2450,
      "target": 10000,
      "percentage": 24.5
    }
  },
  "tiers": [
    {
      "name": "Foodie",
      "requiredPoints": 0,
      "creditAmount": 0,
      "isCurrent": false
    },
    {
      "name": "Explorer",
      "requiredPoints": 500,
      "creditAmount": 5,
      "isCurrent": false
    },
    {
      "name": "Drop Hunter",
      "requiredPoints": 2000,
      "creditAmount": 10,
      "isCurrent": true
    },
    {
      "name": "BiteDrop Legend",
      "requiredPoints": 10000,
      "creditAmount": 25,
      "isCurrent": false
    }
  ],
  "pointsPerAction": [
    { "action": "QR code check-in", "points": 10 },
    { "action": "Leave a verified review", "points": 25 },
    { "action": "Follow a food truck", "points": 5 },
    { "action": "Make a booking", "points": 100 },
    { "action": "Community post", "points": 10 },
    { "action": "Refer a friend", "points": 500 },
    { "action": "Daily app streak", "points": 5 },
    { "action": "Complete profile setup", "points": 50 },
    { "action": "Birthday bonus", "points": 50 }
  ],
  "recentActivity": [
    {
      "id": "activity-id",
      "type": "CHECK_IN",
      "title": "Taco Paradise",
      "subtitle": "Checked in at Union Square",
      "points": 50,
      "createdAt": "2026-09-07T08:00:00.000Z"
    }
  ],
  "actions": {
    "canRedeem": true,
    "canInviteFriends": true,
    "canRequestTruck": true
  }
}
```

Mutation/action APIs should stay separate:

- Redeem credit: `POST /api/v1/rewards/me/redemption-codes`
- Claim daily app streak: `POST /api/v1/rewards/me/daily-streak`
- Claim birthday bonus: `POST /api/v1/rewards/me/birthday-bonus`
- Referral/invite code: `GET /api/v1/referrals/codes` and `POST /api/v1/referrals/codes`
- Request a truck: `POST /api/v1/community/new-food-truck-leads`
- Settings/profile update: `PATCH /api/v1/users/me/profile`, `PATCH /api/v1/users/me/settings`
- Logout: `POST /api/v1/auth/logout`

## Vendor/Food Truck Flow

### 1. QR Code Actions

The vendor opens the QR Code action sheet from the food truck app.

Main actions:

- Show My QR Code: displays the food truck QR code for customers to scan.
- Scan Customer QR: opens the redemption scanner to apply customer credit.

### 2. Show My QR Code

The vendor can display the fixed BiteDrop QR code for the truck. Customers scan this QR to check in, view the truck profile, and start rewards engagement.

Only first-time eligible customers earn `+10` points from scanning this vendor QR code. Existing customers should see the not-eligible message instead of earning repeat scan points.

The vendor can:

- Download the QR code.
- Share the QR code.
- Close the QR modal and return to the food truck profile/home screen.

### 3. Redeem Customer Credit

When a customer wants to use available BiteDrop credit, the vendor opens Redeem Credit from the food truck app.

Vendor has two confirmation options:

- Scan QR: scan the customer's redemption QR code.
- Manual Code: enter the 6-digit backup code from the customer's screen.

### 4. Scan QR Redemption

The vendor positions the customer's redemption QR code inside the scanner frame, then confirms redemption.

If the redemption token is valid, the backend applies the selected credit amount to that food truck transaction.

### 5. Manual Code Redemption

The vendor enters the customer's 6-digit backup code and confirms redemption.

This is used when QR scanning fails or staff prefers manual entry.

### 6. Redemption Complete

After confirmation, the vendor sees a success screen showing the credit amount applied and customer name.

The vendor can return to home after the redemption is complete.

### Vendor/Food Truck Screens

- QR Code action sheet.
- Show My QR Code modal.
- Redeem Credit with Scan QR tab.
- Redeem Credit with Manual Code tab.
- Redemption complete success screen.

## Related APIs

- `POST /api/v1/qr/:qrCode/check-ins`
- `GET /api/v1/rewards/me/profile-summary`
- `POST /api/v1/rewards/me/redemption-codes`
- `POST /api/v1/rewards/me/daily-streak`
- `POST /api/v1/rewards/me/birthday-bonus`
- `POST /api/v1/vendors/me/redemptions/confirm`
- Review submission API, depending on the current reviews module route.
