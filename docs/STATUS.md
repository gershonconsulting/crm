# GershonCRM — Status

**Last updated:** 2026-11-16 (Claude) — Streak copy v2 (branch feat/streak-copy)

## ✅ LIVE at https://crm.gershon.ai

Deployed 2026-11-10, Streak copy v2 deployed 2026-11-17 on the existing Hostinger VPS (srv1511567, 187.124.235.148) — the original Phase 0–9 runbook (docs/DEPLOY.md) was superseded by a simpler route on Olivier's decision:

- Docker Compose at `/opt/gershoncrm` (app container + postgres:16, volume `dbdata`), app on 127.0.0.1:5001
- Caddy (already on the VPS) terminates TLS for `crm.gershon.ai` (auto Let's Encrypt) — no nginx/certbot
- DNS: A record `crm` → VPS IP in Cloudflare zone `gershon.ai`, DNS-only (grey)
- `server/db.ts` switched from Neon serverless driver to node-postgres (commit 9d7a0eb)
- Seeded: 10 stages, 2,095 contacts, 1,048 deals (Streak export CSVs); admin user `olivier` created
- ⚠️ App has NO built-in login yet — protected by Caddy basic_auth (user `olivier`) until real auth ships (see Issues)
- Nightly backup: cron 03:15 pg_dump → /var/backups/gershoncrm (14-day retention)

## 2026-11-16 — Streak copy v2
- ✅ Pipelines + per-pipeline fields (TEXT/DROPDOWN/TAG/CHECKBOX/DATE/NUMBER) like Streak; values in deals.custom_fields
- ✅ Box view: Notes (autosave), comments that save (edit/delete), timeline, stage, assignees, every field editable, add/rename/delete field, **Edit options** on any dropdown/tag
- ✅ Grid: Streak stage funnel, grouped by stage, all fields as columns, inline edit, sort, search, New box
- ✅ Boot no longer wipes & re-seeds the DB (data-loader seeds only an empty DB); PORT env honoured
- ✅ Additive startup migration (server/migrate.ts) — no drops
- ✅ POST /api/import/streak — idempotent Streak import (pipeline def + boxes + comments)
- ✅ LIVE 2026-11-17 (PR #2 deployed; DB backup /var/backups/gershoncrm/pre-streak-v2-*.sql.gz)
- ✅ GC Pipeline imported live: 192 boxes, 9 stages, 24 fields, 107 comments (snapshot of Streak on 2026-11-16; not a live sync)
- ❌ Ongoing Streak→CRM sync (only a one-time import so far)
- ❌ Box timeline has no Streak emails (Streak API doesn't expose email bodies to the import)
- ⚠️ Repo is PUBLIC and attached_assets/ holds a Streak contacts export — make repo private

## ❌ Open

- Implement real authentication (login UI + sessions + Google SSO) — Issue #2
- Multi-tenancy refactor before external clients
- CI/CD push-to-deploy (GitHub Actions → VPS) not yet wired; deploys are `git pull && docker compose build app && docker compose up -d app` in /opt/gershoncrm

## Deploy route

SSH to VPS → `cd /opt/gershoncrm/src && git pull && cd .. && docker compose build app && docker compose up -d app`.
Caddy config: `/etc/caddy/Caddyfile` (crm.gershon.ai block). Secrets: `/opt/gershoncrm/.env` + 1Password.

Historical docs: `docs/DEPLOY.md`, `docs/ARIEL_MISSION.md`, `docs/CHARLES_MISSION.md`, `docs/CHARLES_DNS_FIX.md` (gershoncrm.com/Tierra path — no longer the plan), `docs/AGENTS.md`.
