# Production deploy (EC2 + Docker Compose)

Every push to `main` (or a manual *Run workflow*) runs `.github/workflows/deploy.yml`:

1. Builds `ghcr.io/amitavrchy/utsab-backend` and `ghcr.io/amitavrchy/utsab-frontend` (tags `latest` + commit SHA) in GitHub Actions.
2. Copies `deploy/docker-compose.prod.yml` to `/opt/apps/utsab/docker-compose.yml` on the server.
3. Logs the server into GHCR, `docker compose pull && docker compose up -d`, runs `prisma migrate deploy` in a backend container, prunes old images.

| Service  | Image                                   | Host port (127.0.0.1) | Public URL                                 |
|----------|-----------------------------------------|-----------------------|--------------------------------------------|
| frontend | ghcr.io/amitavrchy/utsab-frontend       | 3003                  | https://utsab.13.203.3.1.sslip.io          |
| backend  | ghcr.io/amitavrchy/utsab-backend        | 4003                  | https://api.utsab.13.203.3.1.sslip.io/api  |

## One-time server setup

- External Docker network `apps-net` with the `shared-postgres` (Postgres 16) container on it; database + user `utsab`.
- `/opt/apps/utsab/.env` created from `deploy/.env.example` (`chmod 600`).
- Host Nginx: proxy the frontend host to `127.0.0.1:3003` and the API host to `127.0.0.1:4003`.
  The API host must allow WebSocket upgrades (Socket.IO at `/socket.io/`): `proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`.
  Forward `X-Forwarded-For` / `X-Forwarded-Proto`.

The browser calls the API through the frontend's own `/api/*` rewrite (proxied server-side to `http://utsab-backend:4003` on `apps-net`); only Socket.IO goes directly to the API host.

## Manual operations

```bash
cd /opt/apps/utsab
docker compose run --rm -T backend prisma migrate deploy   # migrations
docker compose logs -f backend
```

The demo seed (`npm run db:seed`) refuses to run with `NODE_ENV=production` and needs dev dependencies; it is not part of production deploys.
