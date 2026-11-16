#!/usr/bin/env bash
# Release order: backup -> pull -> migrate -> up -> health check -> rollback on failure.
# Called by .github/workflows/deploy.yml with IMAGE_TAG set to the commit SHA.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${IMAGE_TAG:?IMAGE_TAG is required}"
[ -f .env ] || { echo "::error::.env is missing. Create it from deploy/.env.example first."; exit 1; }
docker network inspect apps-net >/dev/null 2>&1 || docker network create apps-net
previous="$(cat .deployed_tag 2>/dev/null || echo latest)"

echo "==> Backup before release"
./scripts/backup.sh "pre-${IMAGE_TAG:0:7}"

echo "==> Pull $IMAGE_TAG"
export IMAGE_TAG
docker compose pull

echo "==> Migrate"
docker compose run --rm --no-deps -T backend prisma migrate deploy

echo "==> Start"
docker compose up -d --remove-orphans

healthy() {
  for _ in $(seq 1 30); do
    if curl -fsS http://127.0.0.1:4003/api/health >/dev/null && curl -fsS -o /dev/null http://127.0.0.1:3003/; then return 0; fi
    sleep 4
  done
  return 1
}

if healthy; then
  echo "$IMAGE_TAG" > .deployed_tag
  docker compose ps
  echo "Release $IMAGE_TAG is healthy."
else
  echo "::error::Health check failed for $IMAGE_TAG. Rolling back application containers to $previous."
  docker compose logs --tail=80 backend worker frontend || true
  IMAGE_TAG="$previous" docker compose up -d --remove-orphans
  echo "Database migrations are not reversed automatically. Migrations must stay backward compatible (expand, then contract)."
  exit 1
fi
