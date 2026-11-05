# Utsab API and operations

NestJS, Prisma, PostgreSQL, Redis/BullMQ, and Socket.IO. All server source, schema/migrations, operations documentation, infrastructure, and verification scripts live here. The independent web application lives in `../frontend/`.

## Local setup

Requires Node.js 22+ and Docker Desktop with Linux containers. From `backend/`:

```powershell
npm ci
Copy-Item .env.example .env
docker compose up -d --wait
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

The API listens on http://localhost:4000/api. PostgreSQL uses port 5544 and Redis 6388 by default. Container names/volumes retain the existing `event-wedding-management` project namespace after the folder move.

Install frontend dependencies separately (`npm --prefix ../frontend ci`). After setup, `npm run dev:all` from here starts both applications. There is no root workspace manifest or root dependency directory.

## Verification

```powershell
# Use a disposable, migrated database:
$env:TEST_DATABASE_URL='postgresql://utsab:local-development-only@localhost:5544/utsab'
npm run verify
```

`verify` enforces the exact root structure, builds both independent applications, runs backend tests, and audits both dependency trees. Database tests are explicitly skipped without `TEST_DATABASE_URL`. To include browser tests against already-running servers, use `npm run verify -- --browser`.

The retained GitHub Actions template is [ci/workflows/ci.yml](ci/workflows/ci.yml). GitHub only discovers workflows at the repository root under `.github/workflows`; automatic GitHub Actions are therefore disabled by the requested two-folder layout. The template can be used by an external runner, and the local verifier remains executable.

Read [docs/OPERATIONS.md](docs/OPERATIONS.md), [docs/API.md](docs/API.md), and [Project_spec.md](Project_spec.md). Seed accounts are for local development only and seeding refuses `NODE_ENV=production`.

The [general event templates](docs/EVENT_TYPES.md) cover 13 occasions, including birthdays, anniversaries, corporate events and conferences. New event creation can atomically add a checklist, budget allocations, and a dated schedule. Seeded examples also include cake, entertainment, AV and planning professionals.

The advanced suite is documented in [docs/ADVANCED_SCOPE.md](docs/ADVANCED_SCOPE.md). It includes capacity-safe seating, live run sheets, QR check-in, expiring event/vendor collaboration, account-signed agreements, actual installment capture, lead CRM, recurring blackout calendars, moderated celebration websites, inspiration, recommendations, automations, and financial/activity analytics. The demo planner account is `planner@utsab.local` with the same local seed password.
