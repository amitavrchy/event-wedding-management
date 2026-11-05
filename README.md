# Utsab ✳

A wedding and event workspace for Bangladesh. Discover your people, hold your dates, and bring the little details together.

Next.js 16 / React 19 · NestJS 11 · Prisma 6 · PostgreSQL 17 · Redis / BullMQ · Socket.IO

## Start locally

Requires Node.js 22+ (validated with 24), npm, and Docker Desktop running Linux containers. From this repository, in PowerShell:

```powershell
npm ci
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
docker compose up -d --wait
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open **http://localhost:3000**. The API is at **http://localhost:4000/api**; database and Redis use ports **5544** and **6388** to avoid common local conflicts. Override `POSTGRES_PORT` / `REDIS_PORT` and connection URLs together if needed.

Demo accounts all use the password **`UtsabDemo2027!`**:

| Role          | Email                |
| ------------- | -------------------- |
| Host          | `host@utsab.local`   |
| Vendor        | `vendor@utsab.local` |
| Administrator | `admin@utsab.local`  |

Demo seeding refuses `NODE_ENV=production` and is safe to repeat without replacing existing plans. Use a separate database for real customers.

## Included workflows

- Registration, bcrypt passwords, expiring signed sessions, role and ownership checks.
- Active vendor catalog with portfolio covers, category/city/text/date API filters, prices, availability, and verified reviews.
- Vendor applications, services, calendar blocks, custom quotes, admin activation and commission controls.
- Multi-day holud, wedding, reception, and corporate celebrations with checklists and deadlines.
- Reservations with duration/buffer snapshots, 15-minute holds, advisory transaction locks, and a database exclusion constraint.
- Curated discounted collections and custom multi-vendor carts. Checkout holds all services atomically; an unavailable service rolls back the whole collection.
- Sandbox advances and balances, idempotent capture, exact commission ledger, manual payout reconciliation, cancellation review with sandbox refunds, and signed webhook boundary.
- Planned/category budgets, confirmed commitments, actual payments plus manual expenses, overcommit warnings, and CSV export.
- Guests, bounded CSV import/export, cryptographic public RSVP links, companion allowance, meals, seating, deadlines, and capacity warnings.
- Persistent conversations with authenticated Socket.IO rooms and HTTP polling fallback.
- BullMQ expiration jobs and deduplicated in-app balance, RSVP, and task reminders.
- Responsive desktop/mobile layouts, keyboard-focus states, accessible native dialogs, reduced-motion support, and a minimum 14px text size.

## Verify

```powershell
npm run build
# Point this at a disposable database with migrations already applied:
$env:TEST_DATABASE_URL = 'postgresql://utsab:local-development-only@localhost:5544/utsab'
npm test
# Start the app first, then:
npx playwright install chromium
npm run test:e2e
npm audit
```

The integration suite checks concurrent reservations, direct SQL overlap protection, expired-hold replacement, atomic cart rollback, advance/balance accounting, duplicate capture, ownership isolation, RSVP allowance, and capacity warnings. Without `TEST_DATABASE_URL`, database integration is explicitly skipped. Eight browser tests cover the main host/vendor/admin flows, public RSVP, realtime chat, desktop/mobile layout, and rendered minimum font sizes. Browser tests add development fixtures; run them against a disposable seeded database.

`npm run build` followed by `npm start` runs both production servers. Use migrations, rather than `db:push`, for normal setup: the exclusion and check constraints live in SQL migrations.

## Integration boundaries

Payments are **sandbox only**: no real money is charged. Live bKash, Nagad, and SSLCommerz checkout/verification adapters and credentials still need implementation before accepting payments. The webhook endpoint is an internal HMAC boundary, not a claim of compatibility with those gateways. Payouts record manual settlement; they do not transfer funds. Paid cancellations open an administrator review; approved sandbox refunds cancel the booking and reverse simulated captures and ledger status. Live refunds still require gateway integration.

Reminders are delivered inside the app. External SMS/email delivery, signed media uploads, optional planner invitations, and vendor team management remain integration/follow-up work. Portfolio covers currently use external HTTPS images. Production should use controlled media hosting and a shared rate limiter behind a correctly configured trusted proxy. Sessions currently use tab-scoped browser storage; deploy behind HTTPS and consider an HttpOnly-cookie session boundary for a hardened public deployment.

For deployment and API details, see [docs/OPERATIONS.md](docs/OPERATIONS.md) and [docs/API.md](docs/API.md). The original requirements remain in [Project_spec.md](Project_spec.md).
