# Bite Drop Project Documentation

## 1. Project Overview

Bite Drop is a food truck discovery, booking, rewards, and vendor management platform. The system connects Foodies/customers with approved food truck vendors and gives vendors tools to manage their business presence, bookings, rewards, staff, payouts, and customer engagement.

The platform is designed for both mobile app users and admin/dashboard users.

## 2. Project Purpose

The main purpose of Bite Drop is to make food truck discovery and booking easier for customers while giving vendors a structured platform to receive bookings, manage their truck profile, participate in rewards, and grow their business.

The system supports:

- Food truck discovery
- Customer booking requests
- Vendor quotes and booking management
- Stripe-based vendor payout setup
- Bite Drop Rewards and QR redemption
- Vendor verification and approval
- Admin management and reporting
- Community and social engagement
- Messaging and notifications

## 3. Main User Types

### 3.1 Foodie / Customer

Foodies are normal app users who can discover food trucks, follow vendors, earn points, redeem rewards, create booking requests, accept vendor quotes, complete payments, and leave reviews.

Main customer activities:

- Create account or login
- Browse food trucks
- Follow/favorite food trucks
- Create event/booking requests
- Accept vendor quotes
- Pay booking deposit/payment
- Earn loyalty points
- Redeem Bite Drop Rewards
- Review vendors after verified booking/redemption

### 3.2 Vendor

Vendors are food truck owners or business operators. Vendors must complete onboarding and verification before accessing approved-vendor features.

Main vendor activities:

- Register/login
- Complete vendor profile
- Add truck/business information
- Upload verification documents
- Submit for admin approval
- Set up Stripe payout account
- Select/manage subscription plan
- View booking requests
- Send quotes
- Manage staff
- Confirm reward redemptions
- View analytics

### 3.3 Vendor Staff

Vendor staff are users created by a vendor to help manage limited vendor operations.

Main staff activities:

- Login with email and PIN
- Access allowed vendor tools
- Confirm redemptions if permitted
- View assigned vendor-related data

### 3.4 Admin

Admins manage the full platform from the backend/admin dashboard.

Main admin activities:

- Manage users
- Manage vendors
- Review and approve vendor verification
- Manage food trucks
- Manage bookings
- Manage payments/payouts/refunds
- Manage rewards and badges
- View reports and analytics
- Moderate reviews/community content
- Manage platform settings

## 4. Core Product Modules

## 4.1 Authentication

The authentication module handles account creation, login, Firebase social auth, email verification, password reset, and staff login.

Supported auth flows:

- Customer email/password signup
- Vendor email/password signup
- Email verification with 6-digit code
- Login with email/password
- Staff login with email and 4-digit PIN
- Firebase Google/Apple login
- Refresh token
- Logout

Firebase Google/Apple login uses Firebase ID token verification on the backend.

## 4.2 Vendor Onboarding and Verification

Vendor onboarding allows a vendor to create and complete their business profile before becoming approved.

Vendor onboarding includes:

- Basic profile information
- Business/truck information
- Logo/images
- Cuisine type
- Operating location/area
- Service radius
- Capacity
- Verification documents
- Submission for admin review

Vendor status controls feature access. Pending vendors can update their profile and submit verification, but cannot access approved-vendor features.

Approved-vendor-only features include:

- Booking actions
- Quote actions
- Staff management
- QR/check-in/reward redemption
- Vendor analytics
- Promotions
- Public active food truck visibility where approval is required

## 4.3 Food Truck Discovery

The discovery system helps customers find food trucks by location, filters, popularity, and profile information.

Discovery can include:

- Nearby food trucks
- Trending food trucks
- Food truck profiles
- Cuisine filters
- Location-based search
- Reviews and ratings
- Open/closed status
- Vendor profile details

## 4.4 Booking and Quotes

Customers can create booking/event requests and vendors can respond with quotes.

Main booking flow:

1. Customer creates request or booking.
2. Vendor reviews request.
3. Vendor sends quote.
4. Customer accepts quote.
5. Customer pays required amount.
6. Booking becomes confirmed/deposited.
7. Event day status becomes active.
8. Vendor sends completion request.
9. Customer approves completion or reports issue.
10. Payment release/payout flow proceeds based on completion status.

The booking status timeline is designed to show clear progress for both customer and vendor.

## 4.5 Payments and Stripe Connect

Payments are handled with Stripe. Vendor payout setup is handled through Stripe Connect.

Current payment purposes:

- Customer booking payments
- Platform commission
- Vendor payout after approved completion
- Refunds if issue/cancellation rules apply

Vendor payout setup:

- Vendor creates/continues Stripe Connect onboarding.
- Vendor completes Stripe onboarding.
- Backend tracks:
  - onboarding completed
  - charges enabled
  - payouts enabled
  - disabled reason
  - Stripe requirements

Ready payout status requires:

