import { Router } from "express";
import crypto from "node:crypto";
import {
  reserveBotSlot,
  releaseBotSlot,
  createBotRecord,
  getBotById
} from "../lib/bot-store.js";
import {
  generateManagementToken,
  generateSalt,
  hashManagementToken,
  createRequireBotAuth
} from "../lib/management-auth.js";
import { createRateLimiter } from "../lib/rate-limiter.js";

export function createApiV1Router({ config, manager }) {
  const router = Router();
  const requireBotAuth = createRequireBotAuth(config);

  // Rate limiters for create bot, pairing and status routes
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

      // 4. Reserve slot enforcing atomic 3-bot limit
      await reserveBotSlot(config.mongoUri, normalizedPhone, 3);
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
      // Only release slot reservation if it was successfully reserved before an unexpected error occurred
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
   * POST /api/v1/bots/:botId/pair
   * Protected endpoint to initiate pairing for a bot using code or QR.
   */
  router.post("/bots/:botId/pair", pairRateLimit, requireBotAuth, async (req, res) => {
    try {
      const bot = req.bot;
      const requestedPhone = req.body?.phoneNumber ? manager.normalizePhone(req.body.phoneNumber) : null;

      // Verify phone number ownership match if explicitly provided
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

      // Initiate Baileys pairing via session manager
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

  return router;
}
