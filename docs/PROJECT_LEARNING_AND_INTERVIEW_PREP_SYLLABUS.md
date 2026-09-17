# BiteDrop Backend — Project-Based CS & Interview Preparation Syllabus

This document is the first learning document for understanding this project deeply from a Computer Science and software engineering perspective.

Important rule for this document:

- This is not generic theory.
- Every topic below is connected to something found in this repository.
- If something is not clearly implemented in the backend code, it is marked as `NOT USED NOW` or `COULD BE USEFUL LATER`.
- This is phase 1: repository analysis + learning syllabus. The next step is to expand each section one by one in depth.

---

## 1. Project Overview

### What this project does

This repository is the backend API for a food-truck marketplace/rewards application called BiteDrop.

Main business flows found in the codebase:

- Customer registration, login, email verification, password reset.
- Vendor registration, onboarding, verification, food truck setup.
- Vendor staff account creation and staff PIN login.
- Food truck discovery, menus, operating hours, drops, service area.
- Customer booking requests and vendor quotes.
- Stripe payment and webhook processing.
- Community posts, need-a-truck requests, vendor callouts, reports, hide/ignore.
- Social feed, following, favorites, posts, comments, likes, saved posts.
- Messaging through REST APIs and Socket.IO realtime events.
- Check-ins through QR code scan and reward points.
- Rewards, loyalty account, badges, redemptions.
- Promotions, referrals, notifications, leaderboards, admin APIs.

### Main users / roles

Evidence: `prisma/schema/11-users.prisma`

The `UserRole` enum contains:

- `CUSTOMER`
- `VENDOR`
- `VENDOR_STAFF`
- `ADMIN`

These roles are used with NestJS guards in files such as:

- `src/common/guards/jwt-auth.guard.ts`
- `src/common/guards/roles.guard.ts`
- `src/common/decorators/roles.decorator.ts`
- `src/common/decorators/current-user.decorator.ts`

### Technology stack found in the project

Backend:

- Node.js
- TypeScript
- NestJS
- Prisma ORM
- PostgreSQL
- PostGIS/geography columns for location search
- Socket.IO for realtime messaging
- Swagger/OpenAPI for API documentation
- Docker and Docker Compose
- GitHub Actions CI/CD

External services:

- Stripe API for payments and Connect accounts
- Cloudinary for file/image upload
- Firebase Admin SDK for push notifications
- SMTP/Nodemailer for email
- GitHub Container Registry for Docker images

Database:

- PostgreSQL through Prisma.
- Prisma config uses multi-file schema folder: `prisma/schema`.
- Datasource is configured in `prisma/schema/01-datasource.prisma`.
- Prisma connection uses `@prisma/adapter-pg` in `src/infrastructure/prisma/prisma.service.ts`.

File storage:

- Cloudinary is implemented in `src/infrastructure/cloudinary/cloudinary.service.ts`.

Email:

- SMTP email is implemented with Nodemailer in `src/infrastructure/mail/mail.service.ts`.

Realtime:

- Socket.IO gateway is implemented in `src/modules/messaging/messaging.gateway.ts`.

Caching:

- No application-level Redis cache was found in the backend code.
- Terraform has an `elasticache` module, but the NestJS application does not currently use Redis directly.

Deployment:

- `Dockerfile`
- `docker-compose.yaml`
- `.github/workflows/deploy.yaml`
- Terraform files under `terraform/`

---

## 2. High-Level Architecture

Current architecture is a modular monolith.

Simple flow:

```text
Mobile App / Web Client
        |
        | HTTP / WebSocket
        v
NestJS Backend API
        |
        | Controllers
        v
Services
        |
        | Repositories / Prisma
        v
PostgreSQL Database
        |
        +--> Stripe
        +--> Cloudinary
        +--> Firebase
        +--> SMTP Email
```

More detailed request flow:

```text
Client sends request
        |
        v
NestJS receives HTTP request
        |
        v
Global ValidationPipe validates DTO
        |
        v
JwtAuthGuard checks Authorization: Bearer <token>
        |
        v
RolesGuard checks role if @Roles(...) is used
        |
        v
Controller method receives DTO / params / query
        |
        v
Service applies business logic
        |
        v
Repository or PrismaService queries PostgreSQL
        |
        v
Response returned to client
```

