# Operations

## Deployment

Run the frontend and API as separate long-lived Node processes. Supply PostgreSQL 17 and Redis 7. Set `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` (random, at least 32 characters), `WEBHOOK_SECRET` (a separate random secret), `APP_URL`, and explicit comma-separated `CORS_ORIGINS` in the API environment. Set `API_URL` and `NEXT_PUBLIC_SOCKET_URL` before the frontend build. Socket.IO needs an HTTPS endpoint with WebSocket upgrades allowed by the reverse proxy. Never expose PostgreSQL/Redis publicly.

```sh
npm --prefix backend ci
npm --prefix frontend ci
npm --prefix backend run db:generate
npm --prefix backend run db:migrate
npm --prefix backend run build
npm --prefix frontend run build
# Run these as two supervised processes:
npm --prefix backend start
npm --prefix frontend start
```

The seed is for development only. Provision a production administrator through a controlled database operation; public registration accepts HOST and VENDOR only. Rotate the example secrets and keep `.env` files outside source control. `PAYMENT_MODE=sandbox` enables simulated captures. Every other mode refuses checkout until real gateway adapters are added.

The migrations require permission to enable `btree_gist`. The initial migration creates all tables; the integrity migration adds booking exclusion and money/party-size/rating checks. For an existing development database previously created with `prisma db push`, back up first, ensure the schema matches, mark only `202611050001_initial` as applied, then run `db:migrate`. Do not baseline an unrelated database.

## Data integrity

Money is integer paisa. The platform share is `floor(captured * commissionBps / 10000)`; the vendor receives the exact remainder. A 30% advance confirms a held booking. Additional captures cannot exceed the snapshot price; duplicate advance captures are rejected even with different request keys. The ledger has a unique payment reference.

Reservations use UTC storage and Asia/Dhaka presentation. Each service is a separate bookable resource; model parallel venue halls as separate services. Reservation periods include the setup buffer. Transaction advisory locks serialize each service, ordered across carts to avoid deadlocks. PostgreSQL also rejects overlapping active periods. Expired holds are marked before a new hold is created, so a delayed worker cannot keep an old slot blocked through the API. Multi-service holds commit together. Payments remain separate per vendor and booking.

The worker expires holds/quotes every minute and upserts daily in-app reminders for balances due within seven days, RSVP deadlines within seven days, and tasks due within 24 hours. Run only one logical Redis namespace per environment. In-app jobs do not send SMS or settle payouts. Do not mark a payout paid before settling it externally.

## Verification and recovery

- `GET /api/health` checks database connectivity and reports sandbox/unconfigured payment mode.
- Monitor API errors, worker errors, PostgreSQL storage, Redis availability, and your process supervisor. HTTP errors conceal database internals from users.
- Back up PostgreSQL regularly and test restoration. Redis holds job schedules; business state remains in PostgreSQL.
- Run integration and browser tests against disposable databases. Tests intentionally create accounts' planning records and simulated transactions.
- Check `npm audit` in both applications after dependency updates. Backend overrides pin patched multer/deepmerge versions; rerun builds and schema commands when changing them.
- Auth/public RSVP rate limits are process-local. A multi-instance public deployment needs a shared limiter; the application deliberately does not trust arbitrary forwarded IP headers.

## Current limits

Live payment/refund adapters, external SMS/email delivery, automatic bank payouts, signed media uploads, and cancellation-specific automatic replacement orchestration remain unfinished. Venue/professional recommendations are available as an explained ranking against city, allocation, guest capacity, and the next event date. Event collaborators, business teammates, editable marketplace categories, signed-in account acknowledgements, installment plans, and the advanced operations tools are implemented; see [ADVANCED_SCOPE.md](ADVANCED_SCOPE.md) for their exact behavior and boundaries.

## Repository and verification

Only `frontend/`, `backend/`, and Git's internal `.git/` exist at the repository root. Dependencies, lockfiles, environment files, test output, documentation, and infrastructure stay inside those applications. Install both applications separately. From `backend/`, run `npm run verify`; it checks the root structure, generates Prisma, builds both applications, runs backend tests, and audits both trees. Set `TEST_DATABASE_URL` to a disposable migrated database to enable database tests. With already-running servers, add `-- --browser` to include the browser suite. On Windows, stop the API before regenerating Prisma to avoid locking its native engine DLL.

The workflow under `backend/ci/workflows/ci.yml` is a template with corrected independent-package paths. It is not discovered by GitHub Actions in this location. The strict two-folder structure intentionally has no root `.github/` directory, so automatic GitHub Actions are unavailable until that structure requirement changes or an external runner invokes the verification commands.
