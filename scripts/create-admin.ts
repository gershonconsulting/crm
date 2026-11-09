import "dotenv/config";
import { db, pool } from "../server/db";
import { users } from "../shared/schema";
import { sql } from "drizzle-orm";
import { hashPassword } from "../server/auth-utils";
import { normalizeEmail } from "../server/access-policy";

async function readPassword(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) throw new Error("Run this command in an interactive terminal; passwords must not be command arguments.");
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const cleanup = () => { process.stdin.off('data', onData); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); };
    const onData = (data: Buffer) => {
      for (const character of data.toString()) {
        if (character === '\u0003') { cleanup(); reject(new Error('Cancelled')); return; }
        if (character === '\r' || character === '\n') { cleanup(); resolve(value); return; }
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else if (character >= ' ') value += character;
      }
    };
    process.stdin.on('data', onData);
  });
}

try {
  const email = normalizeEmail(process.env.PILOT_ADMIN_EMAIL || 'olivier@gershonconsulting.com');
  const password = await readPassword(`Choose a password for ${email} (hidden): `);
  if (password.length < 14 || password.length > 1024) throw new Error('Use a password between 14 and 1024 characters.');
  if (password !== await readPassword('Repeat password (hidden): ')) throw new Error('Passwords do not match.');
  const hashed = await hashPassword(password);
  await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(71420361)`);
    const matches = await tx.select().from(users).where(sql`lower(trim(${users.email})) = ${email}`);
    if (matches.length) throw new Error('The pilot account already exists; no credentials were changed.');
    await tx.insert(users).values({ username: email, email, password: hashed, firstName: 'Olivier', role: 'admin', isActive: true });
  });
  console.log('Pilot administrator created. Save the password in 1Password.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Administrator setup failed.');
  process.exitCode = 1;
} finally { await pool.end(); }
