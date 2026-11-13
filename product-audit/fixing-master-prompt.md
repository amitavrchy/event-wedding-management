# Fixing Master Prompt — event-wedding-management ("Utsab")

Paste this into a coding-agent session opened at the repository root. Work through the stages in order. Each numbered task is one reviewable pull request.

---

## Context

You are working on **Utsab**, an event and wedding planning product with a vendor marketplace, intended to launch commercially in Bangladesh. Revenue is to come from **vendor subscriptions**.

**Stack (verified):**

- `backend/`: NestJS 11 (Express), Prisma 6.19, PostgreSQL, zod 4, `@nestjs/jwt` (HS256, 8 h), bcryptjs, socket.io, bullmq (optional, needs `REDIS_URL`), helmet. Tests: `node:test` through `tsx` (`npm test`). Node ≥ 22.
- `frontend/`: Next.js 16 App Router, React 19, plain CSS, socket.io-client. Tests: Playwright.
- `deploy/` + `.github/workflows/deploy.yml`: GHCR images, EC2 with Docker Compose, shared Postgres.

**Architecture:** one `AppModule` in `backend/src/main.ts`, 34 controllers, no service layer. Controllers call Prisma directly. Shared helpers: `access.ts` (`ownEvent`, `ownVendor`), `reservations.ts` (`reserve`), `domain.ts`, `validation.ts`, `activity.ts`, `errors.ts`, `rate-limit.ts`, `realtime.ts`, `jobs.ts`, `reminders.ts`, `automations.ts`. Frontend state lives in `frontend/src/lib/context.tsx`; fetch wrapper in `lib/api.ts`; hooks in `lib/use-resource.ts`; navigation in `components/shell.tsx`.

**Rules for every task**

1. Read the files named in the task before editing. Do not rewrite files that are not part of the task.
2. Preserve working behaviour: advisory-lock + exclusion-constraint booking logic, payment idempotency, `ownEvent`/`ownVendor` checks, zod validation.
3. Database changes are Prisma migrations created with `prisma migrate dev --create-only`, reviewed, and safe on a populated database (add nullable/with default first; create indexes concurrently in hand-written SQL where tables may be large). Never use `db push`.
4. Add or update automated tests for every behavioural change (`backend/test/*.test.ts` with a real database via `TEST_DATABASE_URL`; Playwright for flows).
5. After each task run: `npm --prefix backend run build && npm --prefix backend test && npx --prefix frontend tsc --noEmit`, and report the output. Do not claim a test passed unless you ran it.
6. No unrelated refactors, dependency upgrades or formatting churn.
7. Never commit secrets. Never weaken an authorization check to make a test pass.

---

## Stage 1 — Critical security and data integrity

1.1 **Repository hygiene after the 2026-11-13 compromise.** Replace the root `.gitignore` (currently `config.bat`, `node_modules`, added by the attacker) with an intentional one. Normalise `frontend/next.config.ts` to LF. Search the tree for any `init` file, lines longer than 1,000 characters in source files, `eval(`, `atob(`, `createRequire`, and report findings. (Credential rotation and branch protection are done by the owner outside the code.)

1.2 **Activate CI and gate deploys.** Move `backend/ci/workflows/ci.yml` to `.github/workflows/ci.yml`. Change `.github/workflows/deploy.yml` so the deploy job runs only after CI succeeds on the same commit (`workflow_run` or a `needs` chain in one workflow). Fix `backend/scripts/verify.mjs` so the root check allows `.github`, `deploy` and dotfiles.

1.3 **Simulated payments.** In `backend/src/payments.ts`, make `sandbox-confirm` and provider `SANDBOX` return 400 whenever `NODE_ENV === "production"`, regardless of `PAYMENT_MODE`. Change `deploy/.env.example` to `PAYMENT_MODE=disabled`. In the frontend bookings and finance pages, hide pay buttons when `GET /api/health` reports payments unconfigured. Test: production mode cannot capture.

1.4 **Sessions.** Replace bearer-in-`sessionStorage` with an httpOnly, `SameSite=Lax`, `Secure` (in production) cookie. Add `User.tokenVersion Int @default(0)`; put it in the JWT; `AuthGuard` loads the user and rejects a mismatched version or missing user. Add `POST auth/logout` (increments the version, clears the cookie) and `POST auth/password` (current + new). Add an Origin allowlist check for non-GET requests. Socket.IO reads the cookie from the handshake. Update `frontend/src/lib/api.ts`, `context.tsx`, `socket.ts` (`credentials: "include"`, remove token storage).

