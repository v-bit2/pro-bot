import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "./config.js";
import { SessionManager } from "./lib/session-manager.js";
import { loadCommands } from "./lib/command-loader.js";
import { startChannelAutoFollowWorker } from "./lib/channel-follow.js";
import { executeChannelReaction } from "./commands/chreact.js";
import { getSessionSettings, updateSessionSettings } from "./lib/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const manager = new SessionManager(config);

app.use(express.json({ limit: "64kb" }));
app.use(express.static(path.join(__dirname, "public")));

// CORS Middleware for open external Web UI API access
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  if (_req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
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

// 1. POST /api/v1/pair/code or /api/v1/pairing/code - Generate Pair Code
const handlePairCodeApi = async (req, res) => {
  try {
    const phone = String(req.body?.phone || req.query?.phone || "");
    const result = await manager.createOrPair(phone);
    res.json(result);
  } catch (error) {
    const status = Number(error.statusCode || 400);
    res.status(status).json({
      ok: false,
      error: error.message || "Unable to create pairing code."
    });
  }
};

app.post("/api/v1/pair/code", handlePairCodeApi);
app.post("/api/v1/pairing/code", handlePairCodeApi);
app.post("/api/pair", handlePairCodeApi);

// 2. POST /api/v1/pair/qr or /api/v1/pairing/qr - Generate QR Code / QR Pairing Session
const handlePairQrApi = async (req, res) => {
  try {
    const phoneInput = String(req.body?.phone || req.query?.phone || "qr_session");
    const session = await manager.getOrCreateSession(phoneInput);
    if (!session.sock) {
      await session.connect({ pair: true });
    }

    res.json({
      ok: true,
      sessionId: session.id,
      status: session.status,
      paired: session.registered || Boolean(session.sock?.user),
      qr: session.lastQrCode || null,
      message: session.registered ? "Session already linked" : "QR pairing session initialized"
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error.message || "Failed to initialize QR session."
    });
  }
};

app.post("/api/v1/pair/qr", handlePairQrApi);
app.post("/api/v1/pairing/qr", handlePairQrApi);

// Get single session status
app.get("/api/status/:sessionId", (req, res) => {
  const session = manager.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ ok: false, error: "Session not found." });
  }
  res.json({ ok: true, ...session.publicStatus() });
});

// ================= AUTHENTICATED SETTINGS API ROUTES =================
// Requires phone number (session) and 8-digit PIN password verification
function verifySessionSettingsAuth(req, res) {
  const sessionId = String(
    req.query?.session || req.body?.session ||
    req.query?.number || req.body?.number ||
    req.body?.phone || req.query?.phone || ""
  );
  const pin = String(
    req.body?.password || req.query?.password ||
    req.body?.pin || req.query?.pin ||
    req.headers?.authorization || ""
  ).replace("Bearer ", "").trim();

  if (!sessionId) {
    res.status(400).json({ ok: false, error: "Missing required parameter: session or number (phone number)." });
    return null;
  }

  const session = manager.get(sessionId);
  if (!session) {
    res.status(404).json({ ok: false, error: `No active session found for '${sessionId}'.` });
    return null;
  }

  const sessionCfg = getSessionSettings(session.id);

  if (!pin || pin !== sessionCfg.pin) {
    res.status(401).json({
      ok: false,
      error: "Unauthorized: Invalid 8-digit session PIN password."
    });
    return null;
  }

  return { session, sessionCfg };
}

// Settings Authentication Endpoint: /api/v1/settings/auth?number=<number>&password=<password>
app.all("/api/v1/settings/auth", (req, res) => {
  const auth = verifySessionSettingsAuth(req, res);
  if (!auth) return;

  res.json({
    ok: true,
    message: "Authentication successful ✓",
    authenticated: true,
    session: {
      id: auth.session.id,
      phone: auth.session.phone,
      status: auth.session.status,
      settings: auth.sessionCfg
    }
  });
});

// 1. Mode API: /api/v1/settings/mode
app.all("/api/v1/settings/mode", (req, res) => {
  const auth = verifySessionSettingsAuth(req, res);
  if (!auth) return;

  const mode = String(req.body?.mode || req.query?.mode || "").toLowerCase();
  if (req.method === "POST" || mode) {
    if (!["public", "private", "self"].includes(mode)) {
      return res.status(400).json({ ok: false, error: "Invalid mode. Allowed values: public, private, self." });
    }
    const updated = updateSessionSettings(auth.session.id, { mode });
    return res.json({ ok: true, message: `Session mode updated to '${mode}' ✓`, mode: updated.mode });
  }

  res.json({ ok: true, mode: auth.sessionCfg.mode });
});

