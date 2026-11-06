# Who's who (Olivier's agent roster)

| Name | Identity | Role |
|---|---|---|
| **Olivier** | Founder, non-technical CEO | Purchases (VPS), owns 1Password, approves phase transitions |
| **Claude (CTO)** | claude.ai chat | Wrote the runbook, architecture decisions, escalation point |
| **Ariel** | Claude Cowork (desktop app) | Deploy operator — all terminal/SSH/repo work, per `docs/ARIEL_MISSION.md` |
| **Charles** | Claude in Chrome (browser extension) | Browser-GUI operator — Cloudflare dashboard, GitHub Secrets UI, per `docs/CHARLES_MISSION.md` |

Working conventions learned in practice:

- Secrets travel through 1Password only — never chat, commits, or logs. When Ariel needs a secret, Olivier places it in a temp file in the connected project folder and deletes it after use.
- Cowork sessions push to gershonconsulting repos either via the GitHub connector or via a self-logging `.bat` (no `pause`) dropped in the connected project folder and double-clicked; a Git Credential Manager account picker may appear — pick the saved **gershonconsulting** entry.
- Scope guard: GershonCRM is a standalone platform. No Gmail/Google Workspace integration — explicit product decision.
