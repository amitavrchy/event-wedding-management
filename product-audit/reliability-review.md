# Event & Wedding Management — Reliability & Operations Review

Sources: `backend/Dockerfile`, `frontend/Dockerfile`, `deploy/docker-compose.prod.yml`, `deploy/README.md`, `deploy/.env.example`, `.github/workflows/deploy.yml`, `backend/docs/OPERATIONS.md`. The EC2 host itself was not inspected, so anything configured only on the server (Nginx, TLS, cron, backups) is NOT VERIFIED.

## 1. Current state

| Area | Finding | Evidence |
|---|---|---|
| Images | Multi-stage builds, non-root `node` user, production dependencies only, `HEALTHCHECK` on the API | `backend/Dockerfile` |
| Compose | `restart: unless-stopped`, memory limits (448 MB API, 384 MB web), log rotation 3×10 MB, ports bound to loopback | `deploy/docker-compose.prod.yml` |
| Reverse proxy / TLS | Host Nginx, configured manually; not in the repository | `deploy/README.md` |
| Domain | `utsab.13.203.3.1.sslip.io` — an IP-derived hostname, not an owned domain | `deploy/.env.example` |
| CI/CD | Push to `main` builds and deploys immediately. No tests, no approval, no staging | `.github/workflows/deploy.yml` |
| Migrations | Applied **after** `docker compose up -d` | `deploy.yml` remote script |
| Rollback | None scripted. Images are tagged by commit SHA, so a manual `IMAGE_TAG=<sha> docker compose up -d` is possible; database rollback is not | — |
| Health | `/api/health` checks Postgres; the frontend container has no health check | compose file |
| Background jobs | Disabled unless `REDIS_URL` is set; shipped empty | `deploy/.env.example` |
| Backups | **None found** in the repository or deploy docs | — |
| Monitoring / alerting | **None found**. Logs are container stdout only | — |
| Error tracking | None | — |
| Secrets | One `.env` on the host shared by both containers (the frontend container also receives `DATABASE_URL` and `JWT_SECRET`) | `docker-compose.prod.yml` `env_file` |
| Shared infrastructure | Same host and Postgres container as the pharmacy and ERP products | `deploy/README.md` |

## 2. Risks

| ID | Class | Risk | Impact |
|---|---|---|---|
| E-R1 | CONFIRMED ARCHITECTURAL WEAKNESS | No database backup | Any disk failure, bad migration or operator mistake is permanent data loss |
| E-R2 | CONFIRMED BUG | Deploy on every push with no tests; CI file inactive | The malware commit of 2026-11-13 would have been built and deployed automatically |
| E-R3 | CONFIRMED BUG | Migrate-after-start ordering | Requests fail between container start and migration end |
| E-R4 | CONFIRMED ARCHITECTURAL WEAKNESS | Single host for three products, three apps' memory limits plus Postgres on one instance | One noisy app or OOM affects all customers of all products |
| E-R5 | CONFIRMED ARCHITECTURAL WEAKNESS | No monitoring or alerting | Outages are discovered by customers |
| E-R6 | POTENTIAL RISK | `sslip.io` hostname | Cannot send email from it, cannot move IP without breaking every RSVP and celebration-site link |
| E-R7 | CONFIRMED SECURITY ISSUE | Frontend container receives backend secrets through the shared `env_file` | Larger blast radius if the web container is compromised |
| E-R8 | POTENTIAL RISK | Socket.IO served directly from the API host; Nginx upgrade headers must be configured by hand | Realtime silently degrades to polling or fails |

## 3. Recommended targets for launch

| Objective | Target | Rationale |
|---|---|---|
| Availability | 99.5 % monthly (≈ 3.6 h downtime) | Realistic for a single-instance deployment with managed Postgres |
| RPO | ≤ 24 h at launch, ≤ 15 min once paid bookings are live | Daily dumps first, then point-in-time recovery |
| RTO | ≤ 4 h | Rebuild from images + restore |

## 4. Required operational work

1. **Backups:** nightly `pg_dump` per database to off-host object storage with 14–30 day retention, encrypted at rest; monthly restore drill. Move to managed Postgres with point-in-time recovery before taking real payments.
2. **Pipeline:** activate CI; make deploy depend on it; protect `main`; add a manual approval for production; tag releases.
3. **Deploy order:** pull → backup → `prisma migrate deploy` → `up -d` → health verification → automatic rollback of the image tag on failure. Keep migrations backward compatible for one release.
4. **Monitoring:** uptime probe on `/api/health` and the home page; error tracking (Sentry or equivalent) in API and web; host metrics with alerts on disk > 80 %, memory, container restarts; log shipping or at least retention beyond 30 MB.
5. **Worker:** provision Redis and run maintenance in its own container.
6. **Secrets:** separate env files for web and API; rotate everything after the incident.
7. **Domain:** register a real domain; HTTPS with automatic renewal; HSTS.
8. **Runbooks:** deploy, rollback, restore from backup, rotate secrets, suspend a vendor, handle a payment dispute, incident communication.

## 5. Incident response (minimum)

- One on-call owner with phone alerts from the uptime probe.
- Severity definitions: S1 data loss/security or full outage, S2 payment or booking failure, S3 degraded feature.
- For S1: stop deploys, snapshot the database, communicate on a status page, write a post-incident note.
- The 2026-11-13 repository compromise should be handled as an S1 and closed with a written record of what was rotated and verified.

## 6. Verification

- Restore last night's dump into a scratch database and run the integration tests against it.
- Deploy a deliberately failing health check to staging and confirm the pipeline rolls back.
- Kill the API container and confirm the alert fires and Docker restarts it.
