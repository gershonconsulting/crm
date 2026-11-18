import type { Express, Request } from "express";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import { passwordSetupTokens, users } from "@shared/schema";
import { hashPassword } from "./auth-utils";
import { isPilotOwner, publicUser } from "./access-policy";

export const SETUP_TOKEN_HOURS = 24;
export const hashSetupToken = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");
export const newSetupToken = () => randomBytes(32).toString("base64url");
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function validNewPassword(password: unknown): password is string {
  return typeof password === "string" && password.length >= 14 && password.length <= 1024;
}

// Plain page so the link works before the React app (and its sign-in gate) loads.
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Choose your password · Gershon CRM</title>
<style>body{font-family:system-ui,sans-serif;background:#f6f6f7;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px}
form{background:#fff;border-radius:12px;box-shadow:0 2px 12px #0001;padding:28px;max-width:380px;width:100%}h1{font-size:20px;margin:0 0 6px}
p{color:#555;font-size:14px}label{display:block;font-size:14px;margin-top:14px}input{width:100%;box-sizing:border-box;padding:10px;font-size:16px;border:1px solid #ccc;border-radius:8px;margin-top:4px}
button{margin-top:18px;width:100%;padding:12px;border:0;border-radius:8px;background:#FE1B04;color:#fff;font-size:16px;cursor:pointer}#msg{margin-top:12px;font-size:14px}</style></head>
<body><form id="f"><h1>Choose your password</h1><p>Gershon CRM pilot. Use at least 14 characters and save it in 1Password.</p>
<label>New password<input type="password" id="p1" autocomplete="new-password" minlength="14" required></label>
<label>Repeat password<input type="password" id="p2" autocomplete="new-password" minlength="14" required></label>
<button>Save and sign in</button><div id="msg" role="status"></div></form>
<script>const t=new URLSearchParams(location.hash.slice(1)).get('token')||'';history.replaceState(null,'','/set-password');
const m=document.getElementById('msg');document.getElementById('f').onsubmit=async e=>{e.preventDefault();const a=p1.value,b=p2.value;
if(a!==b){m.textContent='The two passwords are different.';return}if(a.length<14){m.textContent='Use at least 14 characters.';return}
m.textContent='Saving…';const r=await fetch('/api/auth/setup-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:t,password:a})});
if(r.ok){m.textContent='Saved. Opening the CRM…';location.href='/'}else{const j=await r.json().catch(()=>({}));m.textContent=j.message||'This link did not work.'}}</script></body></html>`;

export function setupPasswordRoutes(app: Express, ownerEmail: string) {
  app.get("/set-password", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.type("html").send(page);
  });

  let attempts = 0;
  let windowStart = Date.now();
  app.post("/api/auth/setup-password", async (req: Request, res, next) => {
    if (Date.now() - windowStart > 60_000) { attempts = 0; windowStart = Date.now(); }
    if (++attempts > 10) return res.status(429).json({ message: "Please wait a minute before trying again." });
    const { token, password } = req.body || {};
    if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) return res.status(400).json({ message: "This link is not valid. Ask for a new one." });
    if (!validNewPassword(password)) return res.status(400).json({ message: "Use a password between 14 and 1024 characters." });
    try {
      const hashed = await hashPassword(password);
      const user = await db.transaction(async tx => {
        const [row] = await tx.select().from(passwordSetupTokens).where(and(
          eq(passwordSetupTokens.tokenHash, hashSetupToken(token)),
          isNull(passwordSetupTokens.usedAt),
          gt(passwordSetupTokens.expiresAt, sql`now()`),
        )).for("update");
        if (!row) return undefined;
        const [owner] = await tx.select().from(users).where(eq(users.id, row.userId));
        if (!owner || !owner.isActive || owner.role !== "admin" || !isPilotOwner(owner.email, true, ownerEmail)) return undefined;
        await tx.update(passwordSetupTokens).set({ usedAt: new Date() }).where(eq(passwordSetupTokens.userId, row.userId));
        const [updated] = await tx.update(users).set({ password: hashed, lastLogin: new Date() }).where(eq(users.id, owner.id)).returning();
        return updated;
      });
      if (!user) return res.status(400).json({ message: "This link has expired or was already used. Ask for a new one." });
      await new Promise<void>((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
      req.session.userId = user.id;
      req.session.save(error => error ? next(error) : res.json(publicUser(user)));
    } catch (error) { next(error); }
  });
}
