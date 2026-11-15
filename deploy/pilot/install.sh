#!/usr/bin/env bash
# Installs or updates the private CRM pilot on the VPS, beside the older stack.
# Safe to re-run. Generates secrets locally and never prints them.
# Usage: bash install.sh [branch]
set -euo pipefail
BRANCH="${1:-codex/crm-cowork-handoff-2026-11-09}"
ROOT=/opt/gershoncrm-pilot
REPO=https://github.com/gershonconsulting/crm.git
log(){ echo "[pilot] $*"; }
mkdir -p "$ROOT"; cd "$ROOT"
if [ -d src/.git ]; then
  git -C src fetch --depth 1 origin "$BRANCH" -q && git -C src reset --hard -q FETCH_HEAD
else
  git clone -q --depth 1 --branch "$BRANCH" "$REPO" src
fi
log "code: $(git -C src log -1 --format='%h %s' | cut -c1-80)"
if [ ! -f .env ]; then
  umask 077
  DBP=$(openssl rand -hex 24)
  {
    echo "NODE_ENV=production"
    echo "APP_URL=https://crm.gershon.ai"
    echo "PORT=5002"
    echo "PILOT_ADMIN_EMAIL=olivier@gershonconsulting.com"
    echo "DB_PASSWORD=$DBP"
    echo "DATABASE_URL=postgresql://gershoncrm_app:$DBP@127.0.0.1:5433/gershoncrm"
    echo "SESSION_SECRET=$(openssl rand -hex 32)"
    echo "GOOGLE_CLIENT_ID="
    echo "GOOGLE_CLIENT_SECRET="
  } > .env
  log "created .env with fresh random secrets (not shown)"
fi
chmod 600 .env
cp src/deploy/pilot/docker-compose.yml docker-compose.yml
log "building image (a few minutes)…"
docker compose build -q app
docker compose up -d db
for i in $(seq 1 60); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' gershoncrm-pilot-db-1 2>/dev/null)" = healthy ] && break; sleep 2
done
log "database: $(docker inspect -f '{{.State.Health.Status}}' gershoncrm-pilot-db-1)"
log "applying schema…"
docker compose run --rm --no-deps app npx drizzle-kit push --force 2>&1 | grep -vE 'postgresql://' | tail -5
docker compose up -d app
for i in $(seq 1 60); do curl -fsS http://127.0.0.1:5002/health >/dev/null 2>&1 && break; sleep 2; done
log "health: $(curl -sS http://127.0.0.1:5002/health || echo DOWN)"
log "anonymous API (expect 401): $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5002/api/contacts)"
log "set-password page (expect 200): $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5002/set-password)"
log "done"
