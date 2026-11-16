import { and, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  pipelines,
  pipelineFields,
  dealStages,
  deals,
  contacts,
  activities,
  type FieldOption,
} from "@shared/schema";

/**
 * Streak → CRM import. Payload shape (all keys are Streak keys):
 * {
 *   pipeline: { key, name, stages: [{ key, name, fg?, bg? }], fields: [{ key, name, type, options?: [{key,name}] }] },
 *   boxes: [{
 *     key, name, stageKey, notes?, assignedTo?: string[],
 *     fields?: { [fieldKey | fieldName]: value },   // dropdown/tag values may be option keys OR option names
 *     contacts?: [{ name, email?, title?, org? }],
 *     comments?: [{ key, author?, createdAt, message }],
 *     created?: number|string, magic?: Record<string, any>
 *   }]
 * }
 * Upserts by Streak key. Never deletes CRM data.
 */

export type StreakFieldType = "TEXT" | "DROPDOWN" | "TAG" | "CHECKBOX" | "DATE" | "NUMBER";

export interface StreakImportPayload {
  pipeline: {
    key: string;
    name: string;
    stages: { key: string; name: string; fg?: string; bg?: string }[];
    fields: { key: string; name: string; type: string; options?: FieldOption[] }[];
  };
  boxes?: StreakBox[];
}

export interface StreakBox {
  key: string;
  name: string;
  stageKey?: string;
  stageName?: string;
  notes?: string;
  assignedTo?: string[];
  fields?: Record<string, any>;
  contacts?: { name: string; email?: string; title?: string; org?: string }[];
  comments?: { key: string; author?: string; createdAt: number | string; message: string }[];
  created?: number | string;
  magic?: Record<string, any>;
}

export function normalizeType(t: string): StreakFieldType {
  const u = (t || "").toUpperCase();
  if (u === "TEXT_INPUT" || u === "TEXT") return "TEXT";
  if (u === "DROPDOWN") return "DROPDOWN";
  if (u === "TAG") return "TAG";
  if (u === "CHECKBOX") return "CHECKBOX";
  if (u === "DATE") return "DATE";
  if (u === "NUMBER" || u === "FORMULA") return "NUMBER";
  return "TEXT";
}

function nextOptionKey(options: FieldOption[]): string {
  const nums = options.map((o) => parseInt(o.key, 10)).filter((n) => !isNaN(n));
  return String(nums.length ? Math.max(...nums) + 1 : 9001);
}

/** Resolve a dropdown/tag value (key or display name) to an option key, adding the option if unknown. */
function resolveOption(options: FieldOption[], raw: string): string | null {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  const byKey = options.find((o) => o.key === v);
  if (byKey) return byKey.key;
  const byName = options.find((o) => o.name.trim().toLowerCase() === v.toLowerCase());
  if (byName) return byName.key;
  const key = nextOptionKey(options);
  options.push({ key, name: v });
  return key;
}

function toDate(v: any): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d = typeof v === "number" ? new Date(v) : new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

export function coerceValue(field: { type: string; options: FieldOption[] }, raw: any): any {
  if (raw === undefined || raw === null || raw === "") return null;
  switch (field.type) {
    case "DROPDOWN":
      return resolveOption(field.options, raw);
    case "TAG": {
      // Streak returns tags as "[9001, 9041]"; also accept arrays and "a, b" strings
      const list = Array.isArray(raw) ? raw : String(raw).replace(/^\s*\[|\]\s*$/g, "").split(/[,;]/);
      const keys = Array.from(new Set(list.map((x) => resolveOption(field.options, String(x).trim())).filter(Boolean)));
      return keys.length ? keys : null;
    }
    case "CHECKBOX":
      return raw === true || /^(true|checked|yes|1)$/i.test(String(raw));
    case "DATE": {
      const d = toDate(raw);
      return d ? d.toISOString() : null;
    }
    case "NUMBER": {
      const n = parseFloat(String(raw).replace(/[^0-9.\-]/g, ""));
      return isNaN(n) ? String(raw) : n;
    }
    default:
      return String(raw);
  }
}