Evidence:

- Global validation: `src/main.ts`
- App module imports: `src/app.module.ts`
- JWT guard: `src/common/guards/jwt-auth.guard.ts`
- Roles guard: `src/common/guards/roles.guard.ts`
- Prisma service: `src/infrastructure/prisma/prisma.service.ts`

---

## 3. Main Backend Modules

Evidence: `src/app.module.ts`

| Module | Purpose | Important files |
|---|---|---|
| Auth | Register, login, email verification, password reset, refresh token, staff login | `src/modules/auth/` |
| Users | Profile, avatar upload, settings, delete account | `src/modules/users/` |
| Vendors | Vendor profile, onboarding, approval restrictions, staff management | `src/modules/vendors/` |
| Food Trucks | Truck profile, menu, service area, operating hours, drops | `src/modules/food-trucks/` |
| Discovery | Nearby truck discovery | `src/modules/discovery/` |
| Social | Social posts, comments, follow, favorite, feed | `src/modules/social/` |
| Community | Need-a-truck, vendor callout, community posts, quotes/offers, report/hide | `src/modules/community/` |
| Bookings | Customer booking requests, vendor quotes, accept/reject, booking status | `src/modules/bookings/` |
| Payments | Stripe payment intent, refunds, webhooks, commission | `src/modules/payments/` |
| Messaging | Chat list, messages, REST + Socket.IO realtime | `src/modules/messaging/` |
| Notifications | Notification records and push delivery | `src/modules/notifications/` |
| Reviews | Customer reviews, vendor response, moderation/reporting | `src/modules/reviews/` |
| Rewards | Loyalty points, badges, redemptions | `src/modules/rewards/` |
| Referrals | Referral codes, apply referral, qualify rewards | `src/modules/referrals/` |
| Promotions | Vendor promotions and customer redemption | `src/modules/promotions/` |
| Leaderboards | Ranked food truck lists | `src/modules/leaderboards/` |
| Admin | Admin lists, approvals, audits, platform settings | `src/modules/admin/` |

---

## 4. Important Computer Science Topics Actually Connected to This Project

This is the project-based syllabus. Each topic should later be expanded with:

```text
CODE -> CONCEPT -> THEORY -> WHY -> INTERNAL WORKING -> LIMITATION -> BETTER APPROACH -> INTERVIEW QUESTION
```

### A. Networking

Used now:

- HTTP request-response APIs.
- REST-style endpoints under `/api/v1/...`.
- HTTP methods: `GET`, `POST`, `PATCH`, `DELETE`.
- HTTP headers, especially `Authorization: Bearer <JWT>`.
- HTTP status codes through Nest exceptions.
- Ports: app listens on `process.env.PORT ?? 3000`.
- WebSocket through Socket.IO namespace `/messaging`.
- Docker port mapping: `${PORT:-3000}:3000`.
- TLS/HTTPS is indirectly required for production and for secure external services, but reverse proxy/SSL config is not inside this repo.

Files to study:

- `src/main.ts`
- `src/swagger.ts`
- `src/common/guards/jwt-auth.guard.ts`
- `src/modules/messaging/messaging.gateway.ts`
- `docker-compose.yaml`

Interview focus:

- What happens when a mobile app calls `GET /api/v1/community/posts`?
- Why does the API need headers?
- Difference between HTTP and WebSocket in this project.
- How Docker maps server port 3000 to container port 3000.
- What happens if port 3000 is already in use?

### B. Operating System Concepts

Used now:

- Node.js runs as a process.
- Docker runs the Nest app inside a container.
- Environment variables provide secrets and config.
- File uploads use memory buffers before uploading to Cloudinary.
- Network I/O is asynchronous.
- `dumb-init` is used in Docker to handle PID 1 signal behavior.

Files to study:

- `Dockerfile`
- `docker-compose.yaml`
- `src/main.ts`
- `src/infrastructure/cloudinary/cloudinary.service.ts`
- `src/infrastructure/prisma/prisma.service.ts`

Interview focus:

- Why can Node.js handle many requests if JavaScript mostly runs on one thread?
- What is the event loop?
- What is non-blocking I/O?
- Why does a server fail with `EADDRINUSE`?
- Why are secrets stored in environment variables instead of code?

