# Customer and Vendor Community Post Flow Plan

## Document Status

- Status: Implemented in source on 2026-09-12; database migration must be applied before use. See section 11 for the delivered contract and chosen defaults.
- Scope: Shared customer/vendor Community screens, post creation, and related request/quote flows shown in Figma.
- The filename is retained so existing links continue to work.
- Implementation was authorized by the user after the customer/vendor alignment review.
- Sections 1–10 retain the planning/audit history; section 11 supersedes historical missing/partial labels and proposals.
- This document will be updated as each requirement is confirmed.

## 1. Figma Flow Summary

From the Community screen, both customers and vendors can select one of these post types, as clarified by the vendor Figma supplied on 2026-09-12:

1. Need a truck
2. Vendor callout
3. For sale
4. Hiring/jobs
5. Community help
6. Community

The Community screen also includes:

- All Posts
- My Posts
- Requests
- Category filters such as Community, Need a truck, and Callout
- Location and distance filtering

## 2. Current Backend Structure

The backend currently has two separate concepts.

### 2.1 Vendor Social Posts

Endpoint:

```http
POST /api/v1/social/posts
```

Current behavior:

- Only a user with the `VENDOR` role can create a social post.
- The vendor must be approved and verified.
- A valid vendor-owned `foodTruckId` is required.
- The post supports content and media URLs.
- Published posts can notify followers.
- Like, comment, share, save, and feed APIs already exist.

This endpoint is not suitable for the customer-side Figma flow because a customer does not own a food truck and cannot call this route.

### 2.2 Customer Community Requests

Primary endpoint:

```http
POST /api/v1/community/requests
```

Related endpoints:

```http
GET  /api/v1/community/requests/open
GET  /api/v1/community/requests/mine
GET  /api/v1/community/requests/:requestId
POST /api/v1/community/requests/:requestId/media
POST /api/v1/community/requests/:requestId/comments
POST /api/v1/community/requests/:requestId/reactions
POST /api/v1/community/requests/:requestId/offers
GET  /api/v1/community/requests/:requestId/offers
```

Current request data supports:

- Request type
- Event type
- Title and description
- Event date
- Start and end time
- Time zone
- Expected guest count
- Minimum and maximum budget
- Address
- Contact phone
- Latitude and longitude
- Preferred cuisines
- Preferred menu item names
- Public comments setting
- Expiration date
- Media URLs

The request system also supports vendor offers, customer offer decisions, and conversion of an accepted offer into a booking.

## 3. Current Implementation Status by Figma Post Type

| Figma post type | Current status | Notes |
| --- | --- | --- |
| Need a truck | Mostly implemented | Existing Community Request flow already contains most event/request fields and the vendor-offer workflow. |
| Vendor callout | Partial workaround only | Description and media could be saved, but there is no dedicated category or category-specific behavior. |
| For sale | Partial workaround only | `title` could hold the item name, but there is no explicit post category or proper validation. |
| Hiring/jobs | Partial workaround only | Description and media could be saved, but it cannot be identified reliably as a hiring post. |
| Community help | Partial workaround only | Can be stored as a generic request, but its meaning cannot be distinguished. |
| Community | Partial workaround only | Generic content can be stored, but this is not currently a proper customer social-post flow. |

## 4. Need-a-Truck Field Mapping

| Figma field | Existing backend field | Status |
| --- | --- | --- |
| Event Type | `eventType` | Implemented |
| Event Date | `eventDate` | Implemented |
| Event Time | `startTime`, optionally `endTime` | Implemented |
| Location | `address`, optionally `latitude` and `longitude` | Implemented |
| Expected Guests | `guestCount` | Implemented |
| Budget Range | `budgetMin`, `budgetMax` | Implemented |
| Event Description | `description` | Implemented |
| Preferred Menu Items | `preferredMenuItems` | Implemented as text values |
| Add Item | Additional text in `preferredMenuItems` | Supported by the data structure |
| Vendor offers/quotes | Community vendor-offer APIs | Implemented |
| Accepted offer becomes booking | Offer acceptance flow | Implemented |

