# Event & Wedding Management — Prioritized Fix Backlog

IDs match the audit files. Effort: S ≤ 3 days, M ≤ 2 weeks, L > 2 weeks. "Verify" is the acceptance check.

## P0 — launch blockers

| # | ID | Item | Files | Effort | Verify |
|---|---|---|---|---|---|
| 1 | SEC-INC | Close the 2026-11-13 compromise: review Actions runs, rotate all credentials, protect `main`, remove attacker's root `.gitignore`, rebuild images | repo settings, `.gitignore`, host `.env` | S | Written record; `git ls-files .gitignore` shows an intentional file |
| 2 | E-C5 / E-R2 | Move CI to `.github/workflows/ci.yml`; make `deploy.yml` require it; fix `verify.mjs` root check | `backend/ci/workflows/ci.yml`, `.github/workflows/deploy.yml`, `backend/scripts/verify.mjs` | S | A failing test blocks deploy |
| 3 | E-S1 | Refuse sandbox confirmation when `NODE_ENV=production`; default `PAYMENT_MODE` to disabled in `deploy/.env.example` | `backend/src/payments.ts`, `deploy/.env.example` | S | EWM-081 passes |
| 4 | E-S2 / E-S3 | httpOnly cookie session with server-side revocation; logout; password reset; verification | `backend/src/auth.ts`, `main.ts`, `frontend/src/lib/api.ts`, `context.tsx`, `socket.ts`, new pages | M | EWM-022, EWM-023 pass |
| 5 | E-R1 | Nightly encrypted off-host backups + restore drill | host/cron or managed DB | S | Restore into scratch DB succeeds |
| 6 | E-R3 | Deploy order: backup → migrate → up → health check → rollback | `.github/workflows/deploy.yml` | S | Failed health check rolls back |
| 7 | E-B4 | Provision Redis; run worker as its own container; health reports worker state | `deploy/docker-compose.prod.yml`, `backend/src/jobs.ts` | S | Holds expire; reminders appear |
| 8 | E-B2 | Paginate/order vendor list and recommendations; SQL availability filter | `backend/src/vendors.ts`, `recommendations.ts`, `frontend/src/app/(workspace)/vendors/page.tsx` | M | EWM-063 passes |
| 9 | E-S4 | Public vendor field allowlist | `backend/src/vendors.ts` | S | EWM-062 passes |
| 10 | E-B8 | Edit/delete: guests, tasks, expenses, days, services; archive event; vendor PATCH | `guests.ts`, `events.ts`, `budget.ts`, `vendors.ts`, matching pages | M | EWM-032, 042, 061 pass |
| 11 | MON | Vendor subscription system (manual review first) | new models, routes, pages | L | Activation idempotent; receipt downloadable |
| 12 | NOTIF | Notification service with SMS/email adapters | new `notifications` service, job | M | Inquiry triggers a message to the vendor |
| 13 | UPLOAD | Image upload to object storage with type/size validation | new upload route, vendor pages | M | Non-image rejected; images served via CDN |

## P1 — high priority

| ID | Item | Files | Effort |
|---|---|---|---|
| E-B1 | Vendors and collaborators can list their disputes | `backend/src/disputes.ts` | S |
| E-S8 | Require conversation before quote; cap breakdown | `backend/src/packages.ts` | S |
| E-S5 / E-S11 | Per-slug password attempt limiter; guestbook throttle | `backend/src/websites.ts` | S |
| E-S6 | Redis-backed rate limiter; per-account login lock | `backend/src/rate-limit.ts` | S |
| E-S9 | Security headers / CSP on Next | `frontend/next.config.ts` | S |
| E-D2 | Missing indexes migration | `backend/prisma` | S |
| E-D1 | Foreign keys for payment, ledger, booking, quote, contract, conversation | `backend/prisma` | M |
| E-B14 | Role-based navigation; expose hidden tools | `frontend/src/components/shell.tsx` | S |
| UX | Confirmation dialogs; friendly validation messages | `frontend/src/components/ui.tsx`, pages | S |
| E-B13 | Split context; stop refetching vendors and full event | `frontend/src/lib/context.tsx` | M |
| VERIFY | Vendor verification documents + admin queue | new | M |
| I18N | Bangla for RSVP and celebration site | frontend | M |
| MON-OPS | Monitoring, error tracking, uptime alerts | infra | S |
| DOMAIN | Real domain, TLS, HSTS | infra | S |

## P2 — medium

| ID | Item | Effort |
|---|---|---|
| E-B3 | Automation re-arm semantics; skip already-run rules in the query | S |
| E-B9 | Reminder day key in Asia/Dhaka; include collaborators | S |
| E-B11 | Reviews: host only, moderation, vendor reply | M |
| E-B12 | Stored invoices/receipts; vendor-defined milestones | M |
| E-D3 | Status CHECK constraints/enums; audit columns | M |
| E-C1 | Extract reservation, payment and notification services | M |
| E-C10 | Route-level CSS | M |
| E-B10 | 404 for missing resources; consistent response shapes | S |
| E-S7 | Gateway-specific webhook with raw-body verification (when a gateway is chosen) | M |
| ADMIN | Paginated admin lists; admin audit log; admin user management | M |
| E-C6 | Remove unused dependencies; `db:push` script | S |

## P3 — later

On-platform payments and settlement; commission; featured listings; SEO pages; PWA; AI-assisted drafts; corporate accounts.

## Dependencies

- 4 before 12 (verification messages need the notification service — build a minimal one together).
- 13 before vendor verification.
- 7 before reminders/automations are advertised.
- 2 before any other merge, so every later fix is tested automatically.