### C. NestJS

Used now:

- Modules: `AuthModule`, `BookingsModule`, `CommunityModule`, etc.
- Controllers: handle HTTP routes.
- Services: business logic.
- Repositories: database query layer in many modules.
- Dependency Injection: services are injected through constructors.
- DTOs: request body/query validation.
- Global `ValidationPipe`: whitelist + transform + forbid unknown properties.
- Guards: JWT authentication and role authorization.
- Custom decorators: `@CurrentUser()`, `@Roles()`.
- Interceptors: file upload with Multer.
- Exception filters: community module has `CommunityErrorFilter`.
- WebSocket Gateway: messaging realtime.
- Swagger: API docs at `/api/v1/docs`.

Files to study:

- `src/app.module.ts`
- `src/main.ts`
- `src/common/guards/`
- `src/common/decorators/`
- `src/modules/*/*.controller.ts`
- `src/modules/*/*.service.ts`
- `src/modules/*/*.repository.ts`
- `src/modules/messaging/messaging.gateway.ts`
- `src/swagger.ts`

Interview focus:

- Why use Controller-Service-Repository separation?
- What is Dependency Injection?
- What does `ValidationPipe` do?
- Why use DTOs?
- How do guards protect APIs?

### D. JavaScript / TypeScript

Used now:

- `async/await` and Promises for database/external calls.
- Classes for NestJS services/controllers.
- Decorators such as `@Controller`, `@Injectable`, `@Get`, `@Post`.
- Interfaces/types for request objects and DTO-like structures.
- Enums from Prisma and custom enums.
- Arrays with `map`, `filter`, `reduce`.
- `Set` for deduplication.
- `Map` for fast lookup, for example reward activity mapping and distance mapping.
- Optional chaining and nullish coalescing.
- Object spread for update payloads.

Files to study:

- `src/modules/rewards/rewards.service.ts`
- `src/modules/bookings/quote-financials.ts`
- `src/modules/community/community-posts.service.ts`
- `src/modules/vendors/vendors.service.ts`

Interview focus:

- What does `async/await` really do internally?
- Why use `Map` instead of repeated array search?
- Why use `Set` for unique menu/cuisine IDs?
- What do TypeScript enums protect?
- What are decorators in NestJS?

### E. Data Structures and Algorithms

Actually used:

- Array: lists of posts, bookings, menu items, notifications.
- Object: DTOs, response objects, Prisma query payloads.
- Map: fast lookup by id, e.g. rewards activity source mapping.
- Set: deduplication, e.g. unique cuisine/menu items.
- Sorting: leaderboards, feeds, bookings by date/rank.
- Filtering: category/status/location/role filters.
- Pagination: `limit`, `offset`, `take`, `skip`; some social feed cursor-style logic also exists.
- Hashing: passwords, verification codes, refresh tokens, staff PINs with bcrypt.
- Geospatial search: PostGIS `ST_DWithin` and `ST_Distance`.
- Financial calculation: quote totals, deposits, commission.

Not meaningfully used:

- Linked list.
- Heap.
- BFS/DFS as a main project algorithm.
- Binary search.

Files to study:

- `src/modules/rewards/rewards.service.ts`
- `src/modules/leaderboards/leaderboards.service.ts`
- `src/modules/community/community-posts.service.ts`
- `src/modules/bookings/quote-financials.ts`
- `src/modules/auth/auth.service.ts`

Interview focus:

- Time complexity of mapping transactions with `Map`: near `O(n)`.
- Why pagination is needed.
- Why repeated `.find()` inside `.map()` could become `O(n²)`.
- Why geospatial index matters for nearby search.

### F. Database Fundamentals

Used now:

- PostgreSQL relational database.
- Prisma ORM.
- UUID primary keys.
- One-to-one relationships, e.g. `User -> UserProfile`, `User -> UserSetting`.
- One-to-many relationships, e.g. `User -> RefreshToken`, `Vendor -> FoodTruck`, `Booking -> Payment`.
- Many-to-many through join tables, e.g. `FoodTruckCuisine`, `ConversationParticipant`.
- Unique constraints, e.g. `User.email`, `RefreshToken.tokenId`, `Payment.idempotencyKey`.
- Indexes, e.g. community post category/visibility index and PostGIS location index.
- Transactions for state changes.
- Row locking with `FOR UPDATE` in booking/community flows.
- Soft delete in some models using `deletedAt`.
- Hard delete exists in user delete flow.
- Migrations under `prisma/schema/migrations`.
- Seed logic in `src/infrastructure/prisma/seed.service.ts` and `prisma/seed.ts`.

