import { getMongoClient } from "./mongo-store.js";

// In-memory fallbacks when MongoDB is unavailable or for local testing
const inMemoryBots = new Map();
const inMemoryPhoneLimits = new Map();
const inMemoryBotSettings = new Map();

export const DEFAULT_BOT_SETTINGS = {
  prefix: ".",
  botName: "Voltra Mini",
  mode: "public", // 'public' | 'self' | 'private'
  autoRead: false,
  autoTyping: false,
  autoReact: false,
  antiCall: false,
  antiDelete: false,
  autoViewStatus: false,
  newsletterJid: ""
};

export const ALLOWED_SETTING_KEYS = new Set([
  "prefix",
  "botName",
  "name",
  "mode",
  "autoRead",
  "autoTyping",
  "autoReact",
  "antiCall",
  "antiDelete",
  "autoViewStatus",
  "newsletterJid"
]);

/**
 * Ensures required indexes exist on the 'bots' and 'phone_limits' collections.
 */
export async function initBotIndexes(mongoUri) {
  const database = await getMongoClient(mongoUri);
  if (!database) return;

  try {
    const bots = database.collection("bots");
    await bots.createIndex({ botId: 1 }, { unique: true });
    await bots.createIndex({ sessionId: 1 }, { unique: true });
    await bots.createIndex({ phoneNumber: 1 });

    const limits = database.collection("phone_limits");
    await limits.createIndex({ _id: 1 });
  } catch (err) {
    console.error("[BotStore] Index creation warning:", err.message);
  }
}

/**
 * Atomically reserves a slot for a phone number (supports unlimited bots per owner).
 */
export async function reserveBotSlot(mongoUri, phoneNumber) {
  if (!mongoUri || mongoUri.includes(":<db_password>@")) {
    const current = inMemoryPhoneLimits.get(phoneNumber) || 0;
    inMemoryPhoneLimits.set(phoneNumber, current + 1);
    return current + 1;
  }

  const database = await getMongoClient(mongoUri);

  if (database) {
    try {
      const limits = database.collection("phone_limits");

      await limits.updateOne(
        { _id: phoneNumber },
        { $setOnInsert: { count: 0 } },
        { upsert: true }
      );

      const result = await limits.findOneAndUpdate(
        { _id: phoneNumber },
        { $inc: { count: 1 } },
        { returnDocument: "after" }
      );

      return result?.count || 1;
    } catch (err) {
      console.error("[BotStore] Error in reserveBotSlot:", err.message);
    }
  }

  const current = inMemoryPhoneLimits.get(phoneNumber) || 0;
  inMemoryPhoneLimits.set(phoneNumber, current + 1);
  return current + 1;
}

/**
 * Decrements the reserved bot count for a phone number on failure or bot deletion.
 */
export async function releaseBotSlot(mongoUri, phoneNumber) {
  if (!mongoUri || mongoUri.includes(":<db_password>@")) {
    const current = inMemoryPhoneLimits.get(phoneNumber) || 0;
    if (current > 0) {
      inMemoryPhoneLimits.set(phoneNumber, current - 1);
    }
    return;
  }

  const database = await getMongoClient(mongoUri);

  if (database) {
    try {
      const limits = database.collection("phone_limits");
      await limits.updateOne(
        { _id: phoneNumber, count: { $gt: 0 } },
        { $inc: { count: -1 } }
      );
    } catch (err) {
      console.error("[BotStore] Error in releaseBotSlot:", err.message);
    }
  }

  const current = inMemoryPhoneLimits.get(phoneNumber) || 0;
  if (current > 0) {
    inMemoryPhoneLimits.set(phoneNumber, current - 1);
  }
}

/**
 * Creates a new persistent bot record.
 */