Supported event types already match the unique Figma choices:

- `CORPORATE_EVENT`
- `BIRTHDAY_PARTY`
- `WEDDING_RECEPTION`
- `GRADUATION_PARTY`
- `COMMUNITY_EVENT`
- `FUNDRAISER`
- `OTHER`

The duplicate “Corporate Event” shown in the Figma dropdown appears to be a design duplication and should not become a duplicate backend enum value.

## 5. Gaps That Still Need a Final Decision

### 5.1 Post Category

The backend does not currently have a field that represents the six shared Figma Community post types.

Proposed values:

```text
NEED_TRUCK
VENDOR_CALLOUT
FOR_SALE
HIRING_JOBS
COMMUNITY_HELP
COMMUNITY
```

Working recommendation: extend the existing Community Request data model with a dedicated category field shared by customers and vendors. Vendor food-truck Social Posts remain a separate existing feature.

### 5.2 Category-Specific Fields and Validation

The create DTO currently makes most fields optional. The final implementation should validate fields based on the selected category.

Proposed rules:

- `NEED_TRUCK`: event type, date, time, location, guest count, and description should be required according to the final product rules.
- `FOR_SALE`: item name/title and item description should be required.
- `VENDOR_CALLOUT`: description should be required.
- `HIRING_JOBS`: job description should be required.
- `COMMUNITY_HELP`: description should be required.
- `COMMUNITY`: post content/description should be required.

The exact required fields remain open until confirmed.

### 5.3 File Upload

The current Community API accepts previously uploaded media URLs, but it does not provide a Community-specific multipart upload endpoint.

Figma requires:

- JPG
- PNG
- PDF
- Maximum 5 files

Proposed upload endpoint:

```http
POST /api/v1/community/media/upload
```

The Flutter app would upload files first, receive their URLs, and include those URLs when creating the post. The user still experiences this as one Post button action because Flutter can perform both API calls sequentially.

Required backend validation:

- Maximum 5 files
- Allowed MIME types only
- Maximum file size
- Clear unsupported-file and upload-failure errors

### 5.4 Feed and Filtering

The existing APIs can list open requests and the authenticated user's requests, but they do not support the complete Figma filters, pagination, or a unified customer Community feed.

Proposed API shape:

```http
GET /api/v1/community/posts
GET /api/v1/community/posts/mine
GET /api/v1/community/posts?category=NEED_TRUCK
```

Possible query parameters:

```text
category
latitude
longitude
radiusKm
cursor
limit
```

The meaning of the Figma `Requests` tab must be confirmed before its endpoint is finalized.

### 5.5 Update and Delete

Community request comments and reactions exist, but an owner-facing update/delete flow is not currently exposed.

Proposed endpoints:

```http
PATCH  /api/v1/community/posts/:postId
DELETE /api/v1/community/posts/:postId
```

Only the post owner should be able to update or delete it. Admin moderation remains a separate flow.

### 5.6 Vendor Offers

Vendor offer creation must only be allowed for posts that actually request a truck.

Proposed rule:

```text
postCategory === NEED_TRUCK
```

For Sale, Hiring/jobs, Vendor callout, Community help, and Community posts must not enter the vendor quote/booking workflow.

### 5.7 Authentication and Role Rules

The current public-request create route requires authentication but is not explicitly restricted to the `CUSTOMER` role.

The vendor Figma supplied on 2026-09-12 resolves the earlier customer-only assumption: both customers and vendors have the same six post-creation choices.

Use the same Community endpoints and category validation for both roles. Derive ownership from the authenticated user; do not trust an author ID or author role submitted in the body.

The current JWT-only create route already permits an authenticated vendor to submit a generic request. That is partial support, not a complete category-based implementation or a deliberate vendor approval policy.

Working recommendation: require approved/verified vendor status for vendor Community publishing and responding, reusing the existing approval checks. This publishing policy remains a proposal; quote submission already enforces approval.

