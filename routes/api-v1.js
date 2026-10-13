import { Router } from "express";
import { verifyFirebaseToken } from "../lib/firebase-admin.js";
import {
  createBotRecord,
  getBotsByOwner,
  getBotById,
  updateBotRecord,
  verifyBotOwnership
} from "../lib/bot-store.js";
import {
  createServiceJob,
  getJobById,
  verifyJobOwnership,
  executeServiceJob,
  SUPPORTED_SERVICES
} from "../lib/service-jobs.js";
import { updatePerSessionSettings } from "../lib/db.js";
import config from "../config.js";

// Rate limit helper for sensitive endpoints
const requestTimestamps = new Map();

function createRateLimiter(windowMs = 60000, maxRequests = 10) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const timestamps = requestTimestamps.get(key) || [];
    const validTimestamps = timestamps.filter(t => now - t < windowMs);

    if (validTimestamps.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests. Please try again later."
        }
      });
    }

    validTimestamps.push(now);
    requestTimestamps.set(key, validTimestamps);
    next();
  };
}

const pairRateLimiter = createRateLimiter(60000, 5);
const actionRateLimiter = createRateLimiter(60000, 10);
const jobRateLimiter = createRateLimiter(60000, 20);

export function createApiV1Router(sessionManager) {
  const router = Router();

  function sendSuccess(res, data, statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      data
    });
  }

  function sendError(res, message, code = "BAD_REQUEST", statusCode = 400) {
    return res.status(statusCode).json({
      success: false,
      error: {
        code,
        message
      }
    });
  }

  // 1. Health Endpoint (Public)
  router.get("/health", (_req, res) => {
    sendSuccess(res, {
      name: config.name,
      uptime: Math.floor(process.uptime()),
      activeSessions: sessionManager.count()
    });
  });

  // 2. List Authenticated User's Bots (Firebase Auth)
  router.get("/bots", verifyFirebaseToken, async (req, res) => {
    try {
      const userBots = await getBotsByOwner(req.user.uid);
      const safeBots = userBots.map(b => ({
        botId: b.botId,
        name: b.name,
        phone: b.phone,
        status: sessionManager.get(b.phone || b.botId)?.status || b.status || "idle",
        createdAt: b.createdAt
      }));

      sendSuccess(res, {
        count: safeBots.length,
        bots: safeBots
      });
    } catch (error) {
      sendError(res, error.message || "Failed to fetch bots.", "SERVER_ERROR", 500);
    }
  });

  // 3. Create a Bot Record (Firebase Auth)
  router.post("/bots", verifyFirebaseToken, async (req, res) => {
    try {
      const name = String(req.body?.name || "My Voltra Bot").trim();
      const phone = req.body?.phone ? String(req.body.phone).replace(/\D/g, "") : "";

      if (name.length > 50) {
        return sendError(res, "Bot name must be 50 characters or less.", "INVALID_INPUT", 400);
      }

      const botRecord = await createBotRecord({
        ownerUid: req.user.uid,
        name,
        phone
      });

      sendSuccess(res, {
        botId: botRecord.botId,
        name: botRecord.name,
        phone: botRecord.phone,
        status: botRecord.status,
        createdAt: botRecord.createdAt
      }, 201);
    } catch (error) {
      const statusCode = Number(error.statusCode || 400);
      sendError(res, error.message || "Unable to create bot.", error.code || "BAD_REQUEST", statusCode);
    }
  });

  // 4. Retrieve Bot Details & Connection Status (Firebase Auth + Ownership)
  router.get("/bots/:id", verifyFirebaseToken, async (req, res) => {
    try {
      const bot = await verifyBotOwnership(req.params.id, req.user.uid);
      const session = sessionManager.get(bot.phone || bot.botId);

      sendSuccess(res, {
        botId: bot.botId,
        name: bot.name,
        phone: bot.phone,
        status: session?.status || bot.status || "idle",
        paired: Boolean(session?.registered || session?.sock?.user),
        settings: bot.settings,
        createdAt: bot.createdAt,
        updatedAt: bot.updatedAt
      });
    } catch (error) {
      const statusCode = Number(error.statusCode || 404);
      sendError(res, error.message || "Bot not found.", error.code || "BOT_NOT_FOUND", statusCode);
    }
  });

  // 5. WhatsApp Pairing Request (Firebase Auth + Ownership + Phone Normalization + Rate Limit)
  router.post("/bots/:id/pair", verifyFirebaseToken, pairRateLimiter, async (req, res) => {
    try {
      const bot = await verifyBotOwnership(req.params.id, req.user.uid);
      const rawPhone = String(req.body?.phone || bot.phone || "");

      if (!rawPhone) {
        return sendError(res, "A valid WhatsApp phone number is required for pairing.", "INVALID_PHONE", 400);
      }

      const normalizedPhone = sessionManager.normalizePhone(rawPhone);

      const existingSession = sessionManager.get(normalizedPhone);
      if (existingSession && (existingSession.status === "open" || existingSession.sock?.user)) {
        return sendError(res, "This WhatsApp account is already active and connected.", "SESSION_ALREADY_ACTIVE", 409);
      }

      await updateBotRecord(bot.botId, { phone: normalizedPhone, status: "pairing" });

      const pairResult = await sessionManager.createOrPair(normalizedPhone);

      sendSuccess(res, {
        botId: bot.botId,
        phone: normalizedPhone,
        code: pairResult.code,
        status: pairResult.status || "pairing"
      });
    } catch (error) {
      const statusCode = Number(error.statusCode || 400);
      sendError(res, error.message || "Failed to generate pairing code.", error.code || "PAIRING_ERROR", statusCode);
    }
  });

  // 6. Bot Actions: reconnect, disconnect, restart (Firebase Auth + Ownership + Action Allowlist)
  router.post("/bots/:id/actions", verifyFirebaseToken, actionRateLimiter, async (req, res) => {
    try {
      const bot = await verifyBotOwnership(req.params.id, req.user.uid);
      const action = String(req.body?.action || "").toLowerCase().trim();

      const allowlistedActions = ["reconnect", "disconnect", "restart"];
      if (!allowlistedActions.includes(action)) {
        return sendError(res, `Invalid action '${action}'. Allowed actions: ${allowlistedActions.join(", ")}.`, "INVALID_ACTION", 400);
      }

      const sessionKey = bot.phone || bot.botId;

      if (action === "disconnect") {
        if (sessionKey) {
          try {
            await sessionManager.disconnect(sessionKey);
          } catch {}
        }
        await updateBotRecord(bot.botId, { status: "logged_out" });
        return sendSuccess(res, {
          botId: bot.botId,
          action: "disconnect",
          status: "logged_out",
          message: "Bot disconnected successfully."
        });
      }

      if (action === "reconnect" || action === "restart") {
        if (!bot.phone) {
          return sendError(res, "Cannot reconnect a bot that has not been paired with a phone number.", "UNPAIRED_BOT", 400);
        }

        let session = sessionManager.get(bot.phone);
        if (session) {
          if (action === "restart") {
            try {
              await sessionManager.disconnect(bot.phone);
            } catch {}
          }
        }

        session = await sessionManager.createOrPair(bot.phone);
        await updateBotRecord(bot.botId, { status: "connecting" });

        return sendSuccess(res, {
          botId: bot.botId,
          action,
          status: "connecting",
          message: `Bot ${action} initiated.`
        });
      }

    } catch (error) {
      const statusCode = Number(error.statusCode || 400);
      sendError(res, error.message || "Failed to execute bot action.", error.code || "ACTION_FAILED", statusCode);
    }
  });

  // 7. Get Bot Settings (Firebase Auth + Ownership)
  router.get("/bots/:id/settings", verifyFirebaseToken, async (req, res) => {
    try {
      const bot = await verifyBotOwnership(req.params.id, req.user.uid);
      sendSuccess(res, {
        botId: bot.botId,
        settings: bot.settings || {}
      });
    } catch (error) {
      const statusCode = Number(error.statusCode || 404);
      sendError(res, error.message || "Bot not found.", error.code || "BOT_NOT_FOUND", statusCode);
    }
  });

  // 8. Update Bot Settings (Firebase Auth + Ownership + Key Validation)
  router.patch("/bots/:id/settings", verifyFirebaseToken, async (req, res) => {
    try {
      const bot = await verifyBotOwnership(req.params.id, req.user.uid);
      const updates = req.body || {};

      const allowedKeys = ["antiCall", "antiDelete", "mode", "autoReact"];
      const forbiddenKeys = Object.keys(updates).filter(k => !allowedKeys.includes(k));

      if (forbiddenKeys.length > 0) {
        return sendError(
          res,
          `Invalid setting key(s): ${forbiddenKeys.join(", ")}. Allowed setting keys: ${allowedKeys.join(", ")}.`,
          "INVALID_SETTINGS_KEY",
          400
        );
      }

      if (typeof updates.antiCall !== "undefined" && !["off", "on", "block"].includes(updates.antiCall)) {
        return sendError(res, "antiCall setting must be 'off', 'on', or 'block'.", "INVALID_SETTING_VALUE", 400);
      }

      if (typeof updates.mode !== "undefined" && !["public", "self", "private"].includes(updates.mode)) {
        return sendError(res, "mode setting must be 'public', 'self', or 'private'.", "INVALID_SETTING_VALUE", 400);
      }

      const newSettings = {
        ...(bot.settings || {}),
        ...updates
      };

      const updatedBot = await updateBotRecord(bot.botId, { settings: newSettings });

      if (bot.phone) {
        updatePerSessionSettings(bot.phone, newSettings);
      }

      sendSuccess(res, {
        botId: updatedBot.botId,
        settings: updatedBot.settings
      });
    } catch (error) {
      const statusCode = Number(error.statusCode || 400);
      sendError(res, error.message || "Failed to update settings.", error.code || "BAD_REQUEST", statusCode);
    }
  });

  // 9. Digital Services Discovery Endpoint (Firebase Auth)
  router.get("/services", verifyFirebaseToken, (_req, res) => {
    sendSuccess(res, {
      services: [
        {
          id: "channel-reaction",
          name: "Channel Auto-Reactions",
          description: "React to a specific WhatsApp channel post using your connected bot session.",
          status: "active",
          capabilities: ["auto-react", "channel-post-reactions"],
          inputs: {
            botId: "string (required)",
            newsletterJid: "string (required - e.g. 120363428077325156@newsletter)",
            serverId: "string/number (required)",
            emoji: "string (optional - e.g. ❤️)"
          }
        },
        {
          id: "poll-dispatcher",
          name: "Poll Dispatcher",
          description: "Dispatches interactive WhatsApp polls to chats and groups via connected bot sessions.",
          status: "active",
          capabilities: ["single-choice-polls", "multi-option-polls"],
          inputs: {
            botId: "string (required)",
            targetJid: "string (required)",
            question: "string (required)",
            options: "array of strings (required - 2 to 12 options)",
            selectableCount: "number (optional - default 1)"
          }
        }
      ]
    });
  });

  // 10. Submit Service Job (Firebase Auth + Ownership + Job Validation)
  router.post("/services/:service/jobs", verifyFirebaseToken, jobRateLimiter, async (req, res) => {
    try {
      const { service } = req.params;
      const { botId, ...payload } = req.body || {};

      if (!botId) {
        return sendError(res, "botId is required to submit a service job.", "MISSING_BOT_ID", 400);
      }

      // Verify server-side ownership of target botId
      await verifyBotOwnership(botId, req.user.uid);

      // Create service job record
      const job = await createServiceJob({
        ownerUid: req.user.uid,
        botId,
        service,
        payload
      });

      // Execute job in background/inline using active session manager
      executeServiceJob(job.jobId, sessionManager).catch(err => {
        console.error(`[ServiceJob] Background execution error for ${job.jobId}:`, err.message);
      });

      sendSuccess(res, {
        jobId: job.jobId,
        botId: job.botId,
        service: job.service,
        status: "queued",
        createdAt: job.createdAt
      }, 202);

    } catch (error) {
      const statusCode = Number(error.statusCode || 400);
      sendError(res, error.message || "Failed to submit service job.", error.code || "JOB_SUBMISSION_FAILED", statusCode);
    }
  });

  // 11. Retrieve Service Job Status & Results (Firebase Auth + Job Ownership)
  router.get("/services/jobs/:jobId", verifyFirebaseToken, async (req, res) => {
    try {
      const job = await verifyJobOwnership(req.params.jobId, req.user.uid);

      sendSuccess(res, {
        jobId: job.jobId,
        botId: job.botId,
        service: job.service,
        status: job.status,
        result: job.result,
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      });
    } catch (error) {
      const statusCode = Number(error.statusCode || 404);
      sendError(res, error.message || "Job not found.", error.code || "JOB_NOT_FOUND", statusCode);
    }
  });

  return router;
}
