> Historical brief for gershoncrm.com. The CRM pilot now targets crm.gershon.ai on the already-controlled gershon.ai zone. This nameserver migration is not required for the current CRM task. See STATUS.md.

# CHARLES — FIX BRIEF: Move gershoncrm.com DNS to Cloudflare

**From:** Olivier (via Ariel)
**Agent:** Charles (Claude in Chrome)
**Status:** NOT YET EXECUTED as of 2026-11-06 (NS still ns1/ns2.tierra.net)
**Why:** Phase 0 of the deploy runbook requires `gershoncrm.com` to be DNS-managed by **Cloudflare**. Ariel verified (2026-07-04, re-verified 2026-11-06) that the nameservers are `ns1.tierra.net` / `ns2.tierra.net` — the zone lives at the Tierra.net (DomainDiscover) registrar panel, not Cloudflare. Until this is fixed, the whole deployment is blocked: Charles's Task 1/2 (DNS record, proxy, SSL mode) happen in the Cloudflare dashboard, which currently controls nothing.

This brief replaces nothing — the three deploy tasks in `docs/CHARLES_MISSION.md` still stand. This is a **pre-Phase-0 fix**, done once.

---

## Current zone contents (verified 2026-07-04)

No MX, no TXT, no apex (root) record, no www. The zone is exactly these records — the migration checklist:

| # | Name | Type | Data |
|---|------|------|------|
| 1 | api.finance | A | 187.124.235.148 |
| 2 | client | CNAME | gershoncrm-client.pages.dev |
| 3 | company | CNAME | gershon-company.pages.dev |
| 4 | cookie | CNAME | gershon-cookie.pages.dev |
| 5 | crm | CNAME | gershoncrm-crm.pages.dev |
| 6 | dash | CNAME | gershon-dash.pages.dev |
| 7 | finance | CNAME | gershon-finance.pages.dev |
| 8 | form | CNAME | gershon-form.pages.dev |
| 9 | pulse | CNAME | gershon-pulse.pages.dev |
| 10 | radar | CNAME | gershon-radar.pages.dev |
| 11 | report | CNAME | gershoncrm-report.pages.dev |
| 12 | roi | CNAME | gershon-roi.pages.dev |
| 13 | social | CNAME | gershoncrm-social.pages.dev |
| 14 | task | CNAME | gershon-task.pages.dev |

⚠️ Before anything else: open the Tierra.net DNS panel and **scroll the full record list**. If you find ANY record not in this table (anything below `task`, or MX/TXT/SRV rows), add it to the checklist. Every record must survive the move.

---

## Step 1 — Add the zone to Cloudflare

**Where:** https://dash.cloudflare.com (Olivier's account — the one already hosting the `*.pages.dev` projects)

1. **Add a domain** → enter `gershoncrm.com` → plan: **Free** → continue.
2. Cloudflare scans and imports existing records. Its scan is often incomplete — **check every row of the table above against what it imported. Add any missing record manually, exactly as written.**
3. Proxy status for every record: **DNS only (grey cloud)** for now. This preserves today's behavior exactly. (The pages.dev CNAMEs work fine grey because those custom domains are already attached to the Pages projects. Clouds turn orange deliberately, later, per the deploy runbook.)
4. Cloudflare shows **two assigned nameservers** (like `xxx.ns.cloudflare.com`). Copy them exactly — needed in Step 2.

## Step 2 — Point the nameservers at Cloudflare

**Where:** the Tierra.net / DomainDiscover panel (Olivier has the login)

1. Find the domain's **Nameserver** settings (NOT the DNS record editor).
2. Replace `ns1.tierra.net` and `ns2.tierra.net` with the two Cloudflare nameservers from Step 1.
3. Save. **Do not touch or delete the DNS records in the Tierra panel** — they stop being used once the NS change propagates, and they're the rollback if anything goes wrong.

## Step 3 — Verify (propagation: minutes to ~24h, usually <1h)

1. Cloudflare dashboard shows the zone flip from "Pending" to **Active**.
2. Cross-check at https://www.whatsmydns.net/#NS/gershoncrm.com — majority of locations show the Cloudflare nameservers.
3. Spot-check existing sites still load in fresh tabs: https://dash.gershoncrm.com, https://roi.gershoncrm.com, https://api.finance.gershoncrm.com (an API response or error page is fine; a DNS error is not).

**Report to Olivier when done:** "DNS fix done — gershoncrm.com active on Cloudflare, all records verified grey, existing sites load."

---

## Ground rules

1. **Do not delete or edit any record** during this fix — this is a copy job, not a cleanup. That includes the `crm` CNAME to `gershoncrm-crm.pages.dev`: it stays until deploy Phase 5, where Task 1 changes slightly — **delete that CNAME and create the A record** to the VPS IP (grey cloud) instead of just adding one.
2. All clouds **grey** until the runbook says otherwise. Orange comes in Phase 7, and only for `crm`.
3. No secrets in chat or screenshots (none in this task anyway — DNS data here is public).
4. Anything looks different from these instructions (zone already exists in another Cloudflare account, Tierra won't let you change NS, extra records you're unsure about) → stop, screenshot, report to Olivier. Don't improvise.

— Ariel, for Claude (CTO)
