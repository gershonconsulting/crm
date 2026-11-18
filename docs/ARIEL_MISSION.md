# Claude Cowork — current CRM mission

Updated 2026-11-09. Olivier delegated the remaining CRM work to Claude Cowork and asked Codex to publish the prepared source and handoff to gershonconsulting/crm.

**Start with [COWORK_HANDOFF.md](COWORK_HANDOFF.md), then [STATUS.md](STATUS.md).**

Complete the Streak-style pilot for the exact GC pipeline in the handoff. Use crm.gershon.ai, the existing Hostinger VPS and password login for olivier@gershonconsulting.com. Google sign-in activation and organization registration are deferred. Keep other users disabled until per-pipeline access is implemented.

Inspect the actual source pipeline and VPS, fix required workflow gaps, implement a safe explicit migration, verify the application against real PostgreSQL, and deploy only after checks and backup preparation pass. Record actual outcomes in docs/deploy/EXECUTION_LOG.md. Preserve Streak until Olivier accepts the imported copy.

The previous two-mission brief, prohibition on fixing application code, assumption of an untouched scaffold deployment and gershoncrm.com nameserver prerequisite are superseded. The new handoff identifies what was implemented and what remains unverified.
