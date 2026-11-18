#!/usr/bin/env bash
# Imports a Streak snapshot directory (pipeline.json + part-*.jsonl) into the pilot DB.
# Usage: bash import.sh /path/to/snapshot-dir [--apply]   (dry run unless --apply)
set -euo pipefail
DIR="$(cd "$1" && pwd)"; shift
cd /opt/gershoncrm-pilot
if [ "${1:-}" = "--apply" ]; then
  ts=$(date -u +%Y%m%dT%H%M%SZ)
  mkdir -p backups && chmod 700 backups
  docker compose exec -T db pg_dump -U gershoncrm_app -d gershoncrm | gzip > "backups/pre-import-$ts.sql.gz"
  echo "[pilot] backup: backups/pre-import-$ts.sql.gz ($(du -h "backups/pre-import-$ts.sql.gz" | cut -f1))"
fi
docker compose run --rm --no-deps -v "$DIR:/snapshot:ro" app node dist/scripts/import-streak.js /snapshot "$@"
