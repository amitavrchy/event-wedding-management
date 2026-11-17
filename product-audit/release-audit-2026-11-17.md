# Utsab / Ayojon — release audit, 2026-11-17

Product: event and wedding planning workspace with a vendor marketplace for Bangladesh. Web app brands itself **utsab**, the mobile app **Ayojon**; the brand decision is still open.

Audited commit: `e78340e` on `main` (clean tree before this audit). Changes made during the audit are listed in section 3 and are uncommitted in the working tree.

## 1. Scope, environment and coverage

Environment (local, synthetic data, no production access):

| Component | Build / run | Notes |
|---|---|---|
| API (NestJS 11, Prisma 6, Postgres 17-compatible, Redis 7) | built from source, `npm start` on :4000 | `PAYMENT_MODE=sandbox`, console email/SMS/push drivers, local file storage |
| Web (Next 16) | `next build` + `next start` on :3000 | production build, security headers on |
| Worker | in-process (dev mode) | production runs a separate container |
| Mobile (Flutter 3.47, Riverpod) | iOS simulator debug build (iPhone 17e, iOS 27) | launch verified; sign-in flows covered by widget tests, not driven on device |
| Database | fresh `utsab_audit` DB, all 11 migrations applied, demo seed | no legacy data available |

Seeded roles used: host, vendor, platform admin, plus accounts created by the journey script.

Coverage matrix (RV = runtime verified, CR = code reviewed only, B = blocked, NA = not applicable):

| Area | Web | Mobile | API | Admin |
|---|---|---|---|---|
| Sign-up, email verification, login, lockout, logout, password reset, 2FA | RV (browser suite + 78-step API journey) | CR + widget tests; launch RV | RV | NA |
| Event creation, checklist, budget, guests, CSV, seating, run sheet, check-in | RV (24 browser tests, 45 backend tests) | CR (tool screens) | RV | NA |
| Public RSVP / family RSVP / celebration site / photo wall | RV | NA | RV | NA |
| Vendor onboarding, services, profile, availability | RV | CR | RV | RV (approve/suspend) |
| Inquiry → quote → accept → booking → offline payment / sandbox payment / webhook | RV | CR | RV | RV (ledger) |
| Vendor subscription (manual bKash/Nagad review, receipt, renewal stacking) | RV | CR | RV | RV |
| Messaging (HTTP + Socket.IO) | RV (HTTP), CR (socket) | CR | RV | NA |
| Notifications (in-app), email/SMS/push delivery | RV (in-app, console drivers) | CR | RV | NA |
| Live payment gateway, real SMS/email/push, S3 storage | B (no credentials; sandbox only) | B | B | B |
| Android/iOS store builds, signing, deep links | B (debug simulator build only) | B | NA | NA |
| Backups, restore drill, deploy rollback | CR (`deploy/scripts/*.sh`, `deploy.yml`) | NA | NA | NA |

Automated results at the audited commit:

| Suite | Result |
|---|---|
| Backend unit + DB tests (`npm test`) | 44/44 (45/45 after the new regression test) |
| Browser suite (Playwright, desktop Chrome) | 24/24 |
| Flutter analyze / test | clean / 79 passed |
| npm audit (backend, frontend) | 0 vulnerabilities |
| API journey script (host, second host, vendor, admin; 78 checks) | 77/78 before fix, 78/78 after |
| Page sweep: 181 page/viewport checks, 3 viewports (375 / 820 / 1440), 4 roles | 0 horizontal overflow, 0 page errors, 0 text under 12 px, 1 `h1` per page, load < 1 s |

Observed journey timings (local): sign-up to first event with starter checklist, 2 API calls; host from sign-up to a confirmed booking (inquiry, quote, accept) under 10 interactions. First meaningful outcome for a host is the populated planning checklist and countdown on the dashboard; for a vendor it is the first inquiry notification.

## 2. Findings

