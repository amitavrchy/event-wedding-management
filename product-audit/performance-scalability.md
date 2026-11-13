# Event & Wedding Management — Performance & Scalability

**Capacity is NOT VERIFIED.** No load test was executed: Docker, PostgreSQL and k6 are not installed on the audit machine, and running load against the shared production host is out of scope. Everything below is a static assessment plus a workload model to test against. An executable k6 plan is in `../testing/load-testing-plan.md`.

## 1. Usage assumptions (stated, not measured)

Event planning is bursty and seasonal: wedding season in Bangladesh concentrates roughly November–February, and activity peaks in evenings and on weekends. Registered users are mostly hosts; a small share are vendors.

| Stage | Registered | DAU (assumed 8–12 %) | Peak concurrent (assumed 10 % of DAU) | Peak API req/s (assumed 0.5 req/s per active user) |
|---|---:|---:|---:|---:|
| Early launch | 100 | 10 | 2 | ~1 |
| Initial traction | 1,000 | 100 | 10 | ~5 |
| Growth | 5,000 | 500 | 50 | ~25 |
| Target | 10,000 | 1,000 | 100 | ~50 |

Read/write ratio assumed 85/15. The public RSVP and celebration-site pages add unauthenticated traffic that scales with guests, not users: 10,000 users × a share with active events × 200 guests each can produce short spikes when invitations are sent.

| Stage | DB size (assumed) | Notes |
|---|---|---|
| 100 users | < 100 MB | — |
| 1,000 | ~0.5 GB | guests, messages, activity dominate |
| 5,000 | ~2 GB | — |
| 10,000 | ~4–6 GB | no binary data is stored in the database |

Media storage is zero today because nothing can be uploaded; once vendor galleries exist, plan for 50–200 MB per active vendor in object storage.

## 2. Static bottlenecks (ranked)

| # | Bottleneck | Evidence | Expected effect at target scale |
|---|---|---|---|
| 1 | Marketplace list loads 100 vendors with all services, blocks and active bookings and filters in memory, on every context refresh of every signed-in user | `vendors.ts:51-97`, `frontend/src/lib/context.tsx:66-69` | Dominant read load; grows with bookings |
| 2 | Full event detail (all guests, bookings, expenses) on every refresh | `events.ts:82-104` | Large JSON per request for 500+ guest events |
| 3 | Every-minute maintenance: all bookings due within 7 days with a per-booking aggregate and upsert; all pending instalments; all enabled automation rules with a full event load each | `reminders.ts`, `automations.ts`, `jobs.ts:21-37` | Linear in active events, 1,440 times a day |
| 4 | Missing indexes on `Event.hostId`, `Guest.eventId`, `Booking.eventId/vendorId`, `Payment.bookingId`, `Message(conversationId, createdAt)` and others | `database-audit.md` §4 | Sequential scans as tables grow |
| 5 | bcrypt cost 12 on login, registration and anonymous site-password checks runs on the event loop thread pool | `auth.ts`, `websites.ts:137-140` | ~4 concurrent hashes per process before queueing |
| 6 | N+1 in `packages`, `invoices` | `packages.ts:21-36`, `invoices.ts:37-71` | Slow lists for busy vendors |

## 3. Horizontal scaling readiness

| Requirement | Status |
|---|---|
| Stateless API | **No.** Rate-limit counters (`rate-limit.ts`) and the Socket.IO room state are in process memory. A second instance needs a Redis rate-limit store and the Socket.IO Redis adapter with sticky sessions |
| Background work | Runs inside the API process. With two instances both start a worker; the repeatable job is de-duplicated by BullMQ, so correctness holds, but job CPU competes with requests |
| Connection pooling | Prisma default pool (`num_cpus × 2 + 1`) per process, no explicit limit; three products share one Postgres container |
| Graceful shutdown | `enableShutdownHooks()` is set; Socket.IO connections are not drained |
| Health check | `GET /api/health` checks the database only |
| Caching / CDN | None |

## 4. What is actually needed for 10,000 registered users

Per the assumptions above, ~50 req/s at peak is within reach of **one** API instance on a 2 vCPU / 4 GB machine and a small managed Postgres, provided the query problems in §2 are fixed. Kubernetes, microservices, Kafka or read replicas are not justified.

Required changes:

1. Paginate and index the marketplace query; compute availability in SQL for the requested date; cache the first page for 30–60 s.
2. Split the event detail endpoint (summary vs paginated guests).
3. Stop the frontend refetching vendors on every booking event.
4. Move maintenance to a separate worker process, run reminders every 15–60 minutes, and select only rows that need work.
5. Add the indexes in `database-audit.md`.
6. Set an explicit Prisma `connection_limit` and put PgBouncer or a managed pooler in front of Postgres when a second instance is added.
7. Serve static assets and vendor media through a CDN.

## 5. Targets to verify by load test

| Metric | Target at 50 req/s mixed workload |
|---|---|
| p50 latency | < 150 ms |
| p95 latency | < 600 ms |
| p99 latency | < 1,500 ms |
| Error rate | < 0.5 % |
| API CPU | < 70 % |
| DB connections in use | < 70 % of pool |

Workload mix for the test (from the audit brief): event creation 2 %, guest management 20 %, budget updates 10 %, vendor browsing 30 %, vendor search 20 %, booking inquiries/holds 8 %, vendor dashboard 10 %; plus a separate RSVP spike scenario (200 guests answering within 10 minutes for 20 events).

## 6. Infrastructure cost

See `../04-infrastructure-cost-analysis.md` for staged cost estimates covering all three products.
