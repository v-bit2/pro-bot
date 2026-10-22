import { Router } from "express";
import crypto from "node:crypto";
import {
  reserveBotSlot,
  releaseBotSlot,
  createBotRecord,
  getBotById,
  getBotsByOwnerPhone,
  getBotSettings,
  updateBotSettings,
  ALLOWED_SETTING_KEYS
} from "../lib/bot-store.js";
import {
  generateManagementToken,
  generateSalt,
  hashManagementToken,
  verifyManagementToken,
  createRequireBotAuth
} from "../lib/management-auth.js";
import { createRateLimiter } from "../lib/rate-limiter.js";

export function createApiV1Router({ config, manager }) {
  const router = Router();
  const requireBotAuth = createRequireBotAuth(config);

  // Rate limiters for creation, pairing, status, settings, actions, and deletion
  const createRateLimit = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 mins
    max: 15,
    message: "Too many bot creation requests from this IP. Please try again later."
  });

  const pairRateLimit = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 mins
    max: 30,
    message: "Too many pairing requests from this IP. Please try again later."
  });

  const statusRateLimit = createRateLimiter({
    windowMs: 60 * 1000, // 1 min
    max: 60,
    message: "Too many status requests. Please try again in a minute."
  });

  const settingsRateLimit = createRateLimiter({
    windowMs: 60 * 1000, // 1 min
    max: 60,
    message: "Too many settings requests. Please try again in a minute."
  });

  const actionsRateLimit = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 mins
    max: 30,
    message: "Too many action requests. Please try again in a minute."
  });

  /**
   * GET /api/v1/health
   * Public service health endpoint.
   */
  router.get("/health", (_req, res) => {
    return res.json({
      success: true,
      status: "ok",
      timestamp: new Date().toISOString()
    });
  });

  /**
   * POST /api/v1/bots
   * Creates a new bot record and returns a one-time management token.
   * Supports unlimited bots per WhatsApp owner.
   */
  router.post("/bots", createRateLimit, async (req, res) => {
    let normalizedPhone = null;
    let reservedSlot = false;

    try {
      const { name, phoneNumber, pairingMethod = "code" } = req.body || {};

      // 1. Validate 'name'
      const trimmedName = typeof name === "string" ? name.trim() : "";
      if (!trimmedName || trimmedName.length < 1 || trimmedName.length > 50) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_INPUT",
            message: "Bot name is required and must be between 1 and 50 characters."
          }
        });
      }

      // 2. Validate 'pairingMethod'
      if (pairingMethod !== "code" && pairingMethod !== "qr") {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_INPUT",
            message: "Invalid pairingMethod. Supported options are 'code' or 'qr'."
          }
        });
      }

      // 3. Normalize & validate 'phoneNumber'
      try {
        normalizedPhone = manager.normalizePhone(phoneNumber);
      } catch {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_INPUT",
            message: "Enter a valid international phone number, e.g. 263786624966."
          }
        });
      }

      // 4. Reserve slot (unlimited bots per owner)
      await reserveBotSlot(config.mongoUri, normalizedPhone);
      reservedSlot = true;

      // 5. Generate bot identity and cryptographic management credentials
      const botId = `bot_${crypto.randomBytes(12).toString("hex")}`;
      const sessionId = botId;
      const managementToken = generateManagementToken();
      const managementTokenSalt = generateSalt();
      const managementTokenHash = hashManagementToken(managementToken, managementTokenSalt);

      // 6. Create database bot record
      const record = await createBotRecord(config.mongoUri, {
        botId,
        name: trimmedName,
        phoneNumber: normalizedPhone,
        managementTokenHash,
        managementTokenSalt,
        sessionId,
        pairingMethod,
        status: "created"
      });

      // 7. Return 201 Created with plaintext token
      return res.status(201).json({
        success: true,
        data: {
          botId: record.botId,
          name: record.name,
          phoneNumber: record.phoneNumber,
          status: record.status,
          managementToken,
          pairingMethod: record.pairingMethod,
          createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : new Date(record.createdAt).toISOString()
        },
        message: "Bot created successfully. Save your management token securely. It will not be shown again."
      });
    } catch (err) {
      if (reservedSlot && normalizedPhone) {
        await releaseBotSlot(config.mongoUri, normalizedPhone).catch(() => {});
      }

      const statusCode = Number(err.statusCode || 500);
      const errorCode = err.code || "INTERNAL_ERROR";

      return res.status(statusCode).json({
        success: false,
        error: {
          code: errorCode,
          message: err.message || "Failed to create bot."
        }
      });
    }
  });

  /**
   * GET /api/v1/bots
   * Returns all bots belonging to the authenticated owner.
   * Requires Authorization: Bearer <managementToken>
   */
  router.get("/bots", statusRateLimit, async (req, res) => {
    try {
      const authHeader = req.headers.authorization || req.headers.Authorization;

      if (!authHeader || typeof authHeader !== "string") {
        return res.status(401).json({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authorization header with Bearer management token is required."
          }
        });
      }

      const parts = authHeader.trim().split(" ");
      if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
        return res.status(401).json({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid Authorization format. Use 'Bearer <managementToken>'."
          }
        });
      }

      const token = parts[1];
      const botIdHint = req.query.botId || req.headers["x-bot-id"];

      let ownerPhone = null;

      // If botId hint is provided, verify directly
      if (botIdHint) {
        const bot = await getBotById(config.mongoUri, String(botIdHint));
        if (bot && verifyManagementToken(token, bot.managementTokenSalt, bot.managementTokenHash)) {
          ownerPhone = bot.phoneNumber;
        }
      }

      // Fallback: If no hint or hint didn't match, verify token against provided phoneNumber query or search owner
      if (!ownerPhone && req.query.phoneNumber) {
        try {
          const normPhone = manager.normalizePhone(req.query.phoneNumber);
          const ownerBots = await getBotsByOwnerPhone(config.mongoUri, normPhone);
          const authorizedBot = ownerBots.find(b => verifyManagementToken(token, b.managementTokenSalt, b.managementTokenHash));
          if (authorizedBot) {
            ownerPhone = authorizedBot.phoneNumber;
          }
        } catch {}
      }

      if (!ownerPhone) {
        return res.status(401).json({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid management token or owner authorization."
          }
        });
      }

      const rawBots = await getBotsByOwnerPhone(config.mongoUri, ownerPhone);

      const bots = rawBots.map(b => {
        const session = manager.get(b.sessionId);
        const live = session ? session.publicStatus() : null;
        return {
          botId: b.botId,
          name: b.name,
          phoneNumber: b.phoneNumber,
          status: live?.status || b.status,
          pairingMethod: b.pairingMethod,
          lastConnectedAt: b.lastConnectedAt ? new Date(b.lastConnectedAt).toISOString() : null,
          createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : null,
          updatedAt: b.updatedAt ? new Date(b.updatedAt).toISOString() : null
        };
      });

      return res.json({
        success: true,
        data: bots
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: err.message || "Unable to list bots."
        }
      });
    }
  });

  /**
   * GET /api/v1/bots/:botId
   * Returns details for a specific bot belonging to the owner.
   */
  router.get("/bots/:botId", statusRateLimit, requireBotAuth, async (req, res) => {
    try {
      const bot = req.bot;
      const session = manager.get(bot.sessionId);
      const live = session ? session.publicStatus() : null;
      const settings = await getBotSettings(config.mongoUri, bot.botId);

      return res.json({
        success: true,
        data: {
          botId: bot.botId,
          name: bot.name,
          phoneNumber: bot.phoneNumber,
          status: live?.status || bot.status,
          pairingMethod: bot.pairingMethod,
          settings,
          lastConnectedAt: bot.lastConnectedAt ? new Date(bot.lastConnectedAt).toISOString() : null,
          lastErrorCode: live?.lastErrorCode || bot.lastErrorCode || null,
          createdAt: bot.createdAt ? new Date(bot.createdAt).toISOString() : null,
          updatedAt: bot.updatedAt ? new Date(bot.updatedAt).toISOString() : null
        }
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: err.message || "Failed to retrieve bot details."
        }
      });
    }
  });

  /**
   * GET /api/v1/bots/:botId/settings
   * Returns current settings for the bot.
   */
  router.get("/bots/:botId/settings", settingsRateLimit, requireBotAuth, async (req, res) => {
    try {
      const bot = req.bot;
      const settings = await getBotSettings(config.mongoUri, bot.botId);

      return res.json({
        success: true,
        data: {
          botId: bot.botId,
          settings,
          supportedOptions: Array.from(ALLOWED_SETTING_KEYS)
        }
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: err.message || "Failed to retrieve bot settings."
        }
      });
    }
  });

  /**
   * PATCH /api/v1/bots/:botId/settings
   * Updates supported configurable settings for the bot.
   */
  router.patch("/bots/:botId/settings", settingsRateLimit, requireBotAuth, async (req, res) => {
    try {
      const bot = req.bot;
      const updates = req.body || {};

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Request body must contain at least one setting to update."
          }
        });
      }

      const updatedSettings = await updateBotSettings(config.mongoUri, bot.botId, updates);

      return res.json({
        success: true,
        data: {
          botId: bot.botId,
          settings: updatedSettings
        },
        message: "Bot settings updated successfully."
      });
    } catch (err) {
      const statusCode = Number(err.statusCode || 500);
      const errorCode = err.code || "INTERNAL_ERROR";

      return res.status(statusCode).json({
        success: false,
        error: {
          code: errorCode,
          message: err.message || "Failed to update bot settings."
        }
      });
    }
  });

  /**
   * POST /api/v1/bots/:botId/pair
   * Protected endpoint to initiate pairing for a bot using code or QR.
   */
  router.post("/bots/:botId/pair", pairRateLimit, requireBotAuth, async (req, res) => {
    try {
      const bot = req.bot;
      const requestedPhone = req.body?.phoneNumber ? manager.normalizePhone(req.body.phoneNumber) : null;

      if (requestedPhone && requestedPhone !== bot.phoneNumber) {
        return res.status(403).json({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Phone number does not match the registered bot phone number."
          }
        });
      }

      const method = req.body?.method || bot.pairingMethod || "code";

      if (method !== "code" && method !== "qr") {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_INPUT",
            message: "Invalid pairing method. Supported values are 'code' or 'qr'."
          }
        });
      }

      const pairResult = await manager.pairBot({
        botId: bot.botId,
        sessionId: bot.sessionId,
        phoneNumber: bot.phoneNumber,
        method
      });

      return res.json({
        success: true,
        data: {
          botId: bot.botId,
          phoneNumber: bot.phoneNumber,
          status: pairResult.status || "awaiting_pairing",
          pairingMethod: method,
          pairingCode: pairResult.pairingCode || null,
          qrCode: pairResult.qrCode || null
        },
        message: "Pairing process initialized successfully."
      });
    } catch (err) {
      const statusCode = Number(err.statusCode || 500);
      const errorCode = err.code || "INTERNAL_ERROR";

      return res.status(statusCode).json({
        success: false,
        error: {
          code: errorCode,
          message: err.message || "Failed to start WhatsApp pairing."
        }
      });
    }
  });

  /**
   * POST /api/v1/bots/:botId/actions
   * Dispatches connection actions (reconnect, disconnect, refresh).
   */
  router.post("/bots/:botId/actions", actionsRateLimit, requireBotAuth, async (req, res) => {
    try {
      const bot = req.bot;
      const { action } = req.body || {};

      if (!action || typeof action !== "string") {
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Request body must contain 'action' string ('reconnect', 'disconnect', or 'refresh')."
          }
        });
      }

      const result = await manager.performBotAction({
        botId: bot.botId,
        sessionId: bot.sessionId,
        phoneNumber: bot.phoneNumber,
        action
      });

      return res.json({
        success: true,
        data: result,
        message: "Bot action executed successfully."
      });
    } catch (err) {
      const statusCode = Number(err.statusCode || 500);
      const errorCode = err.code || "INTERNAL_ERROR";

      return res.status(statusCode).json({
        success: false,
        error: {
          code: errorCode,
          message: err.message || "Failed to execute bot action."
        }
      });
    }
  });

  /**
   * GET /api/v1/bots/:botId/status
   * Protected endpoint to retrieve lifecycle state and safe status.
   */
  router.get("/bots/:botId/status", statusRateLimit, requireBotAuth, async (req, res) => {
    try {
      const botId = req.params.botId;
      const bot = await getBotById(config.mongoUri, botId);

      if (!bot) {
        return res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Bot not found."
          }
        });
      }

      const activeSession = manager.get(bot.sessionId);
      const liveStatus = activeSession ? activeSession.publicStatus() : null;

      const currentStatus = liveStatus?.status || bot.status;
      const pairingCode = liveStatus?.pairingCode || null;
      const qrCode = liveStatus?.qrCode || null;
      const lastErrorCode = liveStatus?.lastErrorCode || bot.lastErrorCode || null;

      return res.json({
        success: true,
        data: {
          botId: bot.botId,
          name: bot.name,
          phoneNumber: bot.phoneNumber,
          status: currentStatus,
          pairingMethod: bot.pairingMethod,
          pairingCode,
          qrCode,
          lastConnectedAt: bot.lastConnectedAt ? new Date(bot.lastConnectedAt).toISOString() : null,
          lastErrorCode,
          createdAt: bot.createdAt ? new Date(bot.createdAt).toISOString() : null,
          updatedAt: bot.updatedAt ? new Date(bot.updatedAt).toISOString() : null
        }
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: err.message || "Unable to retrieve bot status."
        }
      });
    }
  });

  /**
   * DELETE /api/v1/bots/:botId
   * Permanently deletes a bot and closes its session.
   */
  router.delete("/bots/:botId", actionsRateLimit, requireBotAuth, async (req, res) => {
    try {
      const bot = req.bot;
      const { confirm, confirmBotId } = req.body || {};

      const isConfirmed = confirm === true || confirm === bot.botId || confirmBotId === bot.botId;

      if (!isConfirmed) {
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: `Explicit confirmation is required to permanently delete this bot. Include 'confirm: true' or 'confirmBotId: "${bot.botId}"' in the request body.`
          }
        });
      }

      await manager.deleteBotSession({ botId: bot.botId, sessionId: bot.sessionId });

      return res.json({
        success: true,
        message: "Bot and associated session data permanently deleted."
      });
    } catch (err) {
      const statusCode = Number(err.statusCode || 500);
      const errorCode = err.code || "INTERNAL_ERROR";

      return res.status(statusCode).json({
        success: false,
        error: {
          code: errorCode,
          message: err.message || "Failed to delete bot."
        }
      });
    }
  });

  return router;
}
