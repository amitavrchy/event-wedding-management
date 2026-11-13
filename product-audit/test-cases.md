# Event & Wedding Management — Test Cases

Status legend: PASS / FAIL / BLOCKED / NOT RUN / NOT APPLICABLE. "Static" means the result was derived by reading the code path, not by executing it; a static FAIL is a confirmed defect in source, a static expectation of success is recorded as NOT RUN.

Environment for executed rows: exported copy of commit `19e6734`, macOS, Node v20.18.0, no database.

| ID | Module | Scenario | Preconditions | Steps | Expected | Actual | Status | Sev | Evidence | Fix |
|---|---|---|---|---|---|---|---|---|---|---|
| EWM-001 | Build | Backend type-check | deps installed | `npx tsc --noEmit` | exit 0 | exit 0 | PASS | — | run log | — |
| EWM-002 | Build | Frontend type-check | deps installed | `npx tsc --noEmit` | exit 0 | exit 0 | PASS | — | run log | — |
| EWM-003 | Deps | Known vulnerabilities | lockfiles | `npm audit` ×2 | 0 high/critical | 0 at all levels | PASS | — | run log | — |
| EWM-004 | Domain | Commission conserves money | — | `tsx --test test/domain.test.ts` | pass | 6/6 pass | PASS | — | run log | — |
| EWM-005 | Templates | Budget allocation conserves minor units | — | `tsx --test test/event-templates.test.ts` | pass | 1 pass, 1 skipped (DB) | PASS | — | run log | — |
| EWM-006 | Tooling | Verification script | — | `node scripts/verify.mjs` | exit 0 | throws on root layout | **FAIL** | Med | `scripts/verify.mjs:8-15` | Allow `.github`, `deploy`, dotfiles |
| EWM-007 | CI | Tests run on push | — | inspect workflows | CI runs tests | only `deploy.yml` is active | **FAIL** (static) | High | `backend/ci/workflows/ci.yml` | Move to `.github/workflows` and gate deploy |
| EWM-010 | Booking | Parallel holds, one winner | Postgres | `test/integration.test.ts` | one 201, one 409 | not executed | BLOCKED | Crit | needs `TEST_DATABASE_URL` | Run in CI |
| EWM-011 | Payment | Idempotent advance capture, exact ledger | Postgres | same file | single capture | not executed | BLOCKED | Crit | — | Run in CI |
| EWM-012 | Advanced | Collaboration, seating, contracts, CRM | Postgres | `test/advanced.test.ts` | pass | not executed | BLOCKED | High | — | Run in CI |
| EWM-020 | Auth | Register host | API up | POST `auth/register` valid body | 201 + token | — | NOT RUN | High | `auth.ts:37-58` | — |
| EWM-021 | Auth | Register with existing email | user exists | POST same email | generic message | 409 "Email already registered" (enumeration) | FAIL (static) | Low | `auth.ts:47-48` | Generic response + email flow |
| EWM-022 | Auth | Password reset | — | request reset | email with link | feature absent | FAIL (static) | High | no route | Implement |
| EWM-023 | Auth | Logout revokes token | logged in | logout, reuse token | 401 | token valid until expiry | FAIL (static) | High | `context.tsx:107-114` | Server-side session |
| EWM-024 | Auth | Brute force login | — | 21 logins/min from one IP | 429 | 429 per IP only; resets on restart | NOT RUN | Med | `rate-limit.ts` | Redis limiter + per-account lock |
| EWM-030 | Event | Create wedding with starter plan | host | POST `events` | event + tasks + budget + day | — | NOT RUN | High | `events.ts:28-81` | — |
| EWM-031 | Event | Past start date | host | `startsAt` in past | 400 | 400 by code | NOT RUN | Low | `events.ts:44-45` | — |
| EWM-032 | Event | Delete event | host | DELETE | archived | no route | FAIL (static) | Med | `events.ts` | Add archive |
| EWM-040 | Guest | Add guest | editor | POST guest | 201 with token | — | NOT RUN | High | `guests.ts:39-49` | — |
| EWM-041 | Guest | Import 501 guests | editor | POST import | 400 | 400 (max 500) | NOT RUN | Low | `guests.ts:57` | — |
| EWM-042 | Guest | Correct a guest's name | editor | PATCH name | updated | only `tableLabel` accepted | FAIL (static) | High | `guests.ts:68-80` | Full PATCH + DELETE |
| EWM-043 | Guest | Viewer reads guest list | viewer | GET guests | no tokens | tokens removed | NOT RUN | High | `guests.ts:35-37` | — |
| EWM-050 | RSVP | Accept with party of 3, allowance 2 | guest link | POST rsvp | 400 | 400 | NOT RUN | Med | `guests.ts:137-138` | — |
| EWM-051 | RSVP | After deadline | deadline passed | POST rsvp | 400 | 400 | NOT RUN | Med | `guests.ts:135-136` | — |
| EWM-052 | RSVP | Unknown token | — | GET rsvp/x | 404 | 400 | FAIL (static) | Low | `guests.ts:92` | Return 404 |
| EWM-060 | Vendor | Apply as vendor | vendor user | POST `vendors` | status APPLIED | — | NOT RUN | High | `vendors.ts:134-162` | — |
| EWM-061 | Vendor | Edit business description | owner | PATCH vendor | updated | no route | FAIL (static) | High | `vendors.ts` | Add PATCH |
| EWM-062 | Vendor | Public list hides private fields | — | GET `vendors` | no `ownerId`/`commissionBps` | both returned | FAIL (static) | Med | `vendors.ts:79-97` | Field allowlist |
| EWM-063 | Vendor | 101 active vendors | 101 rows | GET `vendors` | paginated, all reachable | 100 arbitrary rows | FAIL (static) | High | `vendors.ts:76` | Pagination + order |
| EWM-064 | Vendor | City filter "dhaka" | vendors in "Dhaka" | GET `vendors?city=dhaka` | matches | exact case-sensitive | FAIL (static) | Low | `vendors.ts:55` | Case-insensitive / normalised |
| EWM-070 | Booking | Hold overlapping buffer | existing booking | POST `bookings` | 409 | 409 | NOT RUN | Crit | `reservations.ts:35-53` | — |
| EWM-071 | Booking | Host cancels unpaid hold | hold | PATCH status CANCELLED | cancelled | — | NOT RUN | Med | `bookings.ts:52-90` | — |
| EWM-072 | Booking | Missing booking ID | — | PATCH status | 404 | 400 | FAIL (static) | Low | `bookings.ts:62` | 404 |
| EWM-080 | Payment | Real bKash payment | prod mode | POST `payments` provider BKASH | checkout URL | 400 "Live gateway is not configured" | FAIL (static) | Crit | `payments.ts:50-53` | Implement gateway |
| EWM-081 | Payment | Self-confirm in production | `PAYMENT_MODE=sandbox` | POST sandbox-confirm | blocked | booking confirmed, ledger written | FAIL (static) | Crit | `payments.ts:113-123` | Disable in production |
| EWM-082 | Payment | Webhook with wrong signature | secret set | POST webhook | 400 | 400 | NOT RUN | High | `payments.ts:137-142` | — |
| EWM-090 | Dispute | Vendor views own dispute | vendor filed dispute | GET `disputes` | listed | empty | FAIL (static) | High | `disputes.ts:21-32` | Include vendor scope |
| EWM-091 | Dispute | Admin refund | sandbox | resolve REFUND | booking cancelled, ledger refunded | — | BLOCKED | High | integration test | — |
| EWM-100 | Quote | Vendor quotes an unrelated event | no conversation | POST `quotes` | 403 | created | FAIL (static) | Med | `packages.ts:69-90` | Require conversation |
| EWM-110 | Collab | Accept invite with other email | invite | POST accept | 403 | 403 | NOT RUN | High | `collaboration.ts:135-136` | — |
| EWM-111 | Collab | Expired member reads event | member expired | GET event | 403 | 403 | NOT RUN | High | `access.ts:18-25` | — |
| EWM-120 | Jobs | Hold expiry without Redis | `REDIS_URL` empty | wait 20 min | status EXPIRED | stays HELD (lazy expiry only on next reserve) | FAIL (static) | Med | `jobs.ts:12` | Provision Redis / worker |
| EWM-121 | Jobs | Automation fires twice | rule + condition true twice | wait | fires each time | fires once ever | FAIL (static) | Med | `automations.ts:46-49` | Re-arm semantics |
| EWM-130 | Site | Wrong site password ×200 | protected site | POST access | throttled | 180/min allowed | FAIL (static) | Med | `websites.ts:162-171` | Per-slug limiter |
| EWM-140 | UI | Mobile layout 360 px | running app | open each page | usable | — | NOT RUN | High | — | Add mobile Playwright project |
| EWM-141 | UI | Destructive action confirmation | running app | delete table | confirm dialog | no `confirm` in source | FAIL (static) | Med | grep `frontend/src` | Add dialogs |
| EWM-150 | Load | 50 req/s mixed | staging | k6 plan | p95 < 600 ms | — | NOT RUN | High | plan | Execute |