- onboarding completed
- charges enabled
- payouts enabled
- no disabled reason
- no blocking Stripe requirements

## 4.6 Vendor Subscriptions and Founding Plans

Vendor plans define which features and limits a vendor can access.

Plans include:

- Free
- Starter
- Pro
- Elite

Subscription information includes:

- plan name
- monthly price
- commission rate
- features
- limits
- founding vendor eligibility
- active/inactive subscription status

Founding vendor rules are designed for the pre-launch window. Vendors who qualify during the founding period can receive special pricing/commission benefits.

## 4.7 Bite Drop Rewards

Bite Drop Rewards allows Foodies to earn points and redeem them for rewards at approved food trucks.

Core reward flow:

1. Foodie earns points.
2. Foodie chooses a reward.
3. Backend creates redemption token/code.
4. Foodie shows QR/code to vendor.
5. Vendor scans or enters code.
6. Backend validates redemption.
7. Vendor confirms redemption.
8. Reward becomes completed and cannot be reused.
9. Vendor manually applies discount in their POS/register.

Current backend supports the core redemption concept, but additional campaign controls like Vendor Funded/Bite Drop Funded, minimum purchase, and campaign limits may still need final implementation depending on client confirmation.

## 4.8 Reviews

Reviews allow customers to rate vendors after verified interactions.

Review eligibility can be based on:

- completed booking
- confirmed reward redemption

This prevents random/unverified reviews.

## 4.9 Messaging and Notifications

The platform supports messaging and notifications between users, vendors, and admin workflows.

Messaging can be used for:

- booking-related conversations
- customer/vendor communication
- admin support-style message visibility

Notifications can be used for:

- booking updates
- payment updates
- vendor verification
- rewards
- admin alerts

## 4.10 Community and Social

Community features allow customers and vendors to interact beyond direct bookings.

Features may include:

- community posts
- food truck requests
- vendor offers
- post reports
- hide/copy/share actions
- comments and reactions

Vendor community actions are expected to be gated by approval status.

## 4.11 Admin Dashboard

The admin dashboard is the control center for platform management.

Admin can manage:

- users
- vendors
- food trucks
- verification requests
- bookings
- payments
- payouts
- refunds
- commissions
- rewards
- badges
- reviews
- reports
- platform settings

## 5. High-Level System Flow

```text
Customer/Foodie
  → discovers food truck
  → follows/views profile
  → books or creates request
  → accepts quote
  → pays through Stripe
  → completes booking
  → earns/redeems rewards
  → leaves verified review

Vendor
  → signs up
  → completes onboarding
  → submits verification
  → admin approves
  → sets up Stripe payout
  → selects/maintains plan
  → receives bookings
  → sends quotes
  → confirms rewards
  → receives payout after completion

Admin
  → reviews vendors
  → manages platform data
  → monitors payments/payouts
  → manages rewards/campaigns
  → moderates content
  → views reports
```

## 6. Backend Purpose

The backend is responsible for:

- user authentication
- role-based access control
- vendor onboarding and approval rules
- booking and quote logic
- payment and payout coordination
- subscription and plan state
- reward points and redemption validation
- notification and messaging APIs
- admin management APIs
- data validation and error handling
- persistence through PostgreSQL/Prisma

## 7. Frontend/App Purpose

The frontend/mobile app is responsible for:

- displaying screens and forms
- collecting user input
- handling Firebase Google/Apple login
- showing QR codes
- scanning QR codes
- showing onboarding status
- opening Stripe onboarding URLs
- showing plan/subscription information
- calling backend APIs
- routing users based on backend status

The frontend should not independently decide sensitive business rules such as vendor approval, payout readiness, or reward validity. These should come from backend responses.

## 8. Important Business Rules

### Vendor approval rule

Vendors must be approved before using approved-vendor features.

### Payout readiness rule

Vendors must complete Stripe payout setup before customer payments can be accepted for bookings.

### Reward redemption rule

Reward redemption codes must be single-use and confirmed by an approved vendor.

### Review eligibility rule

Customers should only review vendors after verified booking or confirmed reward redemption.

### Subscription rule

Paid vendor features should depend on active subscription/plan status.

## 9. Project Goal Before Launch

The main launch goal is to make the vendor side clear and stable before marketing-driven vendor onboarding.

Launch readiness focus:

- vendor signup/login
- vendor onboarding
- vendor verification
- admin approval
- Stripe payout setup
- subscription/plan visibility
- booking readiness
- rewards redemption clarity
- vendor feature gating
- clear Flutter/mobile handoff

## 10. Summary

Bite Drop is a marketplace-style food truck platform that combines discovery, bookings, rewards, vendor verification, subscriptions, payments, and admin management.

The system’s main purpose is to help customers find and book food trucks while giving approved vendors the tools they need to manage bookings, accept payments, participate in rewards, and grow their business through the Bite Drop platform.
