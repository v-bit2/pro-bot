import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "./config.js";
import { SessionManager } from "./lib/session-manager.js";
import { loadCommands } from "./lib/command-loader.js";
import { startChannelAutoFollowWorker } from "./lib/channel-follow.js";
import { createApiV1Router } from "./routes/api-v1.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const manager = new SessionManager(config);

app.use(express.json({ limit: "64kb" }));
app.use(express.static(path.join(__dirname, "public")));

// Security header to disable directory listing / sensitive access
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

// Mount /api/v1 REST API router
app.use("/api/v1", createApiV1Router(manager));

// Legacy compatibility health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    name: config.name,
    uptime: Math.floor(process.uptime()),
    sessions: manager.count()
  });
});

// Legacy active sessions list (Public status summary only)
app.get("/api/sessions", (_req, res) => {
  const sessions = Array.from(manager.sessions.values()).map(s => s.publicStatus());
  res.json({ ok: true, count: sessions.length, sessions });
});

// Fallback to SPA Web UI
app.use((_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Optional keep-alive worker for hosting environments like Render
function startKeepAlive() {
  if (!config.keepAlive || !config.keepAliveUrl) return;

  const interval = Math.max(60000, config.keepAliveInterval); // minimum 1 min
  console.log(`[Voltra] Keep-alive worker enabled for ${config.keepAliveUrl} every ${Math.round(interval / 1000)}s`);

  setInterval(async () => {
    try {
      const response = await fetch(config.keepAliveUrl, {
        headers: { "User-Agent": "Voltra-KeepAlive/1.0" }
      });
      if (response.ok) {
        console.log(`[Voltra] Keep-alive ping successful (${response.status})`);
      } else {
        console.warn(`[Voltra] Keep-alive ping returned status ${response.status}`);
      }
    } catch (err) {
      console.error(`[Voltra] Keep-alive ping failed:`, err.message);
    }
  }, interval);
}

app.listen(config.port, "0.0.0.0", async () => {
  console.log(`\n⚡ ${config.name} running on port ${config.port}`);
  console.log(`🌐 http://localhost:${config.port}\n`);

  // Pre-load command modules
  await loadCommands();

  // Restore existing sessions
  await manager.restoreSessions();

  // Start background channel auto-follow worker
  startChannelAutoFollowWorker(manager);

  // Start keep-alive if configured
  startKeepAlive();
});
