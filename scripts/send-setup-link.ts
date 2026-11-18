// Emails the pilot administrator a one-time link to choose their own password.
// The token is never printed: only its hash is stored, and the link goes
// straight to PILOT_ADMIN_EMAIL. Creates the administrator account if missing,
// with a random password nobody knows, so no credential is ever typed by an operator.
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { db, pool } from "../server/db";
import { passwordSetupTokens, users } from "../shared/schema";
import { hashPassword } from "../server/auth-utils";
import { normalizeEmail } from "../server/access-policy";
import { hashSetupToken, newSetupToken, SETUP_TOKEN_HOURS } from "../server/password-setup";

const email = normalizeEmail(process.env.PILOT_ADMIN_EMAIL || "olivier@gershonconsulting.com");
const appUrl = new URL(process.env.APP_URL || "https://crm.gershon.ai").origin;
const from = process.env.CRM_MAIL_FROM || "Gershon CRM <crm@gershon.ai>";
const apiKey = process.env.RESEND_API_KEY;
const masked = email.replace(/^(.).*(@.*)$/, "$1…$2");

try {
  if (!apiKey) throw new Error("RESEND_API_KEY is not set for this one-off run.");
  const token = newSetupToken();
  const tokenId = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(71420361)`);
    let [owner] = await tx.select().from(users).where(sql`lower(trim(${users.email})) = ${email}`);
    if (!owner) {
      [owner] = await tx.insert(users).values({
        username: email, email, password: await hashPassword(randomBytes(32).toString("hex")),
        firstName: "Olivier", role: "admin", isActive: true,
      }).returning();
      console.log("Pilot administrator account created (no usable password until the link is used).");
    }
    // Older unused links stop working once a new one is sent.
    await tx.update(passwordSetupTokens).set({ usedAt: new Date() })
      .where(sql`${passwordSetupTokens.userId} = ${owner.id} and ${passwordSetupTokens.usedAt} is null`);
    const [row] = await tx.insert(passwordSetupTokens).values({
      userId: owner.id, tokenHash: hashSetupToken(token),
      expiresAt: new Date(Date.now() + SETUP_TOKEN_HOURS * 3600_000),
    }).returning();
    return row.id;
  });
  const link = `${appUrl}/set-password#token=${token}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from, to: [email], subject: "Choose your Gershon CRM password",
      text: `Hi Olivier,\n\nYour Gershon CRM pilot is ready at ${appUrl}.\n\nOpen this link to choose your password (it works once, for ${SETUP_TOKEN_HOURS} hours):\n${link}\n\nThen sign in at ${appUrl} with ${email}.\n`,
      html: `<p>Hi Olivier,</p><p>Your Gershon CRM pilot is ready at <a href="${appUrl}">${appUrl}</a>.</p><p><a href="${link}">Choose your password</a> (the link works once, for ${SETUP_TOKEN_HOURS} hours).</p><p>Then sign in with ${email}.</p>`,
    }),
  });
  if (!response.ok) {
    await db.update(passwordSetupTokens).set({ usedAt: new Date() }).where(sql`${passwordSetupTokens.id} = ${tokenId}`);
    throw new Error(`The email service refused the message (HTTP ${response.status}); the link was cancelled.`);
  }
  console.log(`Setup link emailed to ${masked}, valid ${SETUP_TOKEN_HOURS} hours.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Sending the setup link failed.");
  process.exitCode = 1;
} finally { await pool.end(); }
