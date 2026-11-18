import { pool } from "./db";

/**
 * Additive, idempotent schema migration run on every boot.
 * Only CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS — never drops or rewrites data.
 */
export async function runMigrations() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS pipelines (
       id SERIAL PRIMARY KEY,
       name TEXT NOT NULL,
       streak_key TEXT,
       position INTEGER DEFAULT 0
     )`,
    `CREATE TABLE IF NOT EXISTS pipeline_fields (
       id SERIAL PRIMARY KEY,
       pipeline_id INTEGER NOT NULL,
       streak_key TEXT,
       name TEXT NOT NULL,
       type TEXT NOT NULL,
       options JSONB,
       position INTEGER DEFAULT 0
     )`,
    `CREATE TABLE IF NOT EXISTS app_meta (
       key TEXT PRIMARY KEY,
       value TEXT
     )`,
    `ALTER TABLE deal_stages ADD COLUMN IF NOT EXISTS pipeline_id INTEGER`,
    `ALTER TABLE deal_stages ADD COLUMN IF NOT EXISTS streak_key TEXT`,
    `ALTER TABLE deal_stages ADD COLUMN IF NOT EXISTS text_color TEXT`,
    `ALTER TABLE deals ADD COLUMN IF NOT EXISTS pipeline_id INTEGER`,
    `ALTER TABLE deals ADD COLUMN IF NOT EXISTS linked_contacts JSONB`,
    `ALTER TABLE deals ADD COLUMN IF NOT EXISTS magic JSONB`,
    `ALTER TABLE deals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP`,
    `ALTER TABLE activities ADD COLUMN IF NOT EXISTS streak_key TEXT`,
    `CREATE INDEX IF NOT EXISTS deals_box_key_idx ON deals (box_key)`,
    `CREATE INDEX IF NOT EXISTS deals_pipeline_idx ON deals (pipeline_id)`,
    `CREATE INDEX IF NOT EXISTS activities_deal_idx ON activities (deal_id)`,
  ];
  for (const sql of statements) {
    await pool.query(sql);
  }
}

export async function getMeta(key: string): Promise<string | null> {
  const r = await pool.query(`SELECT value FROM app_meta WHERE key = $1`, [key]);
  return r.rows[0]?.value ?? null;
}

export async function setMeta(key: string, value: string) {
  await pool.query(
    `INSERT INTO app_meta (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value],
  );
}