Files to study:

- `prisma/schema/*.prisma`
- `src/infrastructure/prisma/prisma.service.ts`
- `src/modules/*/*.repository.ts`

Interview focus:

- Why PostgreSQL instead of MongoDB?
- What is a foreign key?
- Why use unique constraints?
- Why use transactions?
- Why does migration drift happen?
- Why must we not run `migrate reset` on a shared/production DB?

### G. API and Backend Engineering

Used now:

- API versioning in URL: `/api/v1/...`.
- REST resources: users, vendors, bookings, rewards, social, community, payments.
- Request body DTO validation.
- Query parameters for filtering/pagination/location.
- Path params for IDs.
- JWT authentication.
- Role-based authorization.
- Swagger documentation with examples.
- Proper exceptions: `BadRequestException`, `ForbiddenException`, `ConflictException`, `NotFoundException`.

Files to study:

- Every `*.controller.ts`
- DTO folders under each module.
- `src/swagger.ts`

Interview focus:

- Difference between body, query, and path param.
- Why `PATCH` for partial update?
- Why `POST` for create/action APIs?
- How Swagger helps frontend/manual testing.
- What makes an API idempotent?

### H. Authentication and Security

Used now:

- Password hashing with bcrypt.
- Email verification code hashing.
- Password reset code hashing.
- Refresh token hashing in database.
- JWT access token verification.
- Refresh token rotation/revocation.
- Staff PIN hashing.
- Role-based access control.
- Stripe webhook signature verification.
- ValidationPipe rejects unknown fields.
- Cloudinary/Stripe/Firebase/SMTP use environment variables.

Potential weaknesses / improvements:

- Rate limiting is not implemented; comment exists in `src/app.module.ts`.
- WebSocket auth exists, but Socket.IO CORS allows `origin: true`; production should restrict origins.
- No Redis-backed distributed rate limit found.
- Audit and monitoring could be stronger.
- Some destructive actions like account delete must be carefully tested.

Files to study:

- `src/modules/auth/auth.service.ts`
- `src/common/guards/jwt-auth.guard.ts`
- `src/common/guards/roles.guard.ts`
- `src/modules/payments/stripe-client.service.ts`
- `src/modules/messaging/messaging.gateway.ts`

Interview focus:

- Why store password hash, not password?
- Why hash refresh tokens in DB?
- Why access token + refresh token?
- How does role authorization work?
- How does Stripe webhook verification prevent fake payment events?

### I. System Design

Used now:

- Modular monolith.
- Stateless HTTP API with JWT.
- PostgreSQL as primary persistent storage.
- External services for payments, upload, push, email.
- Dockerized deployment.
- GitHub Actions build/deploy.

Not used now but could be useful later:

- Redis cache.
- Queue/message broker for emails, notifications, webhook processing.
- Load balancer.
- CDN for static media; Cloudinary already acts like external media delivery.
- Read replicas.
- Centralized monitoring/alerting.

Interview focus:

- Why modular monolith is okay now.
- When would you split into microservices?
- How would you scale to 10k/100k users?
- What happens if Stripe is slow?
- What happens if PostgreSQL is down?

### J. Redis / Caching

Status: `NOT USED NOW` in application code.

Evidence:

- No Redis client package found in `package.json`.
- No Redis usage found in `src/`.
- Terraform has `terraform/modules/elasticache`, but backend code does not use Redis yet.

What to know:

- Redis could be used later for rate limiting, sessions, short-lived OTP cache, feed cache, distributed locks, or Socket.IO adapter in multi-server deployment.
- Never store critical payment/user data only in Redis.

### K. External Services

Actually integrated:

