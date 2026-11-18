import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import { pool } from "./db";
import { loadInitialData } from "./data-loader";
import { runMigrations } from "./migrate";
import { adoptLegacyMabsilico } from "./legacy-adopt";

const app = express();
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  app.get('/health', async (_req, res) => {
    try { await pool.query('SELECT 1'); res.json({ status: 'ok' }); }
    catch { res.status(503).json({ status: 'unavailable' }); }
  });
  try {
    await runMigrations();
    log("Schema migrations applied");
  } catch (error) {
    log(`Migration error: ${error}`);
  }
  try {
    const result = await loadInitialData();
    log(`Initial data: ${JSON.stringify(result)}`);
  } catch (error) {
    log(`Error loading initial data: ${error}`);
  }
  try {
    await adoptLegacyMabsilico();
  } catch (error) {
    log(`Legacy adoption error: ${error}`);
  }
  setupAuth(app);
  // Behind Caddy + Docker the proxy is not on loopback (see deploy/vps/docker-compose.yml).
  if (process.env.TRUST_PROXY) app.set("trust proxy", process.env.TRUST_PROXY);

  const server = await registerRoutes(app);
  app.use('/api', (_req, res) => res.status(404).json({ message: 'API endpoint not found' }));

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = status >= 500 ? "Internal Server Error" : err.message;

    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = Number(process.env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  server.listen({
    port,
    // Docker (deploy/vps) needs 0.0.0.0; set HOST=127.0.0.1 for a bare-metal install behind a local proxy.
    host: process.env.HOST || "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
  });
})();