Post-owner actions must work for both roles. A vendor creating a Need-a-Truck post acts as its organizer/requester; another vendor acts as the service provider. Prevent the same user from quoting or expressing interest in their own post.

### 5.8 Rewards and Abuse Protection

Creating a public Community request currently triggers the `COMMUNITY_POST` reward action.

Before all six categories use the same flow, the following must be confirmed:

- Whether every category awards community-post points
- Whether points are awarded once per post or subject to a daily/lifetime limit
- Whether deleting and recreating posts can award points again

## 6. Proposed API Direction — Not Yet Final

Recommended public API:

```http
POST   /api/v1/community/posts
GET    /api/v1/community/posts
GET    /api/v1/community/posts/mine
GET    /api/v1/community/posts/:postId
PATCH  /api/v1/community/posts/:postId
DELETE /api/v1/community/posts/:postId

POST   /api/v1/community/media/upload

POST   /api/v1/community/posts/:postId/comments
POST   /api/v1/community/posts/:postId/reactions

POST   /api/v1/community/posts/:postId/offers
GET    /api/v1/community/posts/:postId/offers
```

The existing `/community/requests` routes may be retained temporarily for backward compatibility or internally mapped to the new Community post service. The exact migration strategy will be selected after the flow is finalized.

## 7. Proposed Implementation Order

After all requirements are approved:

1. Finalize category names and who can create each category.
2. Finalize required fields for every category.
3. Finalize the meaning of All Posts, My Posts, and Requests.
4. Update the Prisma schema and create a database migration.
5. Add or update DTOs with conditional validation.
6. Implement create, list, details, update, and delete operations.
7. Add the Community media-upload endpoint and file validation.
8. Restrict vendor offers to Need-a-Truck posts.
9. Apply reward eligibility and anti-duplication rules.
10. Add consistent success and error responses to Swagger.
11. Document manual checks for the final API flow, following the user's testing preference.

## 8. Decisions Log

| Date | Requirement/clarification | Impact |
| --- | --- | --- |
| 2026-09-12 | Customer can request a specific vendor directly or publish a public Need-a-Truck request. | Retain direct booking quotes and public Community offers as two entry paths. |
| 2026-09-12 | Vendor Community creation uses the same six choices and forms as customer Community creation. | Shared Community API and validation; replace the previous customer-only assumption. |

These clarifications establish the shared direction. Endpoint naming, financial rules, and other open decisions remain proposals until the full flow is finalized.

## 9. Vendor Request and Quote Flow Audit

### 9.1 Figma Flow Summary

The supplied vendor-side Figma contains two related actions:

1. A vendor sees a customer Need-a-Truck request and sends a price quote.
2. A vendor sees a Vendor Callout post and sends a short expression of interest.

These are different business actions and should not share the same payload or status lifecycle.

### 9.2 Need-a-Truck Quote — Current Status

The main quote submission flow is already implemented through:

```http
GET  /api/v1/community/requests/open
POST /api/v1/community/requests/:requestId/offers
```

The quote endpoint is vendor-only. The backend also verifies that:

- The vendor profile exists.
- The vendor is approved and verified.
- The selected food truck exists and is active.
- The food truck belongs to the authenticated vendor.
- The customer request is open and has not expired.
- A private request is being answered by its targeted food truck.

Current quote data supports:

| Figma field/action | Existing backend field | Status |
| --- | --- | --- |
| Customer request summary | Community Request details | Implemented |
| Flat fee | `pricingModel: FLAT_FEE` | Implemented |
| Per person | `pricingModel: PER_PERSON` | Partial — stored, but no automatic guest-count calculation exists |
| Add menu items | `selectedMenuItems: string[]` | Implemented as text values |
| Base service fee | `baseServiceFee` | Implemented |
| Transport/travel fee | `transportFee` | Implemented |
| Additional charge lines | `extraCharges[]` | Implemented |
| Service fee | `serviceFee` | Implemented |
| Tax | `taxAmount` | Implemented |
| Discount | `discountAmount` | Implemented |
| Deposit only | `paymentPreference: DEPOSIT_ONLY` | Implemented |
| Prepaid in full | `paymentPreference: PREPAID_IN_FULL` | Implemented |
| No preference | `paymentPreference: NO_PREFERENCE` | Implemented, although not shown on this vendor Figma screen |
| Deposit amount | `depositAmount` | Implemented |
| Deposit percentage | `depositPercent` | Implemented |
| Balance at event | `balanceDueAtEvent` | Implemented and can be derived |
| Note to client | `noteToClient` | Implemented |
| Quote expiration | `expiresAt` | Implemented |
| Platform commission | `commissionAmount` | Implemented |
| Vendor amount received through app | `vendorNetAmount` | Implemented |
| Send quote | Create vendor offer endpoint | Implemented |

After a quote is sent:

- The customer can list quotes.
- The customer can accept or reject a quote.
- The vendor can withdraw a pending quote.
- Accepting a quote rejects other pending quotes for the same request.
- Accepting a quote creates the associated booking and payment-pending flow.

### 9.3 Need-a-Truck Quote — Missing or Partial

The following parts are not fully implemented:

#### Vendor Request Inbox

`GET /api/v1/community/requests/open` returns all open requests, but it currently has no:

- Cursor pagination
- Category filter
- Location/radius filter
- Vendor-specific ignored-item filtering
- Dedicated counts for Bookings, Community, and Messages tabs

#### Ignore Button

There is no backend operation for the Figma `Ignore` button.

If Ignore should only hide the card until the page refreshes, Flutter can handle it locally. If the request must remain hidden for that vendor across devices and sessions, backend persistence and an endpoint are required.

Proposed persistent action:

```http
POST /api/v1/community/posts/:postId/ignore
```

This decision is still open.

#### Duplicate Quote Protection

The database currently allows the same vendor/food truck to create multiple offers for the same customer request. The final flow must decide whether a vendor should:

- Have only one active quote and edit it, or
- Be allowed to send revised quotes as separate records.

Working recommendation: one active offer per vendor food truck and request, with an update endpoint for revisions.

#### Per-Person Pricing

The `PER_PERSON` value is stored, but the backend has no `pricePerPerson` field and does not calculate:

```text
price per person × expected guests
```

If the vendor UI must calculate per-person pricing automatically, a `pricePerPerson` field and backend calculation/validation are required.

#### Required Quote Fields

Several quote fields are currently optional, including pricing model and payment preference. The Figma requires a deliberate selection before Send Quote.

The final validation should confirm which fields are mandatory. The working recommendation is:

- `foodTruckId`
- `pricingModel`
- At least one selected/custom menu item if the product requires it
- A valid base/quoted amount
- `paymentPreference`
- Valid deposit data when payment preference is `DEPOSIT_ONLY`

#### Deposit Consistency

The API permits both `depositAmount` and `depositPercent`, but it does not currently reject contradictory values. The final contract should accept one source of truth or verify that both calculate to the same amount.

Working recommendation: Flutter sends `depositPercent`; the backend calculates and returns `depositAmount`.

#### Commission Configuration

The Figma displays a 15% commission. The code calculates commission using `PLATFORM_COMMISSION_RATE`, but the current fallbacks/configuration are inconsistent:

- Some quote code falls back to 20%.
- `.env.example` currently shows 10%.
- Figma shows 15%.

Before implementation is finalized, one platform commission rate must be approved and applied consistently to quotes, bookings, and payments.

For the Figma example, a $1,250 quote at 15% gives:

```text
Commission: $187.50
Deposit collected: $240.00
Vendor receives through app after commission: $52.50
```

The Figma's displayed balance-at-event amount does not reconcile with the other displayed values. The backend should use a single documented formula rather than copying inconsistent mock numbers.

Recommended formula:

```text
quote total = base fee + transport + extra charges + service fee + tax - discount
deposit amount = quote total × deposit percentage
balance at event = quote total - deposit amount
commission = quote total × platform commission rate
vendor received through app = max(deposit amount - commission, 0)
```

