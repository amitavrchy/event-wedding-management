# Event & Wedding Management — Code Quality Audit

Commit `19e6734`. Line counts from `wc -l` on tracked files.

## 1. Size and shape

| Area | Files | Lines | Notes |
|---|---:|---:|---|
| `backend/src` | 42 | 4,409 | Largest: `event-templates.ts` 323 (static data), `vendors.ts` 228, `collaboration.ts` 219, `payments.ts` 212 |
| `backend/test` | 4 | 1,131 | `advanced.test.ts` 637, `integration.test.ts` 307 |
| `backend/prisma` | schema 404, seed 514, migrations ~700 | | |
| `frontend/src` (TS/TSX) | 62 | ~8,300 | 24 workspace pages between 120 and 370 lines each |
| `frontend/src/app/*.css` | 3 | 9,347 | `advanced.css` 3,244, `globals.css` 3,174, `landing.css` 2,929 |

The code base is small and consistent in style (Prettier). The whole product was committed in a three-day window (2026-11-03 to 2026-11-05) in 76 commits, which matches what the code shows: wide feature coverage, thin depth per feature.

## 2. Maintainability findings

| ID | Class | Finding | Evidence |
|---|---|---|---|
| E-C1 | CONFIRMED ARCHITECTURAL WEAKNESS | Business rules live in HTTP handlers; no service layer, so rules cannot be reused by jobs or tested without a database | all `backend/src/*.ts` controllers |
| E-C2 | CONFIRMED ARCHITECTURAL WEAKNESS | The "active booking" predicate is duplicated six times instead of one helper; a status change must be made in all six | `vendors.ts:62-71`, `:119-128`, `:207-219`; `availability.ts:27-36`, `:107-121`; `recommendations.ts:24-33` |
| E-C3 | CONFIRMED ARCHITECTURAL WEAKNESS | Magic numbers in business logic: 30 % advance (`reservations.ts:84`), 15-minute hold (`:85`), 7-day invite expiry (`collaboration.ts:112`), default 10 % commission (`schema.prisma` `commissionBps @default(1000)`), 180/20 rate limits (`rate-limit.ts:23`) | as cited |
| E-C4 | CONFIRMED BUG | `scripts/verify.mjs:8-15` throws unless the repository root contains exactly `backend` and `frontend`; the root now also has `.github`, `deploy`, `.gitignore`, so `npm run verify` cannot pass | `backend/scripts/verify.mjs` |
| E-C5 | CONFIRMED BUG | The CI workflow is stored at `backend/ci/workflows/ci.yml`, where GitHub does not read it. The only active workflow deploys without running tests | `backend/ci/workflows/ci.yml`, `.github/workflows/deploy.yml` |
| E-C6 | Low | Unused dependencies: `class-validator`, `class-transformer` (runtime); `multer`, `deepmerge-ts` listed in devDependencies and overrides | `backend/package.json` |
| E-C7 | Low | `req: any` in every controller method; the JWT payload type `Identity` exists but is not applied to requests | `auth.ts:15`, all controllers |
| E-C8 | Low | Hard-coded default vendor image pointing at a third-party host | `vendors.ts:147-151` |
| E-C9 | Low | Module-level mutable singleton for the Socket.IO server | `realtime.ts:6` |
| E-C10 | Medium | Three global stylesheets totalling 9,347 lines are imported by the root layout, so every page — including the public RSVP page — ships all landing and workspace CSS | `frontend/src/app/layout.tsx:3-5` |
| E-C11 | Medium | Frontend pages mix data fetching, form state, business formatting and layout in single 250–370-line client components | e.g. `seating/page.tsx` 370, `website/page.tsx` 366, `guests/page.tsx` 356 |

## 3. Type safety

`strict: true` in both `tsconfig.json` files. The backend loses type information at the request boundary (`any`), in Socket.IO acknowledgements (`ack: (value: any) => void`) and for JSON columns (`Quote.breakdown`, `EventWebsite.faqs`). The frontend defines response types by hand in `frontend/src/lib/types.ts` (121 lines); nothing guarantees they match the API.

## 4. Naming and consistency

Consistent: file-per-feature, zod schema inline, `ownEvent`/`ownVendor` first line of each handler, minor-unit integer money with a `Minor` suffix.

Inconsistent: `startAt/endAt` on bookings and blocks vs `startsAt/endsAt` on event days and run-sheet items; `hostId` vs `ownerId` for the same concept; mixed return shapes (entity vs `{count}` vs `{saved: true}`).

## 5. Technical debt register

| Debt | Cost if left | Effort to clear |
|---|---|---|
| No service layer around reservations/payments | Every new gateway or job duplicates rules | M |
| Free-form status strings | Silent bad states; no migration safety | S |
| Missing FKs and indexes | Orphans, slow lists as data grows | M |
| Global CSS bundles | Slow first load on mobile data | M |
| God context refetching everything | Unnecessary API load, stale-data bugs | M |
| Hand-written response types | Drift between API and UI | S (generate from zod or OpenAPI) |
| Inactive CI | Regressions reach production | S |

## 6. Verification performed

Type-check and unit-test results for this repository are recorded in `../testing/execution-results.md`. Nothing in this file depends on documentation claims; every row cites source.
