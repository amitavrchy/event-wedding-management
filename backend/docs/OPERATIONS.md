# Operations

## Deployment

Run the frontend and API as separate long-lived Node processes. Supply PostgreSQL 17 and Redis 7. Set `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` (random, at least 32 characters), `WEBHOOK_SECRET` (a separate random secret), `APP_URL`, and explicit comma-separated `CORS_ORIGINS` in the API environment. Set `API_URL` and `NEXT_PUBLIC_SOCKET_URL` before the frontend build. Socket.IO needs an HTTPS endpoint with WebSocket upgrades allowed by the reverse proxy. Never expose PostgreSQL/Redis publicly.

```sh
npm ci
npm run db:generate
npm run db:migrate
npm run build
npm start
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
- Check `npm audit` after dependency updates. Root overrides pin patched multer/deepmerge versions; rerun builds and schema commands when changing them.
- Auth/public RSVP rate limits are process-local. A multi-instance public deployment needs a shared limiter; the application deliberately does not trust arbitrary forwarded IP headers.

## Current limits

The original spec is broader than the delivered local product. Live payment/refund adapters, external SMS/email delivery, automatic replacement matching, vendor teams, signed media uploads, and optional scoped planners are unfinished. Admin categories use the fixed marketplace categories rather than a category editor. Accepted quotes can be booked once against a service from the same vendor, using the quoted total. Cancellation reviews support administrator-approved sandbox refunds. These do not transfer real funds.
