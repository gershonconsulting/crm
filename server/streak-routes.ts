import type { Express, Request } from "express";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import {
  pipelines,
  pipelineFields,
  dealStages,
  deals,
  activities,
  contacts,
  type FieldOption,
} from "@shared/schema";
import { importStreak, coerceValue, normalizeType } from "./streak-import";

/** Current user = the Caddy basic-auth username (until real login ships). */
export function currentUser(req: Request): string {
  const h = req.headers.authorization || "";
  if (h.startsWith("Basic ")) {
    try {
      const user = Buffer.from(h.slice(6), "base64").toString("utf8").split(":")[0];
      if (user) return user;
    } catch {}
  }
  return "olivier";
}

const FIELD_TYPES = ["TEXT", "DROPDOWN", "TAG", "CHECKBOX", "DATE", "NUMBER"];

function displayValue(field: { type: string; options: any }, value: any): string {
  if (value === null || value === undefined || value === "") return "(empty)";
  const opts: FieldOption[] = field.options || [];
  if (field.type === "DROPDOWN") return opts.find((o) => o.key === value)?.name ?? String(value);
  if (field.type === "TAG")
    return (Array.isArray(value) ? value : [value]).map((k) => opts.find((o) => o.key === k)?.name ?? k).join(", ");
  if (field.type === "CHECKBOX") return value ? "checked" : "unchecked";
  if (field.type === "DATE") return new Date(value).toISOString().slice(0, 10);
  return String(value);
}

