import type { Express, RequestHandler } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { OAuth2Client, CodeChallengeMethod } from "google-auth-library";
import { hashPassword, verifyPassword } from "./auth-utils";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "./db";
import { users, type PublicUser } from "@shared/schema";
import { isPilotOwner, isSameOriginMutation, normalizeEmail, publicUser } from "./access-policy";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    googleLogin?: { state: string; nonce: string; verifier: string; started: number };
  }
}
declare global {
  namespace Express { interface Request { crmUser?: PublicUser } }
}

export function setupAuth(app: Express) {
  const production = process.env.NODE_ENV === "production";
  const appUrl = new URL(process.env.APP_URL || (production ? "https://crm.gershon.ai" : "http://localhost:5000"));
  if (appUrl.username || appUrl.password || appUrl.search || appUrl.hash || appUrl.pathname !== "/" ||
      (appUrl.protocol !== "https:" && !(appUrl.protocol === "http:" && ["localhost", "127.0.0.1"].includes(appUrl.hostname) && !production))) {
    throw new Error("APP_URL must be an HTTPS origin (HTTP localhost is allowed in development)");
  }
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32 || /CHANGE_ME/.test(secret)) throw new Error("Set a random SESSION_SECRET of at least 32 characters");
  const ownerEmail = process.env.PILOT_ADMIN_EMAIL || "olivier@gershonconsulting.com";
  const origin = appUrl.origin;
  const callback = `${origin}/api/auth/google/callback`;
  const ready = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const google = () => new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, callback);
  const PgStore = connectPgSimple(session);
  // nginx is the only proxy directly in front of Express; Node binds to loopback.
  app.set("trust proxy", "loopback");
  app.use(session({
    name: production ? "__Host-crm.sid" : "crm.sid",
    secret,
    store: new PgStore({ pool, createTableIfMissing: true }),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: production, sameSite: "lax", path: "/", maxAge: 8 * 60 * 60 * 1000 },
  }));
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (!isSameOriginMutation(req.method, req.get("origin"), origin)) {
      return res.status(403).json({ message: "Please make this request from the CRM application." });
    }
    next();
  });

  app.get("/api/auth/me", async (req, res, next) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Sign in to continue" });
      const [user] = await db.select().from(users).where(eq(users.id, req.session.userId));
      if (!user || !user.isActive || user.role !== "admin" || !isPilotOwner(user.email, true, ownerEmail)) {
        req.session.destroy(() => {});
        return res.status(401).json({ message: "Your account does not have pilot access" });
      }
      res.json(publicUser(user));
    } catch (error) { next(error); }
  });

  app.get("/api/auth/methods", (_req, res) => res.json({ password: true, google: ready }));

  // One failed-attempt bucket for the only enabled account. Bounded memory;
  // independent of user-supplied email/IP values and shared across sessions.
  let failedAttempts = 0;
  let retryAfter = 0;
  let loginInProgress = false;
  const dummyHash = hashPassword(randomBytes(32).toString("hex"));
  app.post("/api/auth/login", async (req, res, next) => {
    if (loginInProgress || Date.now() < retryAfter) {
      res.setHeader("Retry-After", "60");
      return res.status(429).json({ message: "Please wait a minute before trying again." });
    }
    const { email, password } = req.body || {};
    if (typeof email !== "string" || typeof password !== "string" || email.length > 254 || password.length > 1024 || !password) {
      return res.status(400).json({ message: "Enter your email and password." });
    }
    loginInProgress = true;
    try {
      const matches = await db.select().from(users).where(sql`lower(trim(${users.email})) = ${normalizeEmail(email)}`);
      const user = matches.length === 1 ? matches[0] : undefined;
      const passwordMatches = await verifyPassword(password, user?.password || await dummyHash);
      if (!user || !passwordMatches || !user.isActive || user.role !== "admin" || !isPilotOwner(user.email, true, ownerEmail)) {
        failedAttempts++;
        if (failedAttempts >= 5) { retryAfter = Date.now() + 60_000; failedAttempts = 0; }
        return res.status(401).json({ message: "Email or password is incorrect, or this account has no pilot access." });
      }
      failedAttempts = 0;
      await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, user.id));
      await new Promise<void>((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
      req.session.userId = user.id;
      req.session.save(error => error ? next(error) : res.json(publicUser(user)));
    } catch (error) { next(error); }
    finally { loginInProgress = false; }
  });

  app.get("/api/auth/google", async (req, res, next) => {
    if (!ready) return res.status(503).json({ message: "Google sign-in is awaiting configuration." });
    try {
      const client = google();
      const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
      const state = randomBytes(32).toString("hex");
      const nonce = randomBytes(32).toString("hex");
      req.session.googleLogin = { state, nonce, verifier: codeVerifier, started: Date.now() };
      const url = client.generateAuthUrl({
        scope: ["openid", "email", "profile"], state, nonce,
        code_challenge: codeChallenge, code_challenge_method: CodeChallengeMethod.S256,
        prompt: "select_account", access_type: "online",
      });
      req.session.save(error => error ? next(error) : res.redirect(url));
    } catch (error) { next(error); }
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const login = req.session.googleLogin;
    if (!login) return res.redirect("/?signin=failed");
    delete req.session.googleLogin;
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const code = typeof req.query.code === "string" ? req.query.code : "";
    if (!ready || !login || !code || Buffer.byteLength(state) !== Buffer.byteLength(login.state) ||
        !timingSafeEqual(Buffer.from(state), Buffer.from(login.state)) || Date.now() - login.started > 10 * 60 * 1000) {
      return req.session.save(() => res.redirect("/?signin=failed"));
    }
    try {
      // Consume the state before making network calls, including failed exchanges.
      await new Promise<void>((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
      const client = google();
      const { tokens } = await client.getToken({ code, codeVerifier: login.verifier });
      if (!tokens.id_token) throw new Error("Missing identity token");
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
      const identity = ticket.getPayload() as (ReturnType<typeof ticket.getPayload> & { nonce?: string });
      if (!identity || identity.nonce !== login.nonce || !identity.sub || !isPilotOwner(identity.email, identity.email_verified, ownerEmail)) {
        return res.redirect("/?signin=restricted");
      }
      const email = normalizeEmail(identity.email!);
      const user = await db.transaction(async tx => {
        // Serialise first-login bootstrap so two callbacks cannot create two owners.
        await tx.execute(sql`select pg_advisory_xact_lock(71420361)`);
        const matches = await tx.select().from(users).where(sql`lower(trim(${users.email})) = ${email}`);
        if (matches.length > 1) throw new Error("Duplicate pilot accounts require administrator review");
        const existing = matches[0];
        if (existing && (!existing.isActive || (existing.googleSubject && existing.googleSubject !== identity.sub))) {
          throw new Error("Account disabled or identity mismatch");
        }
        if (existing) {
          const [updated] = await tx.update(users).set({ googleSubject: identity.sub, role: "admin", lastLogin: new Date() }).where(eq(users.id, existing.id)).returning();
          return updated;
        }
        const [created] = await tx.insert(users).values({
          username: email, email, password: randomBytes(48).toString("hex"), googleSubject: identity.sub,
          firstName: identity.given_name, lastName: identity.family_name, role: "admin", isActive: true, lastLogin: new Date(),
        }).returning();
        return created;
      });
      await new Promise<void>((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
      req.session.userId = user.id;
      req.session.save(error => res.redirect(error ? "/?signin=failed" : "/"));
    } catch {
      // Authorization codes, tokens, and profile data must never enter logs.
      res.redirect("/?signin=failed");
    }
  });

  app.post("/api/auth/logout", (req, res, next) => {
    req.session.destroy(error => {
      if (error) return next(error);
      res.clearCookie(production ? "__Host-crm.sid" : "crm.sid", { path: "/", httpOnly: true, secure: production, sameSite: "lax" });
      res.sendStatus(204);
    });
  });

  const requirePilotOwner: RequestHandler = async (req, res, next) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Sign in to continue" });
      const [user] = await db.select().from(users).where(eq(users.id, req.session.userId));
      if (!user || !user.isActive || user.role !== "admin" || !isPilotOwner(user.email, true, ownerEmail)) {
        return res.status(403).json({ message: "This test version is available only to the pilot administrator." });
      }
      req.crmUser = publicUser(user);
      next();
    } catch (error) { next(error); }
  };
  app.use("/api", requirePilotOwner);
}