| Service | Purpose | Evidence |
|---|---|---|
| Stripe | Connect accounts, payment intents, refunds, webhooks | `src/modules/payments/stripe-client.service.ts` |
| Cloudinary | Upload image/file buffers | `src/infrastructure/cloudinary/cloudinary.service.ts` |
| Firebase Admin | Push notifications | `src/infrastructure/firebase/firebase.service.ts` |
| SMTP/Nodemailer | Email delivery | `src/infrastructure/mail/mail.service.ts` |
| GitHub Container Registry | Docker image hosting | `.github/workflows/deploy.yaml` |

Related but not fully visible in backend:

- Domain/DNS/SSL/reverse proxy are deployment concerns but no Nginx/Caddy config was found in this repo.

### L. Payment Fundamentals

Used now:

- Stripe Connect account creation.
- Stripe account onboarding link.
- Stripe PaymentIntent creation.
- Stripe refunds.
- Stripe webhook signature verification.
- Payment idempotency key exists in database.
- Stripe webhook events are stored with unique `stripeEventId`.
- Commission calculation exists.

Files to study:

- `src/modules/payments/`
- `prisma/schema/19-payments.prisma`
- `src/modules/bookings/quote-financials.ts`

Interview focus:

- Why verify webhook signatures?
- Why store Stripe event IDs?
- What happens if Stripe sends the same webhook twice?
- Why use idempotency key for payment creation?

### M. Docker / DevOps / Deployment

Used now:

- Multi-stage Dockerfile.
- Production container runs `node dist/src/main.js`.
- Non-root container user `nestjs`.
- `dumb-init` for signal handling.
- Docker Compose service exposes app on port 3000.
- GitHub Actions builds and pushes image to GHCR.
- Deploy job SSHs into server and runs Docker Compose.
- Terraform files exist for AWS-style infrastructure modules.

Files to study:

- `Dockerfile`
- `docker-compose.yaml`
- `.github/workflows/deploy.yaml`
- `terraform/`

Safe migration rule:

```bash
npx prisma migrate deploy --schema prisma/schema
npx prisma generate --schema prisma/schema
```

Do not run this on shared/production database:

```bash
npx prisma migrate reset
```

### N. Software Engineering Principles

Good patterns found:

- Separation of concerns: controller/service/repository split.
- Dependency Injection: NestJS providers.
- DTO validation.
- Centralized Prisma service.
- Feature-based module organization.
- Transactions and row locks in important state transitions.
- Environment-based configuration for secrets.

Possible improvement areas:

- Some service/repository files are large and can be split further.
- Rate limiting is not implemented yet.
- Some external-service failure handling can be more robust with queues/retries.
- More automated integration/e2e tests are needed for core flows.

### O. Concurrency and Race Conditions

Risk areas:

- Booking accept/reject/quote flows.
- Payment webhook duplicate delivery.
- Reward points awarding.
- Referral qualification.
- Promotion redemption limits.
- Community offer accept/withdraw.
- Staff creation with same email.

Protection already present:

- Prisma transactions.
- Unique constraints.
- `FOR UPDATE` row locking in booking/community flows.
- Stripe webhook event unique ID.
- Payment idempotency key.

Files to study:

- `src/modules/bookings/bookings.repository.ts`
- `src/modules/community/community.repository.ts`
- `prisma/schema/19-payments.prisma`
- `src/modules/rewards/rewards.repository.ts`

### P. Error Handling and Failure Scenarios

Used now:

- Nest exceptions produce HTTP error responses.
- DTO validation produces 400 errors.
- Stripe webhook missing signature gives 400.
- Cloudinary not configured gives 500.
- SMTP not configured logs warning and skips email.
- Firebase failure logs warning and returns failed counts.

Need to understand:

- Database offline -> API usually returns 500 unless caught.
- External API timeout -> can fail request.
- Duplicate request -> should return 409 when protected by service/unique constraint.
- Invalid token -> 401.
- Wrong role -> 403.

### Q. Testing

Existing evidence:

- Jest is configured in `package.json`.
- Unit tests exist for auth-related files:
  - `src/modules/auth/auth.service.spec.ts`
  - `src/modules/auth/google-token-verifier.service.spec.ts`
- E2E setup exists:
  - `test/app.e2e-spec.ts`
  - `test/jest-e2e.json`

Important missing tests to add later:

