# Claude Cowork handoff — CRM pilot

Updated 2026-11-09. Olivier asked Codex to publish all prepared work here so Claude Cowork can complete implementation, migration and deployment. This file and STATUS.md supersede historical agent briefs and checkpoint snapshots for this CRM task.

## Outcome Olivier wants

Build a usable Streak-style CRM for the current GC pipeline at **https://crm.gershon.ai**, on the **existing Hostinger VPS**. Olivier confirms control of **gershon.ai in Cloudflare**. Preserve the original Streak pipeline during testing.

Start with **email/password login**. The only initial tester and administrator is **olivier@gershonconsulting.com**. Google sign-in activation and Google Cloud organization registration are deferred; they must not block the password pilot. The Google organization should ultimately belong to Gershon Consulting, but no organization, credentials, or ownership migration was completed in this work.

Use this exact source pipeline:

https://www.streak.com/a/pipelines/agxzfm1haWxmb29nYWVyNwsSDE9yZ2FuaXphdGlvbiIQb2F0dGlhQGdtYWlsLmNvbQwLEghXb3JrZmxvdxiAgICAwLWbCgw

Later, Olivier will provide the user list and user-to-pipeline assignments. His administrator account must see all client pipelines; each other user must see only assigned pipelines. The current code is a single-pipeline, owner-only pilot. **Do not enable client access until pipeline isolation is implemented in the database queries and verified with access-control tests.** Do not infer an existing user list from old sample accounts.

## What the repository now contains

- Email/password authentication, scrypt hashes, PostgreSQL-backed sessions, sign-out, and a server-enforced pilot-owner allowlist. Anonymous CRM API requests return 401. Cross-origin mutations are rejected. Authentication material is omitted from user-list responses.
- A login screen and roles loaded from the authenticated server session. The old browser-side user impersonation selector has been disabled.
- Optional Google authorization-code sign-in code, with state, PKCE, nonce and verified identity checks. No Google credentials have been created or tested end to end; leave the Google environment values empty for now.
- Standard PostgreSQL connectivity through pg and Drizzle's node-postgres adapter. Environment variables load from .env. Node binds to loopback and reads PORT. The public /health endpoint checks the database without exposing details.
- Removal of startup sample-data writes and destructive CSV reloads. server/data-loader.ts now refuses the legacy replacement operation.
- Pilot repairs: contact forms, zero-value deals, stage create/edit/reorder calls, notes, deal deletion, completion checkboxes, search, task navigation and JSON date handling. The pipeline's hardcoded performance figures were replaced with actual record counts and values.
- An additive google_subject SQL migration, an interactive administrator-creation command, and updated hostname/deployment instructions. The workflow remains a template, not an active auto-deploy workflow.

These are prepared application changes, not evidence of a completed Streak replica or production release. Custom fields, multiple contacts per deal, attachments, activity-history parity, saved views and multi-pipeline support still need comparison with the actual source pipeline. Do not assume that a visible control is implemented without testing it.

## Validation and its limits

Before publication, run and record:

```bash
npm ci
npm run check
npm test
npm run build
node --test apps/dash/test/dash.test.mjs
```

The pilot has six tests covering owner email matching, same-origin mutations, safe user responses, password verification, task-date transport and the unauthenticated HTTP gate. The HTTP test intentionally uses an unavailable test database; it establishes that private endpoints are blocked without authentication. **It does not verify successful login, live PostgreSQL sessions, authenticated CRUD, migration, or production restart persistence.** Complete those checks against a separate test database and then the actual VPS before calling the pilot ready.

Build warnings include a large frontend bundle and old Browserslist data. Neither establishes runtime correctness. Do not use the build result as a migration acceptance test.

## Next work, in order