export async function createBotRecord(mongoUri, botData) {
  const now = new Date();
  const record = {
    botId: botData.botId,
    name: botData.name,
    phoneNumber: botData.phoneNumber,
    managementTokenHash: botData.managementTokenHash,
    managementTokenSalt: botData.managementTokenSalt,
    sessionId: botData.sessionId,
    pairingMethod: botData.pairingMethod || "code",
    status: botData.status || "created",
    createdAt: botData.createdAt || now,
    updatedAt: botData.updatedAt || now,
    lastConnectedAt: botData.lastConnectedAt || null,
    lastErrorCode: botData.lastErrorCode || null,
    settings: { ...DEFAULT_BOT_SETTINGS, botName: botData.name || DEFAULT_BOT_SETTINGS.botName }
  };

  inMemoryBots.set(record.botId, { ...record });
  inMemoryBotSettings.set(record.botId, { ...record.settings });

  if (mongoUri && !mongoUri.includes(":<db_password>@")) {
    const database = await getMongoClient(mongoUri);
    if (database) {
      try {
        const bots = database.collection("bots");
        await bots.insertOne({ _id: record.botId, ...record });
      } catch (err) {
        console.error("[BotStore] Error in createBotRecord:", err.message);
      }
    }
  }

  return record;
}

/**
 * Retrieves a bot record by bot ID.
 */
export async function getBotById(mongoUri, botId) {
  if (mongoUri && !mongoUri.includes(":<db_password>@")) {
    const database = await getMongoClient(mongoUri);
    if (database) {
      try {
        const bots = database.collection("bots");
        const doc = await bots.findOne({ botId });
        if (doc) {
          const { _id, ...cleanDoc } = doc;
          inMemoryBots.set(botId, cleanDoc);
          return cleanDoc;
        }
      } catch (err) {
        console.error("[BotStore] Error in getBotById:", err.message);
      }
    }
  }

  return inMemoryBots.get(botId) || null;
}

/**
 * Retrieves all bots belonging to a specific owner phone number.
 */
export async function getBotsByOwnerPhone(mongoUri, phoneNumber) {
  const results = [];

  if (mongoUri && !mongoUri.includes(":<db_password>@")) {
    const database = await getMongoClient(mongoUri);
    if (database) {
      try {
        const bots = database.collection("bots");
        const docs = await bots.find({ phoneNumber }).toArray();
        for (const doc of docs) {
          const { _id, ...cleanDoc } = doc;
          results.push(cleanDoc);
          inMemoryBots.set(cleanDoc.botId, cleanDoc);
        }
        return results;
      } catch (err) {
        console.error("[BotStore] Error in getBotsByOwnerPhone:", err.message);
      }
    }
  }

  for (const bot of inMemoryBots.values()) {
    if (bot.phoneNumber === phoneNumber) {
      results.push(bot);
    }
  }

  return results;
}

/**
 * Updates status and metadata for a given bot.
 */
export async function updateBotStatus(mongoUri, botId, updates) {
  const now = new Date();
  const setFields = { ...updates, updatedAt: now };

  const current = inMemoryBots.get(botId);
  if (current) {
    inMemoryBots.set(botId, { ...current, ...setFields });
  }

  if (mongoUri && !mongoUri.includes(":<db_password>@")) {
    const database = await getMongoClient(mongoUri);
    if (database) {
      try {
        const bots = database.collection("bots");
        await bots.updateOne({ botId }, { $set: setFields });
      } catch (err) {
        console.error("[BotStore] Error in updateBotStatus:", err.message);
      }
    }
  }

  return inMemoryBots.get(botId) || null;
}

/**
 * Retrieves settings for a given bot ID.
 */
export async function getBotSettings(mongoUri, botId) {
  const bot = await getBotById(mongoUri, botId);
  const stored = bot?.settings || inMemoryBotSettings.get(botId) || {};
  return {
    ...DEFAULT_BOT_SETTINGS,
    botName: bot?.name || DEFAULT_BOT_SETTINGS.botName,
    ...stored
  };
}

/**
 * Validates and updates configurable settings for a bot ID.
 */
