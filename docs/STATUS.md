# CRM pilot — current direction

As of 2026-11-09. Claude Cowork is the next operator; start with [COWORK_HANDOFF.md](COWORK_HANDOFF.md). This document supersedes older deployment and product-scope claims.

## Agreed scope

- Canonical address: https://crm.gershon.ai. Olivier confirms control of gershon.ai in Cloudflare.
- Keep the existing Hostinger VPS; no move of gershoncrm.com nameservers is needed for this CRM.
- Initial administrator and only tester: olivier@gershonconsulting.com.
- Email/password sign-in first. Google sign-in is optional later; Google Cloud organization registration is deferred.
- Migrate this exact Streak pipeline, preserving Streak while testing:
  https://www.streak.com/a/pipelines/agxzfm1haWxmb29nYWVyNwsSDE9yZ2FuaXphdGlvbiIQb2F0dGlhQGdtYWlsLmNvbQwLEghXb3JrZmxvdxiAgICAwLWbCgw
- Administrators must eventually see all client pipelines. Future users get only explicitly assigned pipelines. Do not admit other users until query-level pipeline isolation is implemented and tested.
- No Gmail message access is required for sign-in.

## Prepared application changes, awaiting deployment

- Password sign-in, persistent PostgreSQL sessions, API authorization, same-origin mutation protection, owner allowlist, safe user responses, and sign-out.
- Optional Google authorization-code sign-in with state, PKCE, nonce and verified identity. No Google credentials created.
- Standard PostgreSQL driver and explicit environment loading for the VPS.
- Automatic destructive data reloads disabled; legacy replacement loader refuses to run.
- Administrative account-creation command: npm run admin:create (hidden password prompts).
- Repairs to stage editing, contact forms, zero-value deals, and basic task navigation.

## Remaining before live use

1. Connect securely to the existing VPS and inspect its running apps, capacity and database before changes. No production configuration has been changed.
2. Obtain a current export or authenticated read access for the exact GC Streak pipeline. The connected browser shows the Streak extension-install page; the Gmail add-on does not expose the full pipeline. The old MAbSilico export in attached_assets is a different dataset and must not be used as a substitute.
3. Preserve and verify stages, field definitions, contact associations, notes, tasks, source keys and row counts. CSV may omit comments, attachments or activity history; report exclusions before cutover.
4. Back up the production DB; apply the additive google_subject migration or create the fresh schema; create the pilot administrator interactively.
5. Point only crm.gershon.ai to the inspected VPS, issue TLS, use Cloudflare Full (strict), and verify login and persistence through a restart.
6. Verify the copied GC pipeline against Streak before using the CRM as the working system. Keep Streak and a rollback copy until Olivier accepts it.
7. Finish multi-pipeline data isolation and the user-to-pipeline access matrix before inviting clients.

The code remains a single-pipeline pilot. This is not yet a full Streak replacement or a completed migration. Existing repository data exposure and outstanding token-revocation checks remain to be resolved; do not publish fresh client exports or credentials.

## Local validation for this handoff

Type check, production build and all six pilot tests pass. Authenticated login/CRUD, live PostgreSQL sessions, import reconciliation and production restart persistence remain unverified. No production or Streak data was changed. The old checkpoint index is a historical portfolio snapshot, not the current CRM release checklist.