| ID | Sev | Roles / surfaces | Expected | Actual | Evidence | Status |
|---|---|---|---|---|---|---|
| U-01 | P1 | Host, collaborator; web + mobile via `GET /bookings`, `GET /events/:id`, `GET /invoices/*`, public `GET /packages` | Hosts see only public vendor fields | Full vendor row returned, including `commissionBps` (the platform's cut), `ownerId`, `planCode`, `featuredUntil`, `status` | Journey check "host booking list does not expose vendor commission/owner" failed: `leaked=commissionBps,ownerId,planCode` | **Fixed**, retested (journey 78/78, new test in `backend/test/marketplace.test.ts`) |
| U-02 | P2 | Operator | Deploy and signing produce store-ready artifacts | Release APK/AAB fall back to debug signing when `android/key.properties` is absent; iOS signing not configured; `sslip.io` IP host used for API, web, deep links | `mobile/scripts/build-release.sh`, `mobile/android/app/build.gradle*`, prior QA-01/QA-03 | Open, owner: mobile release engineer |
| U-03 | P2 | Buyer, vendor | One product name everywhere | Web and emails say "utsab"/"Ayojon" inconsistently; mobile app and bundle id are Ayojon | Screenshots `host--_dashboard--*`, `ios/ewm-01-launch.png`; `EMAIL_FROM="Ayojon ..."` | Open, owner: product owner |
| U-04 | P2 | Operator | Payments configured for launch | `PAYMENT_MODE=disabled` in production: bookings are confirmed by vendors and paid off-platform (cash/bKash recorded by the vendor). Commission ledger only fills from sandbox payments | `backend/src/config.ts`, `bookings.ts` offline payments | Open by design; decide commission model before selling |
| U-05 | P3 | Anonymous visitor | No failed calls on public pages | Every public page calls `GET /api/auth/me` and `POST /api/auth/refresh` (two 401s per load, logged to console) | Sweep: 45 public page checks each show the two 401s | Open, owner: web |
| U-06 | P3 | Host | Clear time zone label | Booking cards show times as "02:59 BST"; BST reads as British Summer Time to many users | `host--_bookings--mobile.png` | Open, owner: web |
| U-07 | P3 | Vendor | Realistic placeholder | New vendor without an image gets a hard-coded Unsplash wedding photo as profile image | `backend/src/vendors.ts` `onboard` default | Open |
| U-08 | P3 | Admin | Paginated lists | `GET /admin/ledger` is unpaginated | `backend/src/admin.ts` | Open |
| U-09 | P3 | Test env | Environment-independent tests | `rate-limit.test.ts` fails when `RATE_LIMIT_AUTH_PER_MINUTE` is set in `.env` | local run 43/44 | Open (CI sets the variable only for the started server) |

Verified correct (no finding): cross-account access to events, guests, conversations, payments, inquiries, receipts (403/404); CSRF client header on cookie writes; httpOnly cookies; refresh rotation and reuse revocation; lockout after 5 failures; password reset single use and session revocation; webhook HMAC; idempotent payments, offline payments and subscription approvals; double-booking exclusion (409); quote/breakdown validation; public vendor allowlist; CSP, HSTS (prod), nosniff, frame-deny; helmet; 0 npm vulnerabilities.

## 3. Changes made

| File | Change | Verification |
|---|---|---|
| `backend/src/vendors.ts` | Added `vendorCardSelect` / `vendorContactSelect` safe projections | tsc clean |
| `backend/src/bookings.ts`, `events.ts`, `invoices.ts` | Booking, event-detail and invoice responses embed the contact projection (adds phone, which a booked host may see) | journey 78/78 |
| `backend/src/packages.ts` | Public package list embeds the card projection (no phone) | backend tests 45/45 |
| `backend/test/marketplace.test.ts` | New test: booking/event/invoice/package records never expose `ownerId`, `commissionBps`, `planCode`, `status`, `featuredUntil` | passes; fails on the old code |
| `frontend` | No change needed; `npx tsc --noEmit` clean against the narrowed shapes | Browser suite 24/24 |

## 4. Open issues with acceptance tests

| Issue | Acceptance test | Dependency / owner |
|---|---|---|
| U-02 production signing and domain | `./mobile/scripts/build-release.sh` fails without `key.properties`; `apksigner verify --print-certs` shows the upload key; API/web/socket URLs and asset-links host are the owned domain | Play Console, Apple team, domain + TLS — mobile/ops owner |
| U-03 brand | One name in web header, emails, app name, bundle id, store listing | product owner |
| U-04 commission model | Either a gateway adapter in `payments.ts` with sandbox then live verification, or a documented off-platform commission process | business + backend |
| Real email/SMS/push | Sign-up email, password reset and inquiry SMS arrive on a real inbox/handset from staging | provider credentials — ops |
| Backup + restore drill on the host | `scripts/backup.sh` run by cron, `scripts/restore-drill.sh` output recorded once | ops |
| U-05 | Public pages make no auth calls when no session cookie is present | web |
| U-06 | Times render as "02:59 (Dhaka)" or "+06" | web |

## 5. Release checklist

- Onboarding: host sign-up, email verification and starter checklist verified locally; verify on staging with real email delivery.
- Support: admin console covers vendor approval, verification queue, subscription payments and audit-log export; add a support mailbox/phone to the landing, terms and privacy pages (none found).
- Deployment: `deploy/scripts/release.sh` does backup → migrate → up → health check → rollback; CI gates deploy. Replace `sslip.io` hosts, set `CORS_ORIGINS`, `APP_URL`, SMTP/SMS/FCM/S3 secrets, `TOTP_ENCRYPTION_KEY`, `BACKUP_PASSPHRASE`.
- Monitoring: `/api/health` (DB + queue) and worker heartbeat exist; add uptime alerting and error reporting (none configured).
- Data recovery: nightly encrypted backup script present; run the restore drill before the first paying vendor.
- Payments: sandbox only. Decide U-04 before charging anyone.
- Mobile: production signing, store accounts, privacy manifest/legal review, Firebase project for push, verified deep links; test on at least one Android and one iOS device.

## 6. Verdict: **Ready for a controlled pilot** (not ready to sell)

Evidence: all advertised planning and marketplace journeys work end to end on web and API with correct access control, idempotent money paths, and a clean visual sweep; the one confirmed data exposure (U-01) is fixed and regression-tested. The pilot must be limited to invited hosts and vendors on the web app with manual, off-platform payments and manual subscription review, on an owned domain with real email/SMS delivery and backups running.

Conditions to move to "Ready to sell": U-02 (signed store builds on real devices), U-03 (brand), U-04 (commission/payment model decided and verified), real notification delivery verified on staging, restore drill recorded, legal review of terms/privacy and the mobile privacy manifest, and uptime/error monitoring in place.
