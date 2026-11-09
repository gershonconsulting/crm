# Phase 9 — private-pilot acceptance

1. Verify https://crm.gershon.ai loads the password sign-in page and anonymous API requests return 401.
2. Use npm run admin:create in an interactive VPS terminal to create olivier@gershonconsulting.com if it does not already exist. Password prompts are hidden; save credentials in 1Password. No credentials belong in chat or commits.
3. Sign in as Olivier. Confirm other accounts remain denied even if they have been provisioned in Admin.
4. Check stage creation, stage editing/reordering, contact creation/editing, a zero-value deal, changing a deal's stage, note saving, completion checkboxes, search, and dated tasks. Delete only the explicitly created test records.
5. After the GC source is available, compare imported source keys, stages, custom fields, contact associations and row counts with the exact Streak pipeline in ../STATUS.md. Report any activity-history or attachment exclusions. Do not use the old MAbSilico export as the GC pipeline.
6. Restart PM2. Confirm contacts, deals, tasks and the current session persist. Confirm logout invalidates the session.
7. Install encrypted or access-restricted nightly PostgreSQL backups, verify a backup, and test restoration to a separate database. Keep Streak available until the imported copy is accepted. Offsite backups remain a deployment requirement to settle before relying on this CRM.
8. Enable the deployment workflow only after the existing VPS and its service paths have been verified. Prove a successful deploy and health check.

Record actual evidence in EXECUTION_LOG.md. Do not mark any item complete based only on local tests. Google organization registration and Google sign-in activation remain deferred.
