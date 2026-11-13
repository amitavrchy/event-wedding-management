# Event & Wedding Management — Backend Engineering Audit

Static review of `backend/src` (42 files, 4,409 lines) at commit `19e6734`.

## 1. Architecture

| Aspect | Assessment |
|---|---|
| Structure | One module, 34 controllers, no services. Controllers own validation, authorization, business rules and persistence. Readable at this size, but nothing can be reused or unit-tested without Prisma |
| Shared logic | `reserve()` (`reservations.ts`) is the only real domain function shared across controllers (bookings and cart). Availability-conflict queries are copy-pasted in `vendors.ts:62-71`, `:119-128`, `:207-219`, `availability.ts:27-36`, `:107-121`, `recommendations.ts:24-33` |
| Dependency injection | Controllers call each other's methods directly in tests; `PaymentsController.capture` is a public method used as a service |
| Coupling | `realtime.ts` exports module-level singletons (`broadcast`) used by controllers — works for one process only |
| Typing | `req: any` on every handler; identity is not typed at the boundary. `strict` TypeScript is on |
| Dead weight | `class-validator`, `class-transformer`, `deepmerge-ts`, `multer` are declared but not used in `src` |

**Recommendation (CONFIRMED ARCHITECTURAL WEAKNESS):** extract services only where rules are reused or risky — reservations, payments/ledger, access, notifications. Do not restructure all 34 controllers.

## 2. API quality

| Topic | Finding | Evidence |
|---|---|---|
| Pagination | No list endpoint accepts page/limit. Hard caps hide data instead: vendors `take: 100`, conversations `take: 100` with no ordering, messages last 200, reviews 50 | `vendors.ts:76`, `messages.ts:37`, `:67`, `vendors.ts:109` |
| Sorting | Vendor list has no `orderBy`, so which 100 vendors appear is arbitrary | `vendors.ts:51-77` |
| Search | Vendors: `businessName` contains, exact `category`, exact case-sensitive `city`. No price filter server-side | `vendors.ts:52-57` |
| Status codes | Missing bookings and invitations return 400 instead of 404 | `bookings.ts:62`, `guests.ts:92` |
| Response shape | `updateMany` / `deleteMany` results (`{count}`) are returned raw to clients; other routes return entities | `events.ts:165`, `guests.ts:76`, `crm.ts:71` |
| Versioning / docs | None. `backend/docs/API.md` is hand-written | — |
| Validation | Consistent zod parsing. Gaps: `budget/:category` path parameter is unvalidated; `city` has no max length on event create; quote `breakdown` unbounded | `budget.ts:44-56`, `events.ts:36`, `packages.ts:75-77` |

## 3. Business logic

### Correct and worth preserving

- Booking holds: advisory lock per service, lazy expiry of stale holds, overlap check, and a database exclusion constraint as a second line of defence (`reservations.ts:15-53`, migration `202611050002_integrity`).
- Payment creation and capture: per-booking advisory lock, idempotency key with payload match, advance-once rule, cannot exceed price, ledger row with exact commission split (`payments.ts:54-111`, `:145-205`).
- Cart checkout locks services in sorted order to avoid deadlocks (`cart.ts:33-53`).
- Optimistic `version` checks on website, seating and run-sheet edits.

### Defects

| ID | Class | Finding | Evidence |
|---|---|---|---|
| E-B1 | CONFIRMED BUG | Vendors and collaborators can file a dispute but can never see it: the non-admin list only returns disputes for events the caller hosts | `disputes.ts:21-32`, `:41-43` |
| E-B2 | CONFIRMED BUG | Marketplace list silently truncates at 100 vendors with no ordering | `vendors.ts:51-77`, `recommendations.ts:17-38` |
| E-B3 | CONFIRMED BUG | Each automation rule can fire once in its lifetime (`AutomationRun.key = ruleId:eventId` is unique), yet every enabled rule is re-evaluated every minute with a full event load | `automations.ts:21-49` |
| E-B4 | CONFIRMED BUG | With `REDIS_URL` empty — the shipped production default — no job runs: bookings and quotes are never marked `EXPIRED` by the worker, no reminders are created, automations never execute | `jobs.ts:12`, `deploy/.env.example` |
| E-B8 | MISSING FEATURE | No update/delete for guests (except table label), event days, tasks (except done flag), expenses, events, vendor profile, vendor services | `guests.ts`, `events.ts`, `budget.ts`, `vendors.ts` |
| E-B9 | CONFIRMED BUG | Reminder de-duplication key uses the UTC date, so "daily" reminders roll over at 06:00 Dhaka time; reminders go only to the host, never to collaborators or vendors | `reminders.ts:5`, `:22`, `:45` |
| E-B11 | CONFIRMED BUG | Any editor collaborator can submit the single review a booking allows, recorded under their own user ID | `reviews.ts:29-36` |
| E-B12 | PRODUCT IMPROVEMENT | The host — not the vendor — defines the instalment plan; "invoices" are computed on read and never stored | `invoices.ts:31-71`, `:73-140` |
| E-B15 | CONFIRMED BUG | `CrmController.update` writes an audit entry even when `updateMany` matched nothing | `crm.ts:70-83` |
| E-B16 | POTENTIAL RISK | Refund marks ledger entries `REFUNDED` even if the payout was already marked `PAID`; there is no claw-back record | `disputes.ts:85-88`, `admin.ts:44-49` |

## 4. Error handling

- Global filter maps known Prisma errors and hides internals (`errors.ts`). Unknown errors are logged with `Logger.error(error)` but without request ID, user or route.
- No structured logging, no request logging, no error tracker.
- No outbound calls exist yet, so there is no timeout/retry policy to assess. When a gateway and SMS provider are added, each call needs a timeout and an idempotent retry.
- Socket handlers swallow all errors and return a generic message (`realtime.ts:95-97`, `:130-133`); nothing is logged.

## 5. Queries

| Pattern | Evidence |
|---|---|
| N+1 per package | `packages.ts:21-36` |
| N+1 per booking (2 queries each) | `invoices.ts:37-71` |
| N+1 in the every-minute job | `reminders.ts:10-27`, `:35-50`; `automations.ts:25-34` |
| Whole-event loads on every screen refresh | `events.ts:82-104` returns all guests, bookings, expenses |
| In-memory availability filtering over full booking/block sets | `vendors.ts:79-97`, `recommendations.ts:40-95` |

## 6. Tests

`backend/test/domain.test.ts` and `event-templates.test.ts` are pure unit tests. `integration.test.ts` and `advanced.test.ts` instantiate controllers against a real database and are skipped without `TEST_DATABASE_URL`. There are no HTTP-level tests, so guards, the exception filter and the rate limiter are untested. See `../testing/execution-results.md` for what was actually run.

## 7. Recommendations (ordered)

1. Remove the sandbox self-confirmation path from production builds (see `security-audit.md` E-S1).
2. Fix E-B1, E-B2, E-B4 — each breaks a visible workflow.
3. Add page/limit/orderBy to every list route; return entities or `204`, never `{count}`.
4. Add the missing edit/delete routes (E-B8) before launch; hosts will make typos in guest lists.
5. Extract `ReservationService`, `PaymentService`, `NotificationService`; add HTTP-level tests around them.
6. Remove unused dependencies; type the request identity.