export async function updateBotSettings(mongoUri, botId, updates) {
  const bot = await getBotById(mongoUri, botId);
  if (!bot) return null;

  const currentSettings = await getBotSettings(mongoUri, botId);
  const cleanUpdates = {};

  for (const [key, val] of Object.entries(updates)) {
    if (!ALLOWED_SETTING_KEYS.has(key)) {
      const error = new Error(`Setting '${key}' is unknown or not supported.`);
      error.statusCode = 400;
      error.code = "VALIDATION_ERROR";
      throw error;
    }

    if (key === "prefix") {
      if (typeof val !== "string" || val.trim().length === 0 || val.trim().length > 5) {
        const error = new Error("Prefix must be a non-empty string between 1 and 5 characters.");
        error.statusCode = 400;
        error.code = "VALIDATION_ERROR";
        throw error;
      }
      cleanUpdates.prefix = val.trim();
    } else if (key === "botName" || key === "name") {
      if (typeof val !== "string" || val.trim().length === 0 || val.trim().length > 50) {
        const error = new Error("Bot name must be a string between 1 and 50 characters.");
        error.statusCode = 400;
        error.code = "VALIDATION_ERROR";
        throw error;
      }
      cleanUpdates.botName = val.trim();
      cleanUpdates.name = val.trim();
    } else if (key === "mode") {
      if (val !== "public" && val !== "self" && val !== "private") {
        const error = new Error("Mode must be 'public', 'self', or 'private'.");
        error.statusCode = 400;
        error.code = "VALIDATION_ERROR";
        throw error;
      }
      cleanUpdates.mode = val;
    } else if (key === "newsletterJid") {
      if (typeof val !== "string") {
        const error = new Error("newsletterJid must be a string.");
        error.statusCode = 400;
        error.code = "VALIDATION_ERROR";
        throw error;
      }
      cleanUpdates.newsletterJid = val.trim();
    } else {
      if (typeof val !== "boolean") {
        const error = new Error(`Setting '${key}' must be a boolean (true or false).`);
        error.statusCode = 400;
        error.code = "VALIDATION_ERROR";
        throw error;
      }
      cleanUpdates[key] = val;
    }
  }

  const updatedSettings = { ...currentSettings, ...cleanUpdates };

  // Sync in-memory
  inMemoryBotSettings.set(botId, updatedSettings);
  if (cleanUpdates.botName || cleanUpdates.name) {
    bot.name = cleanUpdates.botName || cleanUpdates.name;
  }
  bot.settings = updatedSettings;
  inMemoryBots.set(botId, bot);

  // Sync MongoDB
  if (mongoUri && !mongoUri.includes(":<db_password>@")) {
    const database = await getMongoClient(mongoUri);
    if (database) {
      try {
        const bots = database.collection("bots");
        const setDoc = {
          settings: updatedSettings,
          updatedAt: new Date()
        };
        if (cleanUpdates.botName || cleanUpdates.name) {
          setDoc.name = cleanUpdates.botName || cleanUpdates.name;
        }
        await bots.updateOne({ botId }, { $set: setDoc });
      } catch (err) {
        console.error("[BotStore] Error updating bot settings in Mongo:", err.message);
      }
    }
  }

  return updatedSettings;
}

/**
 * Permanently deletes a bot record, releases slot, and cleans up resources.
 */
export async function deleteBotRecord(mongoUri, botId) {
  const bot = await getBotById(mongoUri, botId);
  if (!bot) return false;

  inMemoryBots.delete(botId);
  inMemoryBotSettings.delete(botId);

  // Release reservation counter
  if (bot.phoneNumber) {
    await releaseBotSlot(mongoUri, bot.phoneNumber).catch(() => {});
  }

  if (mongoUri && !mongoUri.includes(":<db_password>@")) {
    const database = await getMongoClient(mongoUri);
    if (database) {
      try {
        const bots = database.collection("bots");
        await bots.deleteOne({ botId });

        // Delete Mongo session data
        const sessions = database.collection("sessions");
        await sessions.deleteOne({ _id: bot.sessionId });
        await sessions.deleteOne({ sessionId: bot.sessionId });
      } catch (err) {
        console.error("[BotStore] Error deleting bot record in Mongo:", err.message);
      }
    }
  }

  return true;
}

/**
 * Utility to reset in-memory store (for unit tests).
 */
export function clearInMemoryBotStore() {
  inMemoryBots.clear();
  inMemoryPhoneLimits.clear();
  inMemoryBotSettings.clear();
}