- Booking request -> vendor quote -> customer accept -> payment.
- Stripe webhook duplicate delivery.
- Community create/report/hide/list.
- Staff login and restricted access.
- Rewards profile summary and QR check-in.
- Messaging conversation list and socket message delivery.
- User profile upload/change/delete account.

---

## 5. Project-Specific Feature Flows to Learn

### Auth flow

Files:

- `src/modules/auth/auth.controller.ts`
- `src/modules/auth/auth.service.ts`
- `prisma/schema/11-users.prisma`

Flow:

```text
Register customer/vendor
        |
        v
Hash password with bcrypt
        |
        v
Create user + role + profile/settings
        |
        v
Generate email verification code
        |
        v
Send code by SMTP
        |
        v
Verify email
        |
        v
Login
        |
        v
Return access token + refresh token
```

Study questions:

- Why is the verification code hashed?
- Why is refresh token stored as hash?
- Why does vendor need approval restrictions?
- How does staff login differ from normal user login?

### Booking and quote flow

Files:

- `src/modules/bookings/`
- `src/modules/bookings/quote-financials.ts`
- `prisma/schema/18-bookings.prisma`

Flow:

```text
Customer creates booking request
        |
        v
Vendor sees booking
        |
        v
Vendor sends quote
        |
        v
Customer accepts quote
        |
        v
Payment is created
        |
        v
Stripe confirms payment through webhook
        |
        v
Booking/payment status updates
```

Study questions:

- Why use a booking status enum?
- Why quote calculation should be done on backend?
- Why lock booking rows during accept?
- What can go wrong if two quote accept requests happen together?

### Community flow

Files:

- `src/modules/community/`
- `prisma/schema/17-community.prisma`

Flow:

```text
Customer or vendor creates post
        |
        v
Feed lists posts by category/location/tab
        |
        v
User can comment/react
        |
        v
User can hide/ignore post
        |
        v
User can report post
        |
        v
Vendor can send quote/interest for eligible requests
```

Study questions:

- Why category enum?
- Why report has unique `(postId, reportedById)`?
- Why location search uses PostGIS?
- Why own post cannot be reported?

### Messaging flow

Files:

- `src/modules/messaging/messaging.controller.ts`
- `src/modules/messaging/messaging.service.ts`
- `src/modules/messaging/messaging.gateway.ts`
- `prisma/schema/21-messaging.prisma`

Flow:

```text
User opens chat list
        |
        v
REST API loads conversations
        |
        v
User enters one conversation
        |
        v
REST API loads messages
        |
        v
Socket.IO joins conversation room
        |
        v
message:send creates DB message
        |
        v
Realtime event sends message to participants
```

Study questions:

- Why store messages in DB if WebSocket already sends realtime data?
- Why use conversation participants table?
- How do unread counts work?
- What happens when socket token is invalid?

### Rewards and check-in flow

Files:

- `src/modules/rewards/`
- `src/modules/check-ins/`
- `prisma/schema/23-loyalty.prisma`
- `prisma/schema/25-qr-checkins.prisma`

Flow:

```text
Customer scans vendor/truck QR
        |
        v
Backend validates QR/check-in eligibility
        |
        v
Reward transaction is created
        |
        v
Loyalty account point balance updates
        |
        v
Profile summary shows available credit, progress, badges, activity
```

Study questions:

- Why keep a transaction history instead of only a point balance?
- How to prevent duplicate points?
- Why separate reward rules from transactions?

---

## 6. Interview Questions — Starter Set

### Beginner

Question: What is this backend built with?

Short answer: It is a NestJS backend written in TypeScript. It uses PostgreSQL with Prisma, JWT authentication, Stripe payments, Cloudinary uploads, Firebase push notifications, SMTP email, Socket.IO messaging, Docker, and GitHub Actions deployment.

Follow-up: Why NestJS?

Answer: NestJS gives a structured module/controller/service architecture, dependency injection, guards, DTO validation, Swagger support, and WebSocket support. That helps keep a growing backend organized.

### Junior

Question: How does authentication work in this project?

Short answer: User credentials are validated in `AuthService`. Passwords are hashed with bcrypt. On login, the backend returns a JWT access token and refresh token. Protected APIs use `JwtAuthGuard`, which reads `Authorization: Bearer <token>` and verifies it.

