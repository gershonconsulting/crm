# Phase 4 — private pilot on the existing VPS

Use https://crm.gershon.ai and repository https://github.com/gershonconsulting/crm.
Inspect existing VPS services first. Do not overwrite another application's database, nginx configuration, process, or ports.

1. Clone the repository into /var/www/crm using a credential helper if private; never embed tokens in URLs.
2. Install the Node version specified in .nvmrc and run npm ci.
3. Copy .env.example to .env. Fill DATABASE_URL, a random SESSION_SECRET, APP_URL=https://crm.gershon.ai, and PILOT_ADMIN_EMAIL=olivier@gershonconsulting.com. Set file permissions to 600. Google credentials are optional. Never print .env.
4. Back up an existing database before schema work. For a fresh empty database use npm run db:push; for an existing schema review and apply migrations/0001_google_identity.sql. No destructive import is part of startup.
5. Run npm run admin:create interactively. Olivier chooses the hidden password and stores it in 1Password. There is no public registration or default password.
6. Run npm run check, npm test and npm run build. Fix failures before starting or restarting production.
7. From /var/www/crm, start dist/index.js under PM2 as gershoncrm; save the process list and configure startup persistence. The app reads .env and binds to 127.0.0.1 on PORT (default 5000).
8. Verify curl -fsS http://127.0.0.1:5000/health returns status ok. An anonymous /api/contacts request must return 401. Verify the login page loads through nginx.

Streak migration is a separate, reviewed, non-destructive operation against the exact pipeline in ../STATUS.md. Do not load the historical MAbSilico export as GC data.
