import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { isNull } from "drizzle-orm";
import { db } from "./db";
import { pipelines, dealStages, deals } from "@shared/schema";
import { importStreak, type StreakBox } from "./streak-import";
import { getMeta, setMeta } from "./migrate";

/**
 * One-time: the first CRM seed (April 2025 CSV export of "MAbSilico - LG") was loaded without
 * pipelines or Streak fields. Attach those rows to a "MAbSilico - LG" pipeline and fill every
 * Streak field (City, State, Country, Value, Notes, Assigned To…) from the same CSV.
 */
export async function adoptLegacyMabsilico() {
  if (await getMeta("legacy_mabsilico_adopted")) return;
  const orphanDeals = await db.select({ id: deals.id }).from(deals).where(isNull(deals.pipelineId));
  if (orphanDeals.length === 0) {
    await setMeta("legacy_mabsilico_adopted", "nothing-to-adopt");
    return;
  }

  const def = JSON.parse(
    fs.readFileSync(path.resolve("server/streak-defs/mabsilico-lg.json"), "utf8"),
  );

  let [pipe] = await db.select().from(pipelines);
  if (!pipe || pipe.streakKey !== def.key) {
    [pipe] = await db.insert(pipelines).values({ name: def.name, streakKey: def.key, position: 99 }).returning();
  }
  await db.update(dealStages).set({ pipelineId: pipe.id }).where(isNull(dealStages.pipelineId));
  await db.update(deals).set({ pipelineId: pipe.id }).where(isNull(deals.pipelineId));

  const csvPath = path.resolve(
    "attached_assets/Streak Export_ MAbSilico - LG (4-14-25, 3_32 PM) - Boxes (MAbSilico - LG).csv",
  );
  const boxes: StreakBox[] = [];
  if (fs.existsSync(csvPath)) {
    const rows = parse(fs.readFileSync(csvPath, "utf8"), {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      bom: true,
    }) as Record<string, string>[];
    for (const r of rows) {
      if (!r["Box Key"]) continue;
      const fields: Record<string, any> = {};
      for (const f of def.fields) {
        if (r[f.name] !== undefined) fields[f.key] = f.name === "Done" ? r[f.name] === "Checked" : r[f.name];
      }
      boxes.push({
        key: r["Box Key"],
        name: r["Name"],
        stageName: r["Stage"],
        notes: r["Notes"] || "",
        assignedTo: r["Assigned To"] ? r["Assigned To"].split(/[,;]\s*/) : undefined,
        fields,
      });
    }
  }
  // Only update boxes that already exist in the CRM (never re-create deleted ones)
  const existingKeys = new Set(
    (await db.select({ k: deals.boxKey }).from(deals)).map((x) => x.k).filter(Boolean) as string[],
  );
  const result = await importStreak({ pipeline: def, boxes: boxes.filter((b) => existingKeys.has(b.key)) });
  await setMeta("legacy_mabsilico_adopted", JSON.stringify(result));
  console.log("Adopted legacy MAbSilico data:", result);
}