#### Swagger Response Contract

The Community controller does not yet document complete quote success/error examples. These should be added after the business rules are finalized.

### 9.4 Vendor Callout Interest — Current Status

The Vendor Callout card and its `I'm interested` action are not currently implemented as a distinct backend flow.

Missing concepts include:

- Vendor Callout post category
- Number of available spots
- Vendor interest record
- Interest message
- Interested-vendor count
- Pass/ignore action
- Preventing duplicate interest from the same vendor
- Customer-side list of interested vendors

Proposed endpoints, subject to final approval:

```http
POST   /api/v1/community/posts/:postId/interests
GET    /api/v1/community/posts/:postId/interests
DELETE /api/v1/community/posts/:postId/interests/me
```

Example interest payload:

```json
{
  "foodTruckId": "vendor-food-truck-id",
  "message": "Taco Paradise would be a great fit for this event."
}
```

This interest action should not create a price quote, booking, or payment automatically.

### 9.5 Vendor Quote Audit Verdict

- Need-a-Truck Send Quote: mostly implemented.
- Quote financial fields: mostly implemented, but rules/configuration require correction and final approval.
- Vendor request inbox behavior: partial.
- Ignore/Pass: not implemented as persistent backend actions.
- Vendor Callout interest: not implemented.
- Customer quote acceptance to booking: implemented.

## 10. Shared Customer/Vendor Alignment and Implementation Gaps

Audit basis: supplied customer and vendor screenshots plus source inspection on 2026-09-12. This is a code audit, not a runtime test. Application code has not been changed during this planning review.

### 10.1 Shared Forms

| Category | Customer creates | Vendor creates | Form mapping and gap |
| --- | --- | --- | --- |
| Need a truck | Yes | Yes | Event type/date/time, location, guests, budget, description, menu tags and custom text already have storage fields. Category-specific required validation is missing. |
| Vendor callout | Yes | Yes | Description plus optional attachments; dedicated category and vendor-interest workflow are missing. |
| For sale | Yes | Yes | Item name maps to `title`, item description maps to `description`; enforce both as nonblank. Dedicated category is missing. |
| Hiring/jobs | Yes | Yes | Description plus optional attachments; dedicated category and content validation are missing. |
| Community help | Yes | Yes | Category tile is shown, but a distinct detail form is not clearly supplied. Reusing description/attachments is a proposal. |
| Community | Yes | Yes | Description plus optional attachments; dedicated category and content validation are missing. |

Need-a-Truck menu choices are general preference names, not menu records owned by a selected food truck. Preset values such as Tacos and Burgers and custom Add Item values can share `preferredMenuItems: string[]`. Trim values, reject blank entries, deduplicate, and apply reasonable count/length limits.

The two Community screenshots use the same forms; separate customer/vendor create endpoints are unnecessary. Responses should identify the author and expose allowed actions for the viewer, with the backend checking ownership and permissions on every mutation.

The photos/fliers forms specify optional attachments, recommended for For Sale, with a maximum of five JPG/PNG/PDF files. Enforce the total limit when creating, editing, and adding media individually. The current media DTO only validates a URL and a short media-type string.

### 10.2 Direct Requests and Public Requests

| Request source | Existing creation endpoint | Existing vendor quote endpoint | Intended audience |
| --- | --- | --- | --- |
| Direct customer booking | `POST /api/v1/bookings` | `POST /api/v1/bookings/:bookingId/quotes` | The selected vendor |
| Public Need-a-Truck post by customer or vendor | `POST /api/v1/community/requests` | `POST /api/v1/community/requests/:requestId/offers` | Eligible vendors browsing public requests |

Both paths can reuse the same Flutter quote form, adapting its payload to the existing endpoints. Align calculation and validation rules across both paths. The proposed `/community/posts` naming is still optional; it does not require replacing the direct bookings API.

For direct requests, the existing booking moves to QUOTED, then PAYMENT_PENDING when its owner accepts a quote. For public requests, the chosen offer is accepted, other pending offers are rejected, and a booking is created for payment.