1. **Inspect access and infrastructure.** Connect securely to the existing Hostinger VPS; identify its operating system, running apps, ports, available capacity, database, nginx configuration and PM2 processes. Preserve other applications. The Codex browser could not load Hostinger reliably, and no VPS address or credentials were confirmed. No production DNS, server or database changes were applied.
2. **Obtain the actual Streak source.** Open the exact pipeline in a browser with Streak installed and authenticated as a user with pipeline access, or use a current export/authenticated read API. Codex reached Streak's extension-install page; the Gmail add-on did not expose the full pipeline. Do not substitute the old MAbSilico files under attached_assets: they are a different pipeline and an older export.
3. **Inventory and implement the required parity.** Record the pipeline name, stages/order/colors, columns/types/options, records, contact associations, notes, tasks, assignments and dates. Identify comments, email links, attachments and history that CSV does not contain. Report what can and cannot be copied before cutover. Add the features needed for Olivier's real workflow rather than assuming the current fixed schema captures everything.
4. **Build a safe migration.** Create a private source snapshot and backup. Implement an explicit import with a dry run, stable source keys, idempotency and transactions; preserve existing working records. No reviewed migration for the linked GC pipeline exists yet. Do not run load-initial-data.ts or db-update.ts blindly: they are historical utilities, not the current migration procedure.
5. **Prepare and verify the database.** Use Node 24 per .nvmrc. For a fresh empty database, review the schema then use npm run db:push. For an existing database, back it up and review migrations/0001_google_identity.sql; this migration only adds the Google identity column/index and is not a complete fresh schema. connect-pg-simple creates its session table at first use, so verify the application DB user can create it or provision it explicitly.
6. **Configure the pilot privately.** Use .env.example with APP_URL=https://crm.gershon.ai, a real DATABASE_URL, a random SESSION_SECRET of at least 32 characters and PILOT_ADMIN_EMAIL=olivier@gershonconsulting.com. Keep Google credentials blank. Do not print secrets. Create the first account with npm run admin:create in an interactive terminal; the password is entered twice with hidden input. The command refuses to overwrite an existing account; review an existing owner account and its password-recovery path separately. Prevent the sole owner from being accidentally disabled or deleted before relying on the Admin panel.
7. **Deploy only this hostname.** Use /var/www/crm, the gershoncrm PM2 process name and a dedicated nginx virtual host. Inspect any existing crm DNS A/AAAA/CNAME records first. Point crm.gershon.ai at the verified VPS, issue a valid TLS certificate and use Cloudflare Full (strict) for this hostname while preserving other apps' settings. No gershoncrm.com nameserver migration is needed.
8. **Test the real workflow.** Verify password login, rejection of other accounts, protected APIs, creation/editing of contacts and deals, zero-value deals, stage changes, note saving, tasks with dates, search and logout. Confirm saved records and sessions survive an application restart. Compare imported records and source keys with Streak. Verify backup restoration to a separate database.
9. **Complete the handoff to Olivier.** Record the actual deployment and import evidence in docs/deploy/EXECUTION_LOG.md: commit, hostname, source identity, row counts, exceptions, backup verification and test outcomes. Keep Streak available until Olivier accepts the copied pipeline. Only then describe crm.gershon.ai as ready for daily use.

## Important boundaries

- Credentials belong in 1Password or protected runtime configuration, never Git, chat, screenshots, remote URLs or execution logs. No real .env is included in this handoff.
- Existing client exports are already in this public repository. Resolve their exposure and the old CP-SEC-001 token-revocation checkpoint with Olivier; do not add fresh client exports to Git. Do not claim token revocation was verified here.
- Gmail inbox integration is outside the current pilot. Google identity sign-in later does not require reading Gmail messages.
- The nightly/2026-10-28-dash-cron branch contains separate, unmerged Dash work. Do not merge it into the CRM deployment implicitly; inspect its own handoff if Olivier separately requests that work.
- Historical instructions to deploy the scaffold unchanged or treat destructive reloads/authentication as post-launch work no longer describe the accepted task. Fix material defects required by the pilot before deployment.
