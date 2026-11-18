# GershonCRM

A standalone Streak-style CRM pilot for Gershon Consulting. Target: **https://crm.gershon.ai**, on the existing Hostinger VPS. Production deployment and the GC pipeline migration are not complete.

## Claude Cowork: start here

Read [COWORK_HANDOFF.md](docs/COWORK_HANDOFF.md) for Olivier's decisions, the exact Streak pipeline, implemented changes, test limits, remaining work and deployment order. [STATUS.md](docs/STATUS.md) is the current readiness snapshot. These supersede older briefs and checkpoint snapshots for this CRM task.

- Password login first; only **olivier@gershonconsulting.com** is admitted during the pilot.
- Google sign-in activation and Google Cloud organization registration are deferred.
- The linked GC pipeline must be migrated explicitly. The historical MAbSilico files are a different source; startup does not import them.
- Client access stays disabled until per-pipeline isolation and assignments are implemented.

## Stack

React 18, Vite, TypeScript, Tailwind and shadcn/ui; Node 24, Express, Drizzle and PostgreSQL; scrypt password hashes and PostgreSQL-backed sessions. The prepared VPS deployment uses PM2, nginx, Let's Encrypt and Cloudflare. The OpenAI dependency is unused in this pilot. The deployment workflow remains a template.

## Local development

```bash
npm ci
cp .env.example .env
# Set NODE_ENV=development and APP_URL=http://localhost:5000 in .env.
# Set DATABASE_URL and a random SESSION_SECRET of at least 32 characters.
# Keep PILOT_ADMIN_EMAIL=olivier@gershonconsulting.com; Google values are optional.
npm run db:push          # fresh empty development database only
npm run admin:create    # interactive hidden password prompts; no default password
npm run dev
```

Back up and review migrations before applying schema changes to an existing database. Secrets must never be committed. The application binds to 127.0.0.1 and defaults to port 5000.

## Checks

```bash
npm run check
npm test
npm run build
node --test apps/dash/test/dash.test.mjs
```

The six pilot tests do not replace successful login, authenticated CRUD, import reconciliation, backup restoration or restart checks on real PostgreSQL. See the handoff for their precise coverage.

## Deployment

Start with [the Cowork handoff](docs/COWORK_HANDOFF.md), then use [DEPLOY.md](docs/DEPLOY.md) and the current [private-pilot application instructions](docs/deploy/04-deploy-app.md). Do not activate auto-deploy until the VPS, backups, hostname and service paths have been verified. No production credentials are included.

## Layout

client/ — frontend; server/ — API and authentication; shared/ — schemas and types; scripts/ — interactive admin setup; migrations/ — reviewed additive changes; docs/ — handoff and runbooks; apps/dash/ — separate weekly-board application.

## License

Proprietary — © Gershon Consulting LLC. Historical package metadata should be reconciled before distribution.
