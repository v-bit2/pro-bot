import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "./config.js";
import { SessionManager } from "./lib/session-manager.js";
import { loadCommands } from "./lib/command-loader.js";

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

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    name: config.name,
    uptime: Math.floor(process.uptime()),
    sessions: manager.count()
  });
});

// Get active sessions list (public status only)
app.get("/api/sessions", (_req, res) => {
  const sessions = Array.from(manager.sessions.values()).map(s => s.publicStatus());
  res.json({ ok: true, count: sessions.length, sessions });
});

// Pair a WhatsApp account
app.post("/api/pair", async (req, res) => {
  try {
    const phone = String(req.body?.phone || "");
    const result = await manager.createOrPair(phone);
    res.json(result);
  } catch (error) {
    const status = Number(error.statusCode || 400);
    res.status(status).json({
      ok: false,
      error: error.message || "Unable to create pairing code."
    });
  }
});

// Get single session status
app.get("/api/status/:sessionId", (req, res) => {
  const session = manager.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ ok: false, error: "Session not found." });
  }
  res.json({ ok: true, ...session.publicStatus() });
});

// Disconnect a session
app.post("/api/disconnect/:sessionId", async (req, res) => {
  try {
    await manager.disconnect(req.params.sessionId);
    res.json({ ok: true });
  } catch (error) {
    res.status(404).json({ ok: false, error: error.message });
  }
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

  // Start keep-alive if configured
  startKeepAlive();
});
