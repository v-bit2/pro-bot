import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "./config.js";
import { SessionManager } from "./lib/session-manager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const manager = new SessionManager(config);

app.use(express.json({ limit: "64kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    name: config.name,
    sessions: manager.count(),
    uptime: Math.floor(process.uptime())
  });
});

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

app.get("/api/status/:sessionId", (_req, res) => {
  const session = manager.get(_req.params.sessionId);
  if (!session) {
    return res.status(404).json({ ok: false, error: "Session not found." });
  }
  res.json({ ok: true, ...session.publicStatus() });
});

app.post("/api/disconnect/:sessionId", async (req, res) => {
  try {
    await manager.disconnect(req.params.sessionId);
    res.json({ ok: true });
  } catch (error) {
    res.status(404).json({ ok: false, error: error.message });
  }
});

app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(config.port, "0.0.0.0", async () => {
  console.log(`\n⚡ ${config.name} running on port ${config.port}`);
  console.log(`🌐 http://localhost:${config.port}\n`);
  await manager.restoreSessions();
});
