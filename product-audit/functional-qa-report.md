# Event & Wedding Management — Functional QA Report

## 1. What was and was not executed

| Activity | Status | Evidence |
|---|---|---|
| Dependency install from lockfile (`npm ci --ignore-scripts`), backend and frontend | PASS | exit 0 on an exported copy of `19e6734`, Node v20.18.0 (project asks for `>=22`; warnings only) |
| `npm audit` backend and frontend | PASS | 0 vulnerabilities at every severity |
| `prisma generate` | PASS | Prisma Client 6.19.3 generated |
| Backend type-check `tsc --noEmit` | PASS | exit 0 |
| Frontend type-check `tsc --noEmit` | PASS | exit 0 |
| Backend unit tests (`test/domain.test.ts`, `test/event-templates.test.ts`) | PASS | 7 passed, 0 failed |
| Backend database integration tests (3 tests in `integration.test.ts`, `advanced.test.ts`, `event-templates.test.ts`) | BLOCKED | Self-skip without `TEST_DATABASE_URL`; no PostgreSQL or Docker on the audit machine |
| `node scripts/verify.mjs` | **FAIL** | `Error: Repository root must contain only frontend and backend; found .github, .gitignore, backend, deploy, frontend` |
| Playwright browser tests (3 specs) | NOT RUN | Need running API, database and browser |
| Manual end-to-end journeys in a browser | NOT RUN | Same reason |
| Load tests | NOT RUN | See `performance-scalability.md` |

Because no running system was available, every journey verdict below is a **static trace through the source**, marked as such. They tell you what the code will do, not what was observed.

## 2. Journey verdicts (static trace)

### Authentication: register → verify → login → dashboard → profile → password change → logout

| Step | Verdict | Evidence |
|---|---|---|
| Register | Works; password ≥ 10 chars; role HOST or VENDOR | `auth.ts:37-58` |
| Email verification | **NOT IMPLEMENTED** | no route, no column |
| Login | Works | `auth.ts:59-73` |
| Dashboard | Loads events + vendors + selected event | `context.tsx:60-81` |
| Profile edit | **NOT IMPLEMENTED** | no route or page |
| Password change / reset | **NOT IMPLEMENTED** | — |
| Logout | Client-side only; token stays valid for up to 8 h | `context.tsx:107-114` |

Journey result: **FAIL** (four of seven steps do not exist).

### Vendor onboarding: register → verify business → subscribe → profile → listing → inquiry → booking → analytics

| Step | Verdict | Evidence |
|---|---|---|
| Register as vendor | Works | `auth.ts:43` |
| Business application | Works; status `APPLIED` | `vendors.ts:134-162` |
| Verification | Admin toggle only; no documents | `admin.ts:25-39` |
| Subscription / payment | **NOT IMPLEMENTED** | no models or routes |
| Profile editing | **NOT IMPLEMENTED** after creation | `vendors.ts` has no PATCH |
| Listing visible | Yes once `ACTIVE`, if among the 100 returned | `vendors.ts:51-77` |
| Inquiry | Host opens a conversation; vendor cannot start one | `messages.ts:40-57` |
| Quote | Works; single line in UI | `packages.ts:69-90` |
| Booking | Host-initiated hold → simulated payment | `bookings.ts`, `payments.ts` |
| Analytics | Works | `analytics.ts:69-114` |

Journey result: **FAIL** for the commercial path (no subscription), partial otherwise.

### Customer: plan event → discover → compare → inquire → quote → book → review

Traces correctly through hold, quote acceptance and review. Booking confirmation depends on the simulated payment (`payments.ts:113-123`). Review requires the vendor to mark the booking `COMPLETED` after its end time (`bookings.ts:70-78`); there is no reminder for the vendor to do so, so reviews depend on vendor goodwill. Journey result: **PASS in sandbox only**.

### Data management: create → view → update → search → filter → export → delete

| Entity | Create | Update | Search/filter | Export | Delete |
|---|---|---|---|---|---|
| Event | yes | title/type/budget/capacity/deadline | — | — | no |
| Guest | yes + CSV import | table label only | client-side | CSV | **no** |
| Task | yes | done flag only | — | — | **no** |
| Expense | yes | **no** | — | — | **no** |
| Vendor service | yes | **no** | — | — | **no** |
| Lead | yes | yes | — | — | yes |
| Run-sheet item, table, mood item, automation | yes | yes | — | — | yes |

Journey result: **FAIL** for guests, tasks, expenses and services.

### Roles and permissions: owner → editor → viewer

`ownEvent` enforces read vs write and expiry (`access.ts:4-30`); viewers get no guest tokens; only the host manages collaborators and signs contracts. Journey result: **PASS (static)**. Database tests exist (`advanced.test.ts`) but were BLOCKED.

## 3. Edge cases (static)

| Case | Expected | Code behaviour | Verdict |
|---|---|---|---|
| Two hosts hold the same slot | One wins | Advisory lock + exclusion constraint | PASS (static) |
| Duplicate payment submit | One payment | Idempotency key | PASS (static) |
| Expired hold then pay | Rejected | `payments.ts:78-83`, `:154-160` | PASS (static) |
| Expired session | Redirect to sign-in | 401 → `utsab-expired` event | PASS (static) |
| Viewer attempts an edit | 403 | `access.ts:18-25` | PASS (static) |
| RSVP after deadline | Rejected | `guests.ts:135-136` | PASS (static) |
| Party larger than allowance | Rejected | `guests.ts:137-138` + CHECK | PASS (static) |
| Network loss during a mutation | Clear retry | Toast with error text; no retry or offline queue | PARTIAL |
| Vendor #101 | Listed | Not returned | FAIL |
| Vendor files a dispute | Visible to vendor | Not visible | FAIL |
| No Redis in production | Reminders still created | Nothing runs | FAIL |
| Invalid file upload | Rejected | No uploads exist | NOT APPLICABLE |

## 4. Defects found by QA

All are documented with evidence in `backend-audit.md`, `frontend-audit.md` and `security-audit.md`: E-S1, E-S2, E-B1, E-B2, E-B3, E-B4, E-B8, E-B14, E-C4, E-C5.

## 5. What must be run before any launch decision

1. `backend/ci/workflows/ci.yml` moved to `.github/workflows/` and green (it provisions Postgres and Redis and runs the integration and Playwright suites).
2. A manual pass of the five journeys above on a staging deployment, on a low-end Android phone and a desktop.
3. The load plan in `../testing/load-testing-plan.md` against staging.
