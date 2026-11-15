#!/usr/bin/env bash
# Emails the pilot administrator a one-time "choose your password" link.
# Reuses the Resend key already configured for Harvey on this server, for this run only.
set -euo pipefail
cd /opt/gershoncrm-pilot
RESEND_API_KEY=$(grep -E '^RESEND_API_KEY=' /opt/harvey/.env | head -1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^"//;s/"$//' -e "s/^'//;s/'$//")
export RESEND_API_KEY
docker compose run --rm --no-deps -e RESEND_API_KEY app node dist/scripts/send-setup-link.js
