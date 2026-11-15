// Imports a read-only Streak snapshot into the pilot database.
//   node dist/scripts/import-streak.js <snapshot-dir> [--apply]
// <snapshot-dir> holds pipeline.json (Streak get_pipeline) and part-*.jsonl, one line per box:
//   {"box": <get_box>, "tasks": <get_box_tasks> | null, "timeline": [entries] | null}
// Dry run by default: prints what would change and rolls back. Idempotent: deals and
// contacts are matched on their Streak keys; a box's imported tasks and notes are replaced.
import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { and, eq, like, sql } from "drizzle-orm";
import { db, pool } from "../server/db";
import { activities, contacts, deals, dealStages, tasks } from "../shared/schema";

type Json = any;
const dir = process.argv[2];
const apply = process.argv.includes("--apply");
if (!dir) { console.error("Usage: import-streak <snapshot-dir> [--apply]"); process.exit(2); }

const pipeline: Json = JSON.parse(readFileSync(join(dir, "pipeline.json"), "utf8"));
const rows: Json[] = readdirSync(dir).filter(f => /^part-.*\.jsonl$/.test(f)).sort()
  .flatMap(f => readFileSync(join(dir, f), "utf8").split("\n").filter(l => l.trim()).map(l => JSON.parse(l)));

// Default win probability per GC stage name prefix; editable in the CRM afterwards.
const PROBABILITY: Record<string, number> = { "1": 5, "2": 10, "3": 20, "4": 30, "5": 50, "6": 30, "7": 70, "8": 90, "9": 0 };
const fieldDefs = new Map<string, Json>(pipeline.fields.map((f: Json) => [f.name, f]));
const optionName = (field: Json, key: string) =>
  ((field.dropdownOptions || field.tagOptions || []) as Json[]).find(o => o.key === key)?.name?.trim() ?? key;
const asKeys = (v: unknown): string[] => Array.isArray(v) ? v.map(String) :
  typeof v === "string" && v.trim() ? v.split(",").map(s => s.trim()).filter(Boolean) : [];

function readable(name: string, raw: unknown): unknown {
  const def = fieldDefs.get(name);
  if (raw === "" || raw === null || raw === undefined) return null;
  if (!def) return raw;
  switch (def.type) {
    case "DROPDOWN": return optionName(def, String(raw));
    case "TAG": return asKeys(raw).map(k => optionName(def, k));
    case "CHECKBOX": return raw === true || raw === "true";
    case "DATE": { const n = Number(raw); return new Date(Number.isFinite(n) && n > 1e11 ? n : String(raw)).toISOString(); }
    default: return raw;
  }
}
const date = (v: unknown): Date | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v); const d = new Date(Number.isFinite(n) && n > 1e11 ? n : String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};
const emailOf = (who: unknown) => typeof who === "string" ? (who.match(/\(([^)]+@[^)]+)\)/)?.[1] ?? (who.includes("@") ? who : null)) :
  (who && typeof who === "object" && "email" in (who as Json)) ? (who as Json).email : null;
const level = (p: unknown) => typeof p === "string" ? (/high/i.test(p) ? "High" : /medium/i.test(p) ? "Medium" : /low/i.test(p) ? "Low" : null) : null;
const money = (v: unknown) => { const n = Number(String(v ?? "").replace(/[^0-9.]/g, "")); return Number.isFinite(n) ? n : 0; };
const splitName = (n: string) => { const [first, ...rest] = n.trim().split(/\s+/); return { firstName: first || null, lastName: rest.join(" ") || null }; };

const stats = { stagesCreated: 0, stagesUpdated: 0, dealsCreated: 0, dealsUpdated: 0, contactsCreated: 0, contactsUpdated: 0, placeholderContacts: 0, tasks: 0, notes: 0, skipped: [] as string[] };