The existing private Community request endpoint is an additional current route. Decide how existing consumers will be supported before consolidating any overlapping entry paths.

### 10.3 Newly Identified Code Gaps

1. **Public-list visibility:** `CommunityRepository.listOpenRequests()` filters only on `deletedAt` and `status: OPEN`. It does not filter `visibility: PUBLIC`, so private requests can appear in that list. Add the public visibility filter and keep targeted private requests in an authorized inbox. Also exclude expired requests from actionable results.
2. **Self-quotes:** `CommunityService.createVendorOffer()` checks truck ownership, request state, and private targeting, but does not reject `request.createdById === userId`. Add this check before supporting vendor-created requests explicitly. Apply the same rule to the proposed interest action.
3. **Organizer versus provider:** accept/reject already checks `createdById`, which supports a vendor acting as organizer. Offer acceptance assigns that user to `Booking.customerId`. Audit booking lists, payment authorization, notifications, and labels so a vendor organizer can pay and see their outgoing order without confusing it with incoming vendor work.
4. **Creator identity:** existing request responses include the user display name/avatar, but not a complete vendor/customer author presentation. Define the appropriate role badge and vendor display data for shared feed cards.
5. **Reward eligibility:** public request creation invokes `COMMUNITY_POST` for the creator. Confirm vendor eligibility and category limits before expanding publishing. Do not infer vendor rewards merely from shared UI.
6. **Callout form/card mismatch:** the creation screenshot only asks for description and attachments, while the earlier callout card displays date, venue, attendance range, and spots open. Those values cannot be reliably derived from prose. Decide whether to add optional structured form fields or simplify the card; do not fabricate them.

### 10.4 Shared Feed and Actions

- All Posts: public Community content from both customer and vendor authors, with category/location filters and pagination.
- My Posts: authenticated user's own Community posts, regardless of role. Existing `requests/mine` already filters by creator, but has no category filtering or pagination.
- Requests: final tab semantics remain open. Keep organizer requests/received offers distinct from a service vendor's incoming opportunities and submitted offers.
- Need-a-Truck: eligible vendors may send quotes; the organizer may review and select offers.
- Vendor Callout: eligible vendors may send an interest message; the organizer may view interested vendors. No automatic paid booking follows an interest message.
- For Sale, Hiring/jobs, Community help, Community: regular Community interactions; no catering quote workflow.

### 10.5 Implementation Sequence After Flow Finalization

1. Add shared categories and conditional form validation to Community; preserve existing request records and API consumers.
2. Apply explicit customer/vendor publishing permissions, owner actions, private visibility, and self-response checks.
3. Add shared upload support and enforce five-file/type/size limits across media entry points.
4. Implement filtered/paginated All Posts and My Posts responses with useful author/action data.
5. Align direct booking quotes and Community offers, including per-person pricing, totals, deposit, commission, and quote revision rules described in section 9.
6. Support the vendor-as-organizer path through acceptance, booking, and payment.
7. Implement callout interests and persistent Ignore/Pass if finalized, resolving the callout form/card fields first.
8. Complete success/error examples and the manual testing guide for both roles, following the user's testing preference.

Pending product choices: vendor approval for publishing, required/optional form fields, Requests-tab semantics, callout structured data, commission/deposit policy, quote revision policy, Ignore persistence, and vendor reward eligibility. These remain open; the shared six-category UI is now established.

## 11. Delivered Implementation — 2026-09-12

Customer and approved/verified Vendor accounts now share `/api/v1/community/posts`. Existing `/community/requests` and direct `/bookings` endpoints remain available. This is backend implementation only; Flutter screens still need integration.

### Implemented