export async function importStreak(payload: StreakImportPayload) {
  const p = payload.pipeline;
  if (!p?.key || !p?.name) throw new Error("pipeline.key and pipeline.name are required");

  // 1. Pipeline
  let [pipe] = await db.select().from(pipelines).where(eq(pipelines.streakKey, p.key));
  if (!pipe) {
    const existing = await db.select().from(pipelines);
    [pipe] = await db
      .insert(pipelines)
      .values({ name: p.name, streakKey: p.key, position: existing.length })
      .returning();
  } else if (pipe.name !== p.name) {
    [pipe] = await db.update(pipelines).set({ name: p.name }).where(eq(pipelines.id, pipe.id)).returning();
  }

  // 2. Stages (order = Streak order)
  const stageIdByKey = new Map<string, number>();
  const stageIdByName = new Map<string, number>();
  const existingStages = await db.select().from(dealStages).where(eq(dealStages.pipelineId, pipe.id));
  for (let i = 0; i < p.stages.length; i++) {
    const s = p.stages[i];
    const found =
      existingStages.find((x) => x.streakKey === s.key) ||
      existingStages.find((x) => !x.streakKey && x.name === s.name);
    const values = {
      name: s.name,
      order: i + 1,
      color: s.bg || "#9e9e9e",
      textColor: s.fg || "#FFFFFF",
      streakKey: s.key,
      pipelineId: pipe.id,
    };
    let id: number;
    if (found) {
      await db.update(dealStages).set(values).where(eq(dealStages.id, found.id));
      id = found.id;
    } else {
      const [row] = await db.insert(dealStages).values({ ...values, probability: 0, count: 0 }).returning();
      id = row.id;
    }
    stageIdByKey.set(s.key, id);
    stageIdByName.set(s.name.toLowerCase(), id);
  }

  // 3. Fields (merge options: keep CRM-added options, update names from Streak)
  const existingFields = await db.select().from(pipelineFields).where(eq(pipelineFields.pipelineId, pipe.id));
  const fieldRows: { id: number; key: string; name: string; type: string; options: FieldOption[] }[] = [];
  for (let i = 0; i < p.fields.length; i++) {
    const f = p.fields[i];
    const type = normalizeType(f.type);
    const found = existingFields.find((x) => x.streakKey === f.key) || existingFields.find((x) => x.name === f.name);
    const opts: FieldOption[] = found ? [...((found.options as FieldOption[]) || [])] : [];
    for (const o of f.options || []) {
      const ex = opts.find((x) => x.key === o.key);
      if (ex) ex.name = o.name;
      else opts.push({ key: o.key, name: o.name });
    }
    let id: number;
    if (found) {
      await db
        .update(pipelineFields)
        .set({ name: f.name, type, streakKey: f.key, options: opts, position: i })
        .where(eq(pipelineFields.id, found.id));
      id = found.id;
    } else {
      const [row] = await db
        .insert(pipelineFields)
        .values({ pipelineId: pipe.id, streakKey: f.key, name: f.name, type, options: opts, position: i })
        .returning();
      id = row.id;
    }
    fieldRows.push({ id, key: f.key, name: f.name, type, options: opts });
  }

  // 4. Boxes
  let created = 0;
  let updated = 0;
  let commentsAdded = 0;
  const boxes = payload.boxes || [];
  const boxKeys = boxes.map((b) => b.key).filter(Boolean);
  const existingDeals = boxKeys.length
    ? await db.select().from(deals).where(inArray(deals.boxKey, boxKeys))
    : [];
  const dealByKey = new Map(existingDeals.map((d) => [d.boxKey as string, d]));

  for (const b of boxes) {
    const stageId =
      (b.stageKey && stageIdByKey.get(b.stageKey)) ||
      (b.stageName && stageIdByName.get(b.stageName.toLowerCase())) ||
      stageIdByKey.get(p.stages[0]?.key);
    if (!stageId) continue;

    const existing = dealByKey.get(b.key);
    const cf: Record<string, any> = { ...((existing?.customFields as Record<string, any>) || {}) };
    for (const [k, raw] of Object.entries(b.fields || {})) {
      const field = fieldRows.find((f) => f.key === k) || fieldRows.find((f) => f.name === k);
      if (!field) continue;
      const v = coerceValue(field, raw);
      if (v === null) delete cf[String(field.id)];
      else cf[String(field.id)] = v;
    }

    // Primary contact (deals.contact_id is NOT NULL in the legacy schema)
    const linked = (b.contacts || []).filter((c) => c && (c.name || c.email));
    const primary = linked[0];
    let contactId = existing?.contactId;
    if (primary) {
      let row = primary.email
        ? (await db.select().from(contacts).where(eq(contacts.email, primary.email)))[0]
        : undefined;
      if (!row) {
        [row] = await db
          .insert(contacts)
          .values({
            name: primary.name || primary.email || b.name,
            firstName: (primary.name || "").split(" ")[0] || null,
            lastName: (primary.name || "").split(" ").slice(1).join(" ") || null,
            email: primary.email || null,
            position: primary.title || null,
            company: primary.org || b.name,
            source: "Streak",
            boxKey: b.key,
          })
          .returning();
      } else if (primary.title && row.position !== primary.title) {
        await db.update(contacts).set({ position: primary.title }).where(eq(contacts.id, row.id));
      }
      contactId = row.id;
    }
    if (!contactId) {
      const [row] = await db
        .insert(contacts)
        .values({ name: b.name, company: b.name, source: "Streak", boxKey: b.key })
        .returning();
      contactId = row.id;
    }

    const values: any = {
      name: b.name,
      stageId,
      pipelineId: pipe.id,
      contactId,
      boxKey: b.key,
      customFields: cf,
      updatedAt: new Date(),
    };
    if (b.notes !== undefined) values.notes = b.notes;
    if (b.assignedTo) values.assignedTo = b.assignedTo.join(", ");
    if (linked.length) values.linkedContacts = linked;
    if (b.magic) values.magic = b.magic;

    let dealId: number;
    if (existing) {
      await db.update(deals).set(values).where(eq(deals.id, existing.id));
      dealId = existing.id;
      updated++;
    } else {
      const createdAt = toDate(b.created) || new Date();
      const [row] = await db.insert(deals).values({ ...values, createdAt }).returning();
      dealId = row.id;
      created++;
    }

    // Comments → activities (idempotent on streak key)
    for (const c of b.comments || []) {
      if (!c?.key || !c.message) continue;
      const [dup] = await db
        .select({ id: activities.id })
        .from(activities)
        .where(and(eq(activities.streakKey, c.key), eq(activities.dealId, dealId)));
      if (dup) continue;
      await db.insert(activities).values({
        type: "comment",
        description: c.message,
        dealId,
        contactId,
        createdBy: c.author || null,
        streakKey: c.key,
        createdAt: toDate(c.createdAt) || new Date(),
      } as any);
      commentsAdded++;
    }
  }

  // Persist options that were added while resolving values
  for (const f of fieldRows) {
    await db.update(pipelineFields).set({ options: f.options }).where(eq(pipelineFields.id, f.id));
  }

  return { pipelineId: pipe.id, stages: p.stages.length, fields: fieldRows.length, created, updated, commentsAdded };
}
