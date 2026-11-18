> Current pilot: see [STATUS.md](STATUS.md). Use password login, the existing VPS and crm.gershon.ai. Google organization registration is deferred. The private-pilot Phase 4 replaces the historical deploy-as-is assumptions below.

# GershonCRM — Production Deploy Runbook

> **Audience:** the deploy operator — Ariel (Claude Cowork) with Charles (Claude Chrome) for browser-GUI steps. Written so a human freelancer could also follow it.
> **Goal:** Take the code from `main` → live at `https://crm.gershon.ai` with automated deploys on every push.
> **Time:** ~90 min end-to-end if nothing goes sideways.

Claude Cowork starts with [COWORK_HANDOFF.md](COWORK_HANDOFF.md), then the numbered phase references. Historical operator references: Ariel reads [`ARIEL_MISSION.md`](./ARIEL_MISSION.md) first; Charles reads [`CHARLES_MISSION.md`](./CHARLES_MISSION.md) — it defines who does what. [`HANDOFF.md`](./HANDOFF.md) has the project background.

---

## Stack

| Layer           | Tech                                             |
| --------------- | ------------------------------------------------ |
| Frontend        | React 18 + Vite + TypeScript + Tailwind          |
| Backend         | Node.js 24 + Express + Drizzle ORM               |
| Database        | PostgreSQL 16 (local on the VPS)                 |
| Process manager | PM2                                              |
| Reverse proxy   | nginx                                            |
| SSL             | Let's Encrypt via certbot                        |
| CDN / DNS       | Cloudflare                                       |
| Host            | Hostinger KVM VPS (Ubuntu 22.04 or 24.04)        |
| CI/CD           | GitHub Actions → SSH into VPS → `git pull` + PM2 |

## Product scope guard

GershonCRM is a **standalone** Streak.com-style CRM. It is explicitly **not** integrated with Gmail or Google Workspace. No Google OAuth, no inbox sync, no email tracking in this phase. Do not add any of these during deployment.

---

## Prerequisites (1Password shared vault "GershonCRM Deploy")

1. **VPS public IP** (provisioned by Olivier in his Hostinger account — KVM 2, Ubuntu 22.04/24.04, NY datacenter)
2. **VPS root password** (single-use — replaced by SSH key auth in Phase 1)
3. **Cloudflare access** to the `gershon.ai` zone (for Charles/browser steps)
4. **GitHub PAT** with `repo` + `workflow` scope for `gershonconsulting/crm` (90-day expiry)
5. **OPENAI_API_KEY** — used by the AI features in the CRM

Do not proceed past Phase 0 until all five are in the vault.

---

## Phases at a glance

| # | Phase | Time | Operator | Artifact |
|---|-------|------|----------|----------|
| 0 | Pre-flight checks | 5 min | Ariel | Confirmed prereqs |
| 1 | VPS bootstrap & hardening | 15 min | Ariel | Non-root sudo user, firewall, SSH keys |
| 2 | Install runtime | 10 min | Ariel | Node 24, Postgres 16, nginx, PM2, certbot |
| 3 | Database setup | 5 min | Ariel | `gershoncrm` DB + app user |
| 4 | Deploy app | 15 min | Ariel | App running on `127.0.0.1:5000` via PM2 |
| 5 | Cloudflare DNS (proxy OFF) | 5 min | **Charles** | `crm.gershon.ai` → VPS IP |
| 6 | nginx + SSL | 10 min | Ariel | HTTPS live via Let's Encrypt |
| 7 | Cloudflare proxy ON | 5 min | **Charles** | Orange cloud, Full (strict) SSL |
| 8 | GitHub Actions auto-deploy | 10 min | Ariel + **Charles** (Secrets UI) | Push to `main` → auto-redeploy |
| 9 | Smoke test + handoff | 10 min | Ariel | First admin account created |

Sub-documents live in `docs/deploy/` — one per phase, each with exit criteria and a Troubleshooting section.

---

## Phase 0 — Pre-flight

- [ ] All 5 prereqs are in the 1Password vault.
- [ ] SSH works: `ssh root@<VPS_IP>` with the root password gives a shell.
- [ ] `gershon.ai` is on Cloudflare: `dig NS gershon.ai +short` returns two `*.ns.cloudflare.com` hosts. Anything else → **stop and tell Olivier**.

---

## Phases 1–9

Follow the numbered files in [`deploy/`](./deploy/) in order. Every phase ends with exit criteria — do not continue to the next phase until all boxes check.

---

## Current release gates

Automatic CSV replacement, environment loading, local PostgreSQL compatibility, API authentication and session persistence have been addressed in the local pilot changes. Verify them on the actual VPS before marking deployment complete.

Remaining gates: obtain the exact GC pipeline data and field definitions; validate the imported copy; configure the new hostname and TLS; create Olivier's administrator interactively; verify password login and saved data through a restart. No other users may enter until per-pipeline isolation and assignments are implemented.

## When things go wrong

Each phase doc has a Troubleshooting section. If stuck beyond those, collect: (1) exact command, (2) full error output, (3) `pm2 logs gershoncrm --lines 100` if app-related, (4) `sudo tail -50 /var/log/nginx/error.log` if HTTP-related — write them to `docs/deploy/EXECUTION_LOG.md` and escalate to Olivier.

---

## Credentials created along the way (all go in 1Password)

| Item                                    | Created in |
| --------------------------------------- | ---------- |
| VPS SSH key for `deploy` user           | Phase 1    |
| Postgres password for `gershoncrm_app`  | Phase 3    |
| `.env` `SESSION_SECRET`                 | Phase 4    |
| GitHub Actions SSH deploy key (private) | Phase 8    |

Never commit any of these. `.gitignore` excludes `.env` — verify before every commit.