Follow-up: Why hash refresh tokens?

Answer: If the database leaks, attackers should not be able to directly use stored refresh tokens. The app compares the submitted refresh token with the stored hash.

### Mid-level

Question: How does the project prevent duplicate payment webhook processing?

Short answer: The payment schema has `StripeWebhookEvent` with unique `stripeEventId`. The backend verifies the webhook signature and can store/process each Stripe event only once.

Follow-up: Why is webhook signature verification needed?

Answer: Without signature verification, anyone could send a fake HTTP request pretending to be Stripe and incorrectly mark payments as successful.

### Tricky

Question: Why should `prisma migrate reset` not be used on the current shared database?

Short answer: `migrate reset` drops the schema and deletes all data. For a shared or production Neon database, we should use `prisma migrate deploy --schema prisma/schema`, which applies pending migrations without wiping data.

Follow-up: What caused migration drift?

Answer: Drift happens when the real database structure differs from the migration history. This can happen if someone manually changes the DB, runs reset locally against a shared DB, or has failed/rolled-back migrations.

---

## 7. Important `Why?` Questions From This Project

| Why question | Short answer |
|---|---|
| Why TypeScript? | It catches many type mistakes before runtime and makes DTO/service contracts clearer. |
| Why NestJS? | It provides structure for a large backend: modules, controllers, services, DI, guards, Swagger. |
| Why PostgreSQL? | The app has relational data: users, vendors, bookings, payments, messages, rewards. PostgreSQL also supports PostGIS location queries. |
| Why Prisma? | It gives typed database access, migrations, model relationships, and safer query building. |
| Why JWT? | The backend can verify stateless access tokens without storing server sessions for every request. |
| Why access + refresh token? | Short-lived access tokens reduce risk; refresh tokens allow login continuation and can be revoked. |
| Why bcrypt? | Passwords/PINs/codes should not be stored in plain text. bcrypt is slow by design, making brute force harder. |
| Why DTO validation? | It blocks invalid/unexpected input before business logic runs. |
| Why transactions? | Multi-step changes must either fully complete or rollback together. |
| Why row locking? | It prevents two concurrent requests from changing the same booking/request incorrectly. |
| Why Docker? | It packages the app, dependencies, and runtime consistently for deployment. |
| Why not microservices now? | Current project is better as modular monolith; microservices would add operational complexity too early. |
| Why not store everything in Redis? | Redis is memory-first and not the source of truth. Critical data belongs in PostgreSQL. |

---

## 8. What Could Break? Testing Map

| Feature | What could break? | How to test |
|---|---|---|
| Auth | Wrong token, expired token, duplicate email, unverified email | Register, verify, login, refresh, logout, protected route |
| Staff | Staff PIN wrong, deleted staff login, staff accesses vendor-only route | Create staff, login, reset PIN, delete staff, test allowed/blocked routes |
| Community | Invalid category data, duplicate report, hidden post still showing | Create each category, list by category/location, report, hide |
| Booking | Past event date, quote total mismatch, duplicate accept | Create request, send quote, accept once, retry accept |
| Payments | Stripe failure, duplicate webhook, invalid signature | Create payment, send mocked webhook twice, invalid signature |
| Messaging | Unauthorized conversation access, socket auth failure | Create conversation, list, send REST/socket message, test wrong user |
| Rewards | Duplicate points, redemption with insufficient credit | Check-in, repeat check-in, redeem credit |
| Upload | Missing file, invalid config, large file | Upload valid image, no file, unsupported file |
| Notifications | Invalid Firebase token, no Firebase config | Register token, trigger notification, inspect invalid cleanup |
| Deployment | Port conflict, old image, unapplied migrations | Build, run container, migrate deploy, health check |

---

## 9. Project Limitations to Review Later