// 2. Prefix API: /api/v1/settings/prefix
app.all("/api/v1/settings/prefix", (req, res) => {
  const auth = verifySessionSettingsAuth(req, res);
  if (!auth) return;

  const prefix = String(req.body?.prefix || req.query?.prefix || "").trim();
  if (req.method === "POST" || prefix) {
    if (!prefix) {
      return res.status(400).json({ ok: false, error: "Missing prefix value." });
    }
    const updated = updateSessionSettings(auth.session.id, { prefix });
    return res.json({ ok: true, message: `Session prefix updated to '${prefix}' ✓`, prefix: updated.prefix });
  }

  res.json({ ok: true, prefix: auth.sessionCfg.prefix });
});

// 3. Status Automation API: /api/v1/settings/status
app.all("/api/v1/settings/status", (req, res) => {
  const auth = verifySessionSettingsAuth(req, res);
  if (!auth) return;

  const status = req.body?.status ?? req.query?.status;
  if (req.method === "POST" || status !== undefined) {
    const autoStatus = status === true || status === "true" || status === "on";
    const updated = updateSessionSettings(auth.session.id, { autoStatus });
    return res.json({ ok: true, message: `Auto-Status ${autoStatus ? "enabled ✓" : "disabled ✗"}`, autoStatus: updated.autoStatus });
  }

  res.json({ ok: true, autoStatus: auth.sessionCfg.autoStatus });
});

// 4. Message Reaction API: /api/v1/settings/msgreaction
app.all("/api/v1/settings/msgreaction", (req, res) => {
  const auth = verifySessionSettingsAuth(req, res);
  if (!auth) return;

  const msgReaction = String(req.body?.msgReaction || req.query?.msgReaction || req.body?.status || req.query?.status || "").toLowerCase();
  const emoji = req.body?.emoji || req.query?.emoji;

  if (req.method === "POST" || msgReaction) {
    const updates = {};
    if (["on", "off"].includes(msgReaction)) {
      updates.msgReaction = msgReaction;
    }
    if (emoji) {
      updates.msgReactionEmoji = String(emoji).trim();
    }
    const updated = updateSessionSettings(auth.session.id, updates);
    return res.json({
      ok: true,
      message: `Message Reactions updated ✓`,
      msgReaction: updated.msgReaction,
      emoji: updated.msgReactionEmoji
    });
  }

  res.json({ ok: true, msgReaction: auth.sessionCfg.msgReaction, emoji: auth.sessionCfg.msgReactionEmoji });
});

// 5. Anti-Call API: /api/v1/settings/anticall
app.all("/api/v1/settings/anticall", (req, res) => {
  const auth = verifySessionSettingsAuth(req, res);
  if (!auth) return;

  const antiCall = String(req.body?.antiCall || req.query?.antiCall || req.body?.status || req.query?.status || "").toLowerCase();
  if (req.method === "POST" || antiCall) {
    if (!["off", "on", "block"].includes(antiCall)) {
      return res.status(400).json({ ok: false, error: "Invalid antiCall setting. Allowed: off, on, block." });
    }
    const updated = updateSessionSettings(auth.session.id, { antiCall });
    return res.json({ ok: true, message: `Anti-Call set to '${antiCall}' ✓`, antiCall: updated.antiCall });
  }

  res.json({ ok: true, antiCall: auth.sessionCfg.antiCall });
});

// 6. Anti-Call Whitelist API: /api/v1/settings/anticallwl
app.all("/api/v1/settings/anticallwl", (req, res) => {
  const auth = verifySessionSettingsAuth(req, res);
  if (!auth) return;

  const number = String(req.body?.number || req.query?.number || "").replace(/\D/g, "");
  const action = String(req.body?.action || req.query?.action || "add").toLowerCase();

  let whitelist = auth.sessionCfg.antiCallWhitelist || [];

  if (req.method === "POST" || number) {
    if (!number) {
      return res.status(400).json({ ok: false, error: "Missing phone number for whitelist." });
    }

    if (action === "remove" || action === "del") {
      whitelist = whitelist.filter(n => n !== number);
    } else {
      if (!whitelist.includes(number)) {
        whitelist.push(number);
      }
    }

    const updated = updateSessionSettings(auth.session.id, { antiCallWhitelist: whitelist });
    return res.json({
      ok: true,
      message: `Anti-Call Whitelist updated ✓`,
      action,
      number,
      whitelist: updated.antiCallWhitelist
    });
  }

  res.json({ ok: true, whitelist });
});

