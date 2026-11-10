# GershonCRM — Status

**Last updated:** 2026-11-10 (Ariel)

## ✅ LIVE at https://crm.gershon.ai

Deployed 2026-11-10 on the existing Hostinger VPS (srv1511567, 187.124.235.148) — the original Phase 0–9 runbook (docs/DEPLOY.md) was superseded by a simpler route on Olivier's decision:

- Docker Compose at `/opt/gershoncrm` (app container + postgres:16, volume `dbdata`), app on 127.0.0.1:5001
- Caddy (already on the VPS) terminates TLS for `crm.gershon.ai` (auto Let's Encrypt) — no nginx/certbot
- DNS: A record `crm` → VPS IP in Cloudflare zone `gershon.ai`, DNS-only (grey)
- `server/db.ts` switched from Neon serverless driver to node-postgres (commit 9d7a0eb)
- Seeded: 10 stages, 2,095 contacts, 1,048 deals (Streak export CSVs); admin user `olivier` created
- ⚠️ App has NO built-in login yet — protected by Caddy basic_auth (user `olivier`) until real auth ships (see Issues)
- Nightly backup: cron 03:15 pg_dump → /var/backups/gershoncrm (14-day retention)

## ❌ Open

- Implement real authentication (login UI + sessions + Google SSO) — Issue #2
- loadInitialData() re-seeds on every restart; PORT hardcoded to 5000 — Issue #3
- Multi-tenancy refactor before external clients
- CI/CD push-to-deploy (GitHub Actions → VPS) not yet wired; deploys are `git pull && docker compose build app && docker compose up -d app` in /opt/gershoncrm

## Deploy route

SSH to VPS → `cd /opt/gershoncrm/src && git pull && cd .. && docker compose build app && docker compose up -d app`.
Caddy config: `/etc/caddy/Caddyfile` (crm.gershon.ai block). Secrets: `/opt/gershoncrm/.env` + 1Password.

Historical docs: `docs/DEPLOY.md`, `docs/ARIEL_MISSION.md`, `docs/CHARLES_MISSION.md`, `docs/CHARLES_DNS_FIX.md` (gershoncrm.com/Tierra path — no longer the plan), `docs/AGENTS.md`.
