> Current delegation (2026-11-09): Claude Cowork completes the CRM work from [COWORK_HANDOFF.md](COWORK_HANDOFF.md). Historical role splits below are background; use the current handoff and Olivier's latest instructions.

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
- Scope guard: GershonCRM is a standalone platform. Password login first. Google identity sign-in is authorized as a later option; Gmail inbox integration remains out of scope. Organization registration is deferred at Olivier's request.