class DryRun extends Error {}
try {
  await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(71420362)`);
    // Stages, in Streak order, matched by name.
    const stageIds = new Map<string, number>();
    for (const [i, s] of (pipeline.stages as Json[]).entries()) {
      const values = { name: s.name, order: i + 1, color: s.color?.backgroundColor || "#9e9e9e", probability: PROBABILITY[s.name.trim()[0]] ?? 10 };
      const [existing] = await tx.select().from(dealStages).where(eq(dealStages.name, s.name));
      if (existing) { await tx.update(dealStages).set(values).where(eq(dealStages.id, existing.id)); stageIds.set(s.key, existing.id); stats.stagesUpdated++; }
      else { const [row] = await tx.insert(dealStages).values(values).returning(); stageIds.set(s.key, row.id); stats.stagesCreated++; }
    }

    for (const row of rows) {
      const box = row.box;
      const stageId = stageIds.get(box.stageKey);
      if (!stageId) { stats.skipped.push(`${box.name}: unknown stage ${box.stageKey}`); continue; }
      const fields: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(box.fields || {})) { const r = readable(k, v); if (r !== null && !(Array.isArray(r) && !r.length)) fields[k] = r; }
      const mc = box.magicColumns || {};
      const assignees = (box.assignedTo || []).map(emailOf).filter(Boolean);
      const orgDomain = box.organizations?.[0]?.domain || null;

      // Contacts linked to the box, matched on Streak contact key.
      const contactIds: number[] = [];
      const people: Json[] = box.contacts?.length ? box.contacts : [{ contactKey: `placeholder:${box.boxKey}`, name: box.name, placeholder: true }];
      for (const c of people) {
        const values = {
          ...splitName(c.name || box.name), name: c.name || box.name, email: c.email || null, company: box.name,
          position: c.role || null, domain: orgDomain, boxKey: box.boxKey, source: (fields.Origin as string) || null,
          customFields: { streakContactKey: c.contactKey, ...(c.placeholder ? { placeholder: true } : {}) },
        };
        const [existing] = await tx.select().from(contacts).where(sql`${contacts.customFields}->>'streakContactKey' = ${c.contactKey}`);
        if (existing) { await tx.update(contacts).set(values).where(eq(contacts.id, existing.id)); contactIds.push(existing.id); stats.contactsUpdated++; }
        else { const [r] = await tx.insert(contacts).values(values).returning(); contactIds.push(r.id); stats.contactsCreated++; if (c.placeholder) stats.placeholderContacts++; }
      }

      const dealValues = {
        name: box.name, contactId: contactIds[0], stageId, value: money(fields["Deal Size"]), notes: box.notes || null,
        description: (fields.Pitch as string) || null, done: fields.Done === true, thread: (fields.Thread as string) || null,
        createdAt: date(box.creationTimestamp) ?? new Date(), lastContactedAt: date(mc.lastTouchpointTimestamp),
        lastEmailDate: date(mc.lastEmailUpdatedTimestamp), nextTaskDueDate: date(mc.soonestTaskDueDate),
        daysInStage: mc.lastStageChangeTimestamp ? Math.max(0, Math.floor((Date.now() - +new Date(mc.lastStageChangeTimestamp)) / 864e5)) : 0,
        emailThreadCount: Number(mc.gmailThreadCount || 0), assignedTo: assignees[0] || null,
        interest: level(fields.Priority), type: (fields.Type as string) || null, category: (fields.Industry as string) || null,
        source: (fields.Origin as string) || null, boxKey: box.boxKey,
        tags: [...((fields.Keywords as string[]) || []), ...((fields.Services as string[]) || [])],
        customFields: { streak: { url: box.url, fields, assignees, contactIds, createdBy: box.createdBy, lastUpdated: date(box.lastUpdatedTimestamp), magicColumns: mc } },
      };
      let [deal] = await tx.select().from(deals).where(eq(deals.boxKey, box.boxKey));
      if (deal) { [deal] = await tx.update(deals).set(dealValues).where(eq(deals.id, deal.id)).returning(); stats.dealsUpdated++; }
      else { [deal] = await tx.insert(deals).values(dealValues).returning(); stats.dealsCreated++; }

      // Tasks and timeline notes: replace whatever an earlier import of this box created.
      await tx.delete(tasks).where(and(eq(tasks.dealId, deal.id), eq(tasks.category, "streak")));
      await tx.delete(activities).where(and(eq(activities.dealId, deal.id), like(activities.threadId, "streak:%")));
      for (const t of row.tasks?.tasks || []) {
        const done = /done|complete/i.test(String(t.status || ""));
        await tx.insert(tasks).values({
          title: t.text || "(untitled task)", dueDate: date(t.dueDate), completed: done, completedAt: done ? date(t.dueDate) : null,
          assignedTo: (t.assignedUsers || []).map(emailOf).filter(Boolean)[0] || null, dealId: deal.id, contactId: contactIds[0], category: "streak",
        });
        stats.tasks++;
      }
      for (const e of row.timeline || []) {
        const m = e.meeting, c = e.comment;
        let type: string, text: string | undefined, by: string | null = null;
        if (m) { type = m.kind === "call_log" ? "call" : "meeting"; text = m.notes || (m.kind === "call_log" ? "Call logged" : "Meeting logged"); by = emailOf(m.lead); }
        else if (c) {
          type = "note"; by = emailOf(c.author);
          text = [c.message, ...(c.replies || []).map((r: Json) => `↳ ${r.author?.name || emailOf(r.author) || ""}: ${r.message || ""}`)].filter(Boolean).join("\n");
        } else continue;
        if (!text) continue;
        await tx.insert(activities).values({
          type, description: text, dealId: deal.id, contactId: contactIds[0], createdAt: date(c?.createdAt || e.timestamp) ?? new Date(),
          createdBy: by, threadId: `streak:${e.entryKey || e.timestamp}`,
        });
        stats.notes++;
      }
    }

    // Keep per-stage counts in step for the pipeline header.
    await tx.execute(sql`update deal_stages s set count = (select count(*) from deals d where d.stage_id = s.id)`);
    const totals = await tx.execute(sql`select s.name, count(d.id)::int as deals from deal_stages s left join deals d on d.stage_id = s.id where s.id in (${sql.join([...stageIds.values()].map(v => sql`${v}`), sql`, `)}) group by s.name, s."order" order by s."order"`);
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", boxesInSnapshot: rows.length, ...stats, perStage: totals.rows }, null, 1));
    if (!apply) throw new DryRun();
  });
  console.log(apply ? "Import committed." : "Dry run only: nothing was saved. Re-run with --apply.");
} catch (error) {
  if (!(error instanceof DryRun)) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
  else console.log("Dry run only: nothing was saved. Re-run with --apply.");
} finally { await pool.end(); }