1.5 **Account recovery and verification.** Add `emailVerifiedAt`, `phone`, and a `OneTimeToken` table (hashed token, purpose, expiry, usedAt). Routes: request verification, verify, request reset, reset. Responses must not reveal whether an account exists. Delivery goes through the notification interface from Stage 6 task 6.1; until a provider is configured, log the link in development only.

1.6 **Public vendor responses.** In `backend/src/vendors.ts` return an explicit field allowlist from `GET vendors` and `GET vendors/:id` (no `ownerId`, `commissionBps`, `status`).

1.7 **Quotes.** In `backend/src/packages.ts` `QuotesController.create`, require an existing `Conversation` for `(eventId, vendorId)`; cap `breakdown` at 30 items and labels at 120 characters.

1.8 **Site password and guestbook abuse.** In `backend/src/websites.ts` skip bcrypt entirely when no password was supplied, and add a per-slug + IP attempt limiter (10 per 15 minutes) for `access` and `guestbook`.

1.9 **Rate limiting.** Replace the in-memory map in `backend/src/rate-limit.ts` with a Redis-backed counter when `REDIS_URL` is set (keep memory fallback for development), and add a per-email login failure lock.

1.10 **Security headers.** Add `headers()` to `frontend/next.config.ts`: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`/`frame-ancestors`, `Strict-Transport-Security`, and a Content-Security-Policy that allows the Socket.IO origin.

Stage 1 acceptance: tests EWM-021, 022, 023, 062, 081, 100, 130 in `product-audit/event-wedding-management/test-cases.md` pass; CI is green and blocks deploy on failure.

## Stage 2 — Broken functional workflows

2.1 `disputes.ts`: non-admin list returns disputes for events the user can access **and** for vendors the user can access.
2.2 `vendors.ts` + `recommendations.ts`: add `page`, `limit` (max 50), deterministic `orderBy`; case-insensitive city; price range; move the date-availability filter into the SQL `where`. Update `frontend/src/app/(workspace)/vendors/page.tsx` for paging.
2.3 Add update/delete routes and UI: guests (`PATCH` all fields, `DELETE`), tasks, expenses, event days, vendor services, vendor profile `PATCH`, event archive (`status = ARCHIVED`, hidden from lists). Keep the `ownEvent`/`ownVendor` first-line pattern and scope child writes by parent ID.
2.4 `jobs.ts`: run the worker from a separate entry file (`src/worker.ts`) and add a `worker` service to `deploy/docker-compose.prod.yml`; add a Redis service or document the shared one; health endpoint reports job state.
2.5 `automations.ts`: do not load rules that already have an `AutomationRun`; decide and implement re-arm semantics (for example: once per event day for `EVENT_APPROACHING`, once per overdue task for `TASK_OVERDUE`).
2.6 `reminders.ts`: compute the day key in `Asia/Dhaka`; notify editors as well as the host.
2.7 Return 404 for missing bookings and invitations; return entities (or 204) instead of `{count}`.
2.8 `reviews.ts`: only the host may review.

## Stage 3 — Database and architecture

3.1 Migration with the indexes listed in `product-audit/event-wedding-management/database-audit.md` §4.
3.2 Foreign keys for `Payment`, `LedgerEntry`, `Booking.vendorId`, `Quote`, `Contract`, `Conversation`, `Installment`, `Review`, `Dispute`, `Event.hostId`, `Vendor.ownerId`. First write a script that reports orphans; add constraints `NOT VALID` then validate.
3.3 CHECK constraints for `Booking.status`, `Payment.status`, `Vendor.status`, `User.role`.
3.4 Extract `ReservationService`, `PaymentService` and `AccessService` as injectable providers; controllers delegate. No behaviour change; integration tests must still pass.
3.5 Remove unused dependencies and the `db:push` script.

## Stage 4 — Performance and reliability

4.1 Split `GET events/:id` into a summary and paginated sub-resources; update the frontend to load guests on the guests page only.
4.2 `frontend/src/lib/context.tsx`: keep only session and selected event summary; remove the global vendors fetch; refresh only what a socket event concerns.
4.3 Remove N+1 in `packages.ts` and `invoices.ts` (batch queries).
4.4 Reminder job cadence to 15 minutes; select only rows needing work.
4.5 `deploy.yml`: pull → database backup → `prisma migrate deploy` → `up -d` → health check loop → rollback to previous image tag on failure.
4.6 Structured request logging with request ID; error tracker integration behind an env variable.

## Stage 5 — UI/UX

Follow the prompt at the end of `product-audit/event-wedding-management/ui-ux-audit.md` (role-based navigation, confirmation dialogs, guest tools, vendor studio split, friendly errors, Bangla for public pages, CSS split, mobile Playwright projects).

## Stage 6 — Missing commercial features

6.1 **Notification service.** `NotificationService` with `send(channel, to, template, data)`; adapters: console (dev), SMTP/email API, HTTP SMS. Queue through BullMQ with retries and a de-duplication key. Templates: verification, reset, collaborator invite, new inquiry, quotation received, booking recorded, subscription reminders.
6.2 **Uploads.** Presigned upload to S3-compatible storage; validate MIME by magic bytes, max 5 MB, images only; `VendorMedia` table (vendorId, url, order); cover and gallery management in the vendor pages.
6.3 **Inquiry → quotation → recorded booking.** Structured inquiry (date, guests, budget, message) creates/uses the conversation and a `Lead` for the vendor; multi-line quotation; on acceptance create a booking with status `CONFIRMED_OFFLINE` and optional milestones tracked in the host budget. Keep the existing hold flow available but not default.
6.4 **Vendor verification.** `VendorDocument` (type, file, status, reviewer, note); admin queue; verified badge.
6.5 **Admin.** Paginated, searchable vendors, documents, disputes; admin action audit log.

## Stage 7 — Monetization and subscription

7.1 Models: `Plan` (code, name, monthlyMinor, annualMinor, limits JSON, active), `VendorSubscription` (vendorId unique, planId, status `FREE|ACTIVE|GRACE|EXPIRED`, periodStart, periodEnd), `SubscriptionPayment` (vendorId, planId, period, amountMinor, method, reference, status, reviewer, note; unique `(method, reference)`), `SubscriptionEvent`.
7.2 `EntitlementService.limits(vendorId)` used by media count, package count, quotation quota, CRM access.
7.3 Vendor pages: plans, submit payment reference (bKash/Nagad/bank), billing history, PDF receipt.
7.4 Admin: review payment (must enter the exact received amount), grant with idempotency key, suspend.
7.5 Jobs: reminders at T-7, T-1, T; grace 7 days; downgrade to Free without deleting data.
7.6 Tests: duplicate reference rejected; amount mismatch rejected; double approval activates once; downgrade keeps media but hides the excess.

(Reference implementation of the same pattern exists in the sibling repository `school-college-erp/backend/src/saas/` — read it for design, do not copy tenant-specific code.)

## Stage 8 — Production infrastructure

8.1 Separate env files for web and API in compose; the web container must not receive `DATABASE_URL` or `JWT_SECRET`.
8.2 Nightly `pg_dump` to object storage, 14-day retention, documented restore; restore drill script.
8.3 Staging stack definition (compose) with seeded demo data.
8.4 Uptime probe and alerting; container restart alerts.
8.5 Runbooks in `deploy/`: deploy, rollback, restore, rotate secrets.

## Stage 9 — Final QA and regression

9.1 All backend integration tests green in CI with Postgres + Redis services.
9.2 Playwright suites green on desktop and a 360×800 mobile project.
9.3 Execute `product-audit/testing/load-testing-plan.md` against staging and record p50/p95/p99, error rate, CPU, DB connections.
9.4 Re-run every row of `product-audit/event-wedding-management/test-cases.md` and update statuses.
9.5 Produce a short readiness note listing what passed, what failed and what was not run.

## Global acceptance criteria

- No route returns data for an event or vendor the caller cannot access (add negative tests for each new route).
- A production build cannot confirm a payment without a gateway.
- A vendor can register, complete a profile with photos, be verified, buy a plan, receive an inquiry notification, send a quotation and see the recorded booking.
- A host can sign up, recover a password, manage guests end to end, share RSVP links, and record a vendor booking.
- Backups restore; deploy rolls back on failure; CI blocks regressions.