export function registerStreakRoutes(app: Express) {
  const api = "/api";

  app.get(`${api}/me`, (req, res) => res.json({ username: currentUser(req) }));

  // ---- Pipelines
  app.get(`${api}/pipelines`, async (_req, res) => {
    const rows = await db.select().from(pipelines).orderBy(asc(pipelines.position), asc(pipelines.id));
    const counts = await db
      .select({ pipelineId: deals.pipelineId, n: sql<number>`count(*)::int` })
      .from(deals)
      .groupBy(deals.pipelineId);
    res.json(rows.map((p) => ({ ...p, boxCount: counts.find((c) => c.pipelineId === p.id)?.n ?? 0 })));
  });

  app.get(`${api}/pipelines/:id/stages`, async (req, res) => {
    const id = parseInt(req.params.id);
    res.json(await db.select().from(dealStages).where(eq(dealStages.pipelineId, id)).orderBy(asc(dealStages.order)));
  });

  // ---- Fields
  app.get(`${api}/pipelines/:id/fields`, async (req, res) => {
    const id = parseInt(req.params.id);
    res.json(
      await db.select().from(pipelineFields).where(eq(pipelineFields.pipelineId, id)).orderBy(asc(pipelineFields.position), asc(pipelineFields.id)),
    );
  });

  app.post(`${api}/pipelines/:id/fields`, async (req, res) => {
    const pipelineId = parseInt(req.params.id);
    const name = String(req.body?.name || "").trim();
    const type = normalizeType(req.body?.type || "TEXT");
    if (!name) return res.status(400).json({ message: "Field name is required" });
    if (!FIELD_TYPES.includes(type)) return res.status(400).json({ message: "Unknown field type" });
    const rawOpts: string[] = Array.isArray(req.body?.options) ? req.body.options : [];
    const options: FieldOption[] = rawOpts
      .map((o: any) => String(typeof o === "string" ? o : o?.name || "").trim())
      .filter(Boolean)
      .map((n, i) => ({ key: String(9001 + i), name: n }));
    const [{ max }] = await db
      .select({ max: sql<number>`coalesce(max(${pipelineFields.position}), -1)::int` })
      .from(pipelineFields)
      .where(eq(pipelineFields.pipelineId, pipelineId));
    const [row] = await db
      .insert(pipelineFields)
      .values({ pipelineId, name, type, options, position: (max ?? -1) + 1 })
      .returning();
    res.status(201).json(row);
  });

  app.put(`${api}/fields/:id`, async (req, res) => {
    const id = parseInt(req.params.id);
    const [field] = await db.select().from(pipelineFields).where(eq(pipelineFields.id, id));
    if (!field) return res.status(404).json({ message: "Field not found" });
    const patch: any = {};
    if (typeof req.body?.name === "string" && req.body.name.trim()) patch.name = req.body.name.trim();
    if (typeof req.body?.position === "number") patch.position = req.body.position;
    if (Array.isArray(req.body?.options)) {
      const seen = new Set<string>();
      const opts: FieldOption[] = [];
      const old: FieldOption[] = (field.options as FieldOption[]) || [];
      let next = Math.max(9000, ...old.map((o) => parseInt(o.key) || 0), ...req.body.options.map((o: any) => parseInt(o?.key) || 0));
      for (const o of req.body.options) {
        const name = String(o?.name || "").trim();
        if (!name) continue;
        let key = o?.key ? String(o.key) : "";
        if (!key || seen.has(key)) key = String(++next);
        seen.add(key);
        opts.push({ key, name, ...(o?.color ? { color: String(o.color) } : {}) });
      }
      patch.options = opts;
      // Clear values that pointed to options which were deleted
      const removed = old.filter((o) => !seen.has(o.key)).map((o) => o.key);
      if (removed.length) {
        const rows = await db.select({ id: deals.id, cf: deals.customFields }).from(deals).where(eq(deals.pipelineId, field.pipelineId));
        for (const r of rows) {
          const cf = { ...((r.cf as Record<string, any>) || {}) };
          const v = cf[String(id)];
          if (v === undefined) continue;
          let changed = false;
          if (field.type === "TAG" && Array.isArray(v)) {
            const nv = v.filter((k: string) => !removed.includes(k));
            if (nv.length !== v.length) {
              changed = true;
              if (nv.length) cf[String(id)] = nv;
              else delete cf[String(id)];
            }
          } else if (removed.includes(v)) {
            delete cf[String(id)];
            changed = true;
          }
          if (changed) await db.update(deals).set({ customFields: cf }).where(eq(deals.id, r.id));
        }
      }
    }
    const [row] = await db.update(pipelineFields).set(patch).where(eq(pipelineFields.id, id)).returning();
    res.json(row);
  });

  app.delete(`${api}/fields/:id`, async (req, res) => {
    const id = parseInt(req.params.id);
    await db.delete(pipelineFields).where(eq(pipelineFields.id, id));
    res.status(204).end();
  });

  // ---- Box (deal) edits
  app.patch(`${api}/deals/:id/field`, async (req, res) => {
    const dealId = parseInt(req.params.id);
    const fieldId = parseInt(req.body?.fieldId);
    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
    const [field] = await db.select().from(pipelineFields).where(eq(pipelineFields.id, fieldId));
    if (!deal || !field) return res.status(404).json({ message: "Box or field not found" });
    const f = { type: field.type, options: [...((field.options as FieldOption[]) || [])] };
    const value = coerceValue(f, req.body?.value);
    if (f.options.length !== ((field.options as FieldOption[]) || []).length) {
      await db.update(pipelineFields).set({ options: f.options }).where(eq(pipelineFields.id, fieldId));
    }
    const cf = { ...((deal.customFields as Record<string, any>) || {}) };
    if (value === null) delete cf[String(fieldId)];
    else cf[String(fieldId)] = value;
    await db.update(deals).set({ customFields: cf, updatedAt: new Date() }).where(eq(deals.id, dealId));
    await db.insert(activities).values({
      type: "field_update",
      description: `${field.name}: ${displayValue(f, value)}`,
      dealId,
      contactId: deal.contactId,
      createdBy: currentUser(req),
    });
    res.json({ ok: true, customFields: cf });
  });

  app.patch(`${api}/deals/:id`, async (req, res) => {
    const dealId = parseInt(req.params.id);
    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
    if (!deal) return res.status(404).json({ message: "Box not found" });
    const user = currentUser(req);
    const patch: any = { updatedAt: new Date() };
    const log: string[] = [];
    if (typeof req.body?.name === "string" && req.body.name.trim()) patch.name = req.body.name.trim();
    if (typeof req.body?.notes === "string") patch.notes = req.body.notes;
    if (typeof req.body?.assignedTo === "string" && req.body.assignedTo !== (deal.assignedTo || "")) {
      patch.assignedTo = req.body.assignedTo;
      log.push(`Assigned to: ${req.body.assignedTo || "nobody"}`);
    }
    if (req.body?.stageId && Number(req.body.stageId) !== deal.stageId) {
      const [from] = await db.select().from(dealStages).where(eq(dealStages.id, deal.stageId));
      const [to] = await db.select().from(dealStages).where(eq(dealStages.id, Number(req.body.stageId)));
      if (!to) return res.status(400).json({ message: "Unknown stage" });
      patch.stageId = to.id;
      log.push(`Stage: ${from?.name ?? "?"} → ${to.name}`);
    }
    await db.update(deals).set(patch).where(eq(deals.id, dealId));
    for (const description of log) {
      await db.insert(activities).values({ type: "deal_update", description, dealId, contactId: deal.contactId, createdBy: user });
    }
    const [updated] = await db.select().from(deals).where(eq(deals.id, dealId));
    res.json(updated);
  });

  // ---- New box in a pipeline/stage
  app.post(`${api}/pipelines/:id/boxes`, async (req, res) => {
    const pipelineId = parseInt(req.params.id);
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ message: "Box name is required" });
    let stageId = Number(req.body?.stageId);
    if (!stageId) {
      const [first] = await db.select().from(dealStages).where(eq(dealStages.pipelineId, pipelineId)).orderBy(asc(dealStages.order));
      stageId = first?.id;
    }
    if (!stageId) return res.status(400).json({ message: "Pipeline has no stages" });
    const [contact] = await db.insert(contacts).values({ name, company: name, source: "CRM" }).returning();
    const [row] = await db
      .insert(deals)
      .values({ name, stageId, pipelineId, contactId: contact.id, assignedTo: req.body?.assignedTo || null, customFields: {}, createdAt: new Date(), updatedAt: new Date() } as any)
      .returning();
    await db.insert(activities).values({ type: "deal_update", description: "Box created", dealId: row.id, contactId: contact.id, createdBy: currentUser(req) });
    res.status(201).json(row);
  });

  // ---- Comments (Streak's box comments)
  app.post(`${api}/deals/:id/comments`, async (req, res) => {
    const dealId = parseInt(req.params.id);
    const message = String(req.body?.message || "").trim();
    if (!message) return res.status(400).json({ message: "Comment is empty" });
    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
    if (!deal) return res.status(404).json({ message: "Box not found" });
    const [row] = await db
      .insert(activities)
      .values({ type: "comment", description: message, dealId, contactId: deal.contactId, createdBy: currentUser(req) })
      .returning();
    res.status(201).json(row);
  });

  app.put(`${api}/activities/:id`, async (req, res) => {
    const id = parseInt(req.params.id);
    const description = String(req.body?.description || "").trim();
    if (!description) return res.status(400).json({ message: "Comment is empty" });
    const [row] = await db
      .update(activities)
      .set({ description })
      .where(and(eq(activities.id, id), eq(activities.type, "comment")))
      .returning();
    if (!row) return res.status(404).json({ message: "Comment not found" });
    res.json(row);
  });

  // ---- Streak import (pipeline definition + boxes), idempotent upsert
  app.post(`${api}/import/streak`, async (req, res) => {
    try {
      const result = await importStreak(req.body);
      res.json(result);
    } catch (e: any) {
      console.error("Streak import failed", e);
      res.status(400).json({ message: e?.message || "Import failed" });
    }
  });
}
