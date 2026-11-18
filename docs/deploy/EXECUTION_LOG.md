# Pilot execution log

## 2026-11-15
1. Code: branch codex/crm-cowork-handoff-2026-11-09 (draft PR #1), commit 9efd819 adds deploy/pilot/*, scripts/import-streak.ts, scripts/send-setup-link.ts and the one-time password setup route.
2. Local checks: tsc clean, build OK, six pilot tests pass; full GC import on a fresh Postgres 16 (apply, then a second dry run updates in place, nothing duplicated); set-password link signs in once and is refused on reuse; anonymous API 401.
3. VPS (hPanel web console): `bash install.sh codex/crm-cowork-handoff-2026-11-09` -> health ok, anonymous /api/contacts 401, /set-password 200. Log: /root/crm-pilot-install.log.
4. Snapshot moved browser -> web console (sha256 verified), unpacked to /opt/gershoncrm-pilot/snapshot-20261115 (mode 700). Temporary copies removed.
5. `import.sh <dir>` dry run, then `--apply`: backup backups/pre-import-20261115T145126Z.sql.gz, 190 deals / 308 contacts / 192 tasks / 107 notes / 9 stages. Matches Streak stage counts.
6. Pending: `switch-caddy.sh` (needs Olivier's yes), then `send-setup-link.sh`, then public checks (site 200, anonymous API 401, sign-in, restart persistence).

Rollback: `bash /opt/gershoncrm-pilot/src/deploy/pilot/switch-caddy.sh --rollback` restores the previous Caddyfile (old stack on 5001 keeps running).
