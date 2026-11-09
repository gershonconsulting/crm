# Project background and current handoff

Updated 2026-11-09. **Claude Cowork is the next operator. Start with [COWORK_HANDOFF.md](COWORK_HANDOFF.md).**

Olivier is migrating the current GC pipeline from Streak into a standalone web CRM at https://crm.gershon.ai on the existing Hostinger VPS. The first tester is Olivier, using olivier@gershonconsulting.com with an application password. Google sign-in activation and company organization registration are deferred.

Codex prepared and tested the local pilot changes and published them to this repository for Cowork. No production deployment, administrator creation, real Streak data migration, Google setup or DNS change was completed by Codex. Successful authenticated operation on real PostgreSQL remains to be verified.

The pilot is restricted to the owner. Olivier will supply future users and pipeline assignments; full administrator access across pipelines and per-client isolation must be implemented before inviting clients.

The handoff contains the exact Streak source URL, known limitations, validation commands and next steps. STATUS.md records readiness. Historical agent roles and older deploy-as-is instructions do not override this handoff or Olivier's current instructions. Secrets stay in 1Password or protected runtime configuration.
