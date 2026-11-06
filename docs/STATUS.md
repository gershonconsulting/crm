# GershonCRM — Deployment Status Snapshot

**As of:** 2026-11-06 (verified by Ariel/Cowork)
**This repo:** full mirror of `gershonconsulting/gershonCRM` (all branches + history), created 2026-11-06, plus the Cowork session knowledge docs in `docs/`.

## Where the deployment stands

Mission 1 (runbook committed to GitHub) is done — see `docs/DEPLOY.md`, `docs/ARIEL_MISSION.md`, `docs/CHARLES_MISSION.md`, `docs/HANDOFF.md`, `docs/deploy/01–09`.

Mission 2 (execute deploy phases 0–9) has **not started**. Verified today:

- `gershoncrm.com` nameservers are still `ns1/ns2.tierra.net` — the zone is NOT on Cloudflare. This fails the Phase 0 pre-flight gate. Fix brief: `docs/CHARLES_DNS_FIX.md` (not yet executed).
- `crm.gershoncrm.com` still CNAMEs to `gershoncrm-crm.pages.dev` and serves nothing.
- No `.github/workflows/deploy.yml` — CI template still parked at `docs/deploy/deploy.yml.template` (activated in Phase 8).
- No `docs/deploy/EXECUTION_LOG.md`, no GitHub Issues filed (Phase 9 items).

## Blockers before GO

1. Charles executes `docs/CHARLES_DNS_FIX.md` — move the zone to Cloudflare (all 14 records, grey clouds), swap NS at Tierra.net.
2. Olivier provisions the Hostinger KVM VPS and fills the 1Password vault "GershonCRM Deploy" (VPS IP + root password, Cloudflare access, GitHub PAT repo+workflow, OPENAI_API_KEY).
3. Olivier says GO → Ariel runs phases 0–9 per `docs/DEPLOY.md`, pausing at Charles's three tasks (phases 5, 7, 8).

## Known post-launch issues (pre-catalogued, filed as Issues in Phase 9)

loadInitialData() re-seeds on every restart; port hardcoded to 5000; no /api/health; single-tenant; in-memory session store.