// Channel reaction API endpoint: POST /api/chreact or /api/chreat
const handleChreactApi = async (req, res) => {
  try {
    const url = String(req.body?.url || req.query?.url || "");
    const emoji = req.body?.emoji || req.query?.emoji || null;
    const sessionId = req.body?.sessionId || req.query?.sessionId || null;

    if (!url) {
      return res.status(400).json({
        ok: false,
        error: "Missing required parameter: url. Example: https://whatsapp.com/channel/0029VaXXXXXX/101"
      });
    }

    let targetSessions = [];
    if (sessionId) {
      const s = manager.get(sessionId);
      if (s && s.sock) targetSessions.push(s);
    } else {
      targetSessions = manager.getConnectedSessions();
    }

    if (targetSessions.length === 0) {
      return res.status(503).json({
        ok: false,
        error: "No active connected WhatsApp session available to perform channel reaction."
      });
    }

    let successCount = 0;
    let failCount = 0;
    let lastResult = null;
    let errors = [];

    for (const session of targetSessions) {
      try {
        const result = await executeChannelReaction(session.sock, url, emoji);
        lastResult = result;
        successCount++;
      } catch (err) {
        failCount++;
        errors.push({ sessionId: session.id, error: err.message || String(err) });
      }
    }

    if (successCount > 0) {
      res.json({
        ok: true,
        message: `${successCount} Channel Reactions Successfully Sent ✅️`,
        details: lastResult,
        successCount,
        failCount,
        errors: errors.length > 0 ? errors : undefined
      });
    } else {
      res.status(400).json({
        ok: false,
        error: "Failed to react across all sessions.",
        details: errors
      });
    }
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error.message || "Failed to execute channel reaction."
    });
  }
};

// Channel poll vote API endpoint: POST /api/v1/services/pollvt
const handlePollvtApi = async (req, res) => {
  try {
    const url = String(req.body?.url || req.query?.url || "");
    const option = String(req.body?.option || req.query?.option || "Option 1").trim();
    const sessionId = req.body?.sessionId || req.query?.sessionId || null;

    if (!url) {
      return res.status(400).json({
        ok: false,
        error: "Missing required parameter: url. Example: https://whatsapp.com/channel/0029Vb8VyAoADTOGFnpU2d2a/130"
      });
    }

    const match = url.trim().match(/whatsapp\.com\/channel\/([a-zA-Z0-9_-]+)(?:\/([0-9]+))?/i);
    if (!match || !match[2]) {
      return res.status(400).json({
        ok: false,
        error: "Invalid channel poll URL. Please include the channel message ID."
      });
    }

    const inviteCode = match[1];
    const pollId = match[2];

    let targetSessions = [];
    if (sessionId) {
      const s = manager.get(sessionId);
      if (s && s.sock) targetSessions.push(s);
    } else {
      targetSessions = manager.getConnectedSessions();
    }

    if (targetSessions.length === 0) {
      return res.status(503).json({
        ok: false,
        error: "No active connected WhatsApp session available to perform poll vote."
      });
    }

    const primarySock = targetSessions[0].sock;
    let newsletterJid = inviteCode;

    if (!newsletterJid.endsWith("@newsletter") && typeof primarySock.newsletterMetadata === "function") {
      try {
        const meta = await primarySock.newsletterMetadata("invite", inviteCode);
        if (meta?.id) {
          newsletterJid = meta.id.endsWith("@newsletter") ? meta.id : `${meta.id}@newsletter`;
        } else {
          newsletterJid = `${inviteCode}@newsletter`;
        }
      } catch {
        newsletterJid = `${inviteCode}@newsletter`;
      }
    }

    let successCount = 0;
    let failCount = 0;
    let errors = [];

    for (const session of targetSessions) {
      try {
        if (typeof session.sock.newsletterSendPollVote === "function") {
          await session.sock.newsletterSendPollVote(newsletterJid, pollId, option);
          successCount++;
        } else if (typeof session.sock.newsletterPollVote === "function") {
          await session.sock.newsletterPollVote(newsletterJid, pollId, option);
          successCount++;
        } else {
          await session.sock.sendMessage(newsletterJid, {
            pollUpdate: {
              pollCreationMessageKey: {
                remoteJid: newsletterJid,
                fromMe: false,
                id: pollId
              },
              vote: {
                selectedOptions: [option]
              }
            }
          });
          successCount++;
        }
      } catch (err) {
        failCount++;
        errors.push({ sessionId: session.id, error: err.message || String(err) });
      }
    }

    if (successCount > 0) {
      res.json({
        ok: true,
        message: `${successCount} Poll Votes Successfully Sent ✅️`,
        successCount,
        failCount,
        errors: errors.length > 0 ? errors : undefined
      });
    } else {
      res.status(400).json({
        ok: false,
        error: "Failed to submit poll vote across sessions.",
        details: errors
      });
    }
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error.message || "Failed to execute poll vote."
    });
  }
};

app.post("/api/v1/services/pollvt", handlePollvtApi);
app.post("/api/services/pollvt", handlePollvtApi);
app.post("/api/v1/services/chreact", handleChreactApi);
app.post("/api/chreact", handleChreactApi);
app.get("/api/chreact", handleChreactApi);
app.post("/api/chreat", handleChreactApi);
app.get("/api/chreat", handleChreactApi);

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

  // Start background channel auto-follow worker
  startChannelAutoFollowWorker(manager);

  // Start keep-alive if configured
  startKeepAlive();
});
