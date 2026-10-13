import crypto from "node:crypto";
import { getBotById } from "./bot-store.js";

/**
 * Generates a 256-bit cryptographically secure random management token.
 */
export function generateManagementToken() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Generates a random salt for management token hashing.
 */
export function generateSalt() {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Computes SHA-256 hash of management token with salt.
 */
export function hashManagementToken(token, salt) {
  return crypto
    .createHash("sha256")
    .update(`${salt}:${token}`)
    .digest("hex");
}

/**
 * Safely verifies a candidate management token against stored hash using timing-safe comparison.
 */
export function verifyManagementToken(candidateToken, salt, storedHash) {
  if (!candidateToken || !salt || !storedHash) return false;

  try {
    const candidateHash = hashManagementToken(candidateToken, salt);
    const candidateBuf = Buffer.from(candidateHash, "hex");
    const storedBuf = Buffer.from(storedHash, "hex");

    if (candidateBuf.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(candidateBuf, storedBuf);
  } catch {
    return false;
  }
}

/**
 * Express middleware to authenticate bot management requests via Bearer token.
 */
export function createRequireBotAuth(config) {
  return async function requireBotAuth(req, res, next) {
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
      const botId = req.params.botId || req.body?.botId;

      if (!botId) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_INPUT",
            message: "Target bot ID is required."
          }
        });
      }

      const bot = await getBotById(config.mongoUri, botId);

      if (!bot) {
        // Prevent enumeration or leakage of non-existent vs unauthorized
        return res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Bot not found or invalid management token."
          }
        });
      }

      const isValid = verifyManagementToken(token, bot.managementTokenSalt, bot.managementTokenHash);

      if (!isValid) {
        return res.status(401).json({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid management token."
          }
        });
      }

      req.bot = bot;
      next();
    } catch (err) {
      console.error("[Auth] Error in requireBotAuth:", err.message);
      return res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Internal security authentication failure."
        }
      });
    }
  };
}