| Limitation | Current implementation | Why it matters | Severity | Recommended solution |
|---|---|---|---|---|
| Rate limiting | Comment exists, package not installed | Login/OTP APIs can be brute-forced | Important | Add `@nestjs/throttler` or gateway/WAF limit |
| Redis cache | Not used in app code | Heavy feed/discovery APIs may hit DB often | Nice to have now | Add later for hot feeds/rate-limit/session-like data |
| Queue/background jobs | Emails/push mostly happen inline | External service delay can slow API | Important later | Add BullMQ/SQS when traffic grows |
| Monitoring | No full monitoring config found | Production errors are harder to trace | Important | Add structured logs, alerts, uptime checks |
| Tests | Some tests exist, many flows missing | Bugs can pass into production | Important | Add e2e tests for booking/payment/community/staff |
| WebSocket scaling | Socket.IO local server only | Multi-instance deployment needs shared adapter | Later | Use Redis Socket.IO adapter if horizontally scaled |
| Migration safety | Shared DB can drift if dev commands used wrongly | Data loss/drift risk | Critical | Use deploy only; never reset shared DB |

---

## 10. Personalized Study Roadmap

### Must Know

- NestJS module/controller/service/guard/DTO lifecycle.
- JWT access token and refresh token flow.
- bcrypt password/PIN/code hashing.
- Prisma models, migrations, relations, transactions.
- PostgreSQL basics: primary key, foreign key, unique index, joins.
- REST API design and HTTP status codes.
- Booking/payment/community business flows.
- Docker build/run/deploy basics.
- Safe migration commands.

### Should Know

- Node.js event loop and async I/O.
- PostGIS location query basics.
- Stripe PaymentIntent and webhook signature verification.
- Socket.IO rooms and realtime messaging flow.
- Error handling and failure scenarios.
- Race conditions and row locks.
- Test strategy: unit vs integration vs e2e.

### Good to Know

- Redis caching and distributed locks.
- Queue/message broker for emails/notifications/webhooks.
- Horizontal scaling and load balancing.
- CDN/media delivery optimization.
- Observability: logs, metrics, traces.
- Security hardening: rate limit, CORS origin restrictions, brute-force protection.

---

## 11. Final Revision Sheet

Architecture:

- This is a modular monolith NestJS backend.
- Each feature has its own module.
- Controllers receive requests, services run business logic, repositories/Prisma talk to PostgreSQL.

NestJS:

- `ValidationPipe` validates DTOs globally.
- `JwtAuthGuard` authenticates users.
- `RolesGuard` authorizes roles.
- Swagger docs are available at `/api/v1/docs`.

Node.js:

- Runs as a process.
- Uses non-blocking async I/O.
- Docker runs it inside a container.

Database:

- PostgreSQL + Prisma.
- UUID IDs.
- Many related models.
- Transactions and locks protect important state changes.
- Never reset shared DB.

Networking:

- REST APIs under `/api/v1`.
- WebSocket namespace `/messaging`.
- Docker maps port 3000.

Security:

- Passwords, refresh tokens, codes, and staff PINs are hashed.
- JWT protects APIs.
- Role guard restricts admin/vendor/staff/customer APIs.
- Stripe webhook signature is verified.

Payments:

- Stripe PaymentIntent is used.
- Webhook updates payment status.
- Unique event ID/idempotency key help prevent duplicate processing.

External services:

- Cloudinary upload.
- Firebase push.
- SMTP email.
- Stripe payment.

System design:

- Current architecture is good for early/mid stage.
- Add Redis/queues/load balancer/monitoring when traffic grows.

Testing:

- Auth unit tests exist.
- More e2e tests are needed for payment, booking, community, staff, rewards, messaging.

---

## 12. Next Expansion Plan

To build the full interview-preparation document, expand these sections one by one:

1. Full project overview and architecture.
2. Networking in this exact backend.
3. OS + Node.js event loop.
4. NestJS lifecycle and each framework feature used.
5. TypeScript/JavaScript concepts from the code.
6. DSA from actual service/repository logic.
7. Database model-by-model explanation.
8. API design and route flow.
9. Auth/security deep dive.
10. System design and scalability.
11. External services.
12. Stripe payment flow.
13. Docker/CI/CD/deployment.
14. Software engineering review.
15. Race conditions and transactions.
16. Failure handling.
17. Project limitations.
18. Senior-level improvement plan.
19. Scalability roadmap.
20. Testing strategy.
21. Interview questions from the repo.
22. Why questions.
23. What happens internally questions.
24. Glossary.
25. Study roadmap.
26. Final cheat sheet.

Recommended next document to create:

`docs/PROJECT_LEARNING_PART_01_ARCHITECTURE.md`