- Six categories with category-specific content checks. Need-a-Truck requires event type, date, start time, address, guest count, and description. For Sale requires item name (`title`) and description. Other categories require description.
- Preferred menu names and custom items use the same text array. Blank values are rejected and duplicates removed.
- Optional callout date/time/address and structured `spotsOpen`, `attendanceMin`, `attendanceMax`; no data is inferred from prose.
- Shared create/details/list/mine/edit/soft-delete endpoints with success and error examples in Swagger.
- Category/location filters and offset pagination. The Requests tab means open public Need-a-Truck and Callout opportunities posted by other users.
- Author profile/roles, counts, current-user state, and allowed actions in feed/details responses.
- Post ownership and vendor publishing approval checks. Category cannot change on edit. Requests with quotes cannot be edited or deleted.
- HTTPS attachment URLs, maximum five attachments across create/edit/add-media. Upload supports JPG/PNG/PDF with MIME and signature checks, maximum 10 MB per file.
- Persistent Ignore/Pass and Undo Ignore.
- Vendor Callout interest, withdrawal, organizer-only paginated interest messages, and public interest count. One interest per vendor user per post; interest does not reserve a spot or create a booking/payment.
- Comment creation/read pagination and reaction creation. Replies are returned with `parentCommentId`.
- Quotes restricted to Need-a-Truck posts, with self-quotes rejected. One active Community offer per truck/request; vendor withdraws a pending offer before submitting a revised one.
- Public request lists exclude private and expired requests. Quote details are visible to the organizer and the quoting vendor (their own quotes only).
- Shared direct/community quote calculations: flat fee or price per person × guests, validated charge total, deposit/percentage consistency, commission coverage, and calculated balance. Direct quote response adds a `breakdown`.
- Quote creation/acceptance use row locks and state checks to reject conflicting concurrent submissions/decisions. Public quote acceptance checks truck availability before creating the booking hold.
- Community error filter preserves validation/permission errors and returns a safe message for unexpected server failures while logging the underlying error.

### Chosen Defaults and Compatibility Notes

1. Vendor publishing requires approval/verification. Customers require an active account. Vendor users may organize events and accept another vendor's quote: creator ownership is used, and the resulting booking's `customerId` represents the payer/organizer. Existing `/bookings/mine` and payment-intent ownership checks support that user ID.
2. Category defaults to `NEED_TRUCK` on legacy request creation. Existing rows migrate to that category. Generic historical rows should be reviewed manually before recategorization; the migration does not guess their intent.
3. `/posts` uses `limit`/`offset`, not the earlier proposed cursor. Rows without geographic coordinates are excluded when a distance filter is used.
4. `PLATFORM_COMMISSION_RATE` keeps its configured value. Quote/payment code now shares a validated 10% fallback matching `.env.example`; this does not force the Figma's 15%. A missing payment preference defaults to deposit-only, but an actual vendor quote cannot use `NO_PREFERENCE`.
5. Existing `COMMUNITY_POST` rewards remain per creator/post using existing reward rules/idempotency. No new vendor-specific reward or daily cap is introduced. Post edits do not award points. A reward-processing failure returns successful post creation plus `rewardStatus: UNCONFIRMED` instead of encouraging the user to repost.
6. Community event times use the supplied IANA `eventTimezone`, defaulting to UTC for legacy requests. If no end time is supplied, quote acceptance reserves three hours after the start time. Explicit end times take precedence. Past events/invalid time-zone values are rejected.
7. Callout structured fields are optional to support both the simple creation form and detailed event cards. Flutter should omit absent values. Community Help uses the shared description/attachment form.
8. Legacy requests remain callable, but stricter content/media/quote validation applies. Callers sending empty descriptions, more than five attachments, arbitrary media types, contradictory totals/deposits, or vendor `NO_PREFERENCE` quotes must update their payloads.

### Deployment and Manual Verification

Apply `20260912090000_shared_community_posts` along with any earlier required migrations, generate Prisma Client, and restart the server before testing. No migration has been applied automatically during this change.

See [COMMUNITY_POSTS_MANUAL_TESTING_FLOW.md](COMMUNITY_POSTS_MANUAL_TESTING_FLOW.md) for endpoints, request bodies, expected results, and negative checks. Automated tests were not run, following the user's preference.
