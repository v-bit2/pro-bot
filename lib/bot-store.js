import { getMongoClient } from "./mongo-store.js";

// In-memory fallbacks when MongoDB is unavailable or for local testing
const inMemoryBots = new Map();
const inMemoryPhoneLimits = new Map();

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
 * Atomically reserves a slot for a phone number enforcing the max bot limit (default 3).
 * Throws an error with statusCode 409 if the limit is reached or exceeded.
 */
export async function reserveBotSlot(mongoUri, phoneNumber, maxLimit = 3) {
  // If MongoDB is not configured or available, perform immediate synchronous in-memory reservation
  if (!mongoUri || mongoUri.includes(":<db_password>@")) {
    const current = inMemoryPhoneLimits.get(phoneNumber) || 0;
    if (current >= maxLimit) {
      const error = new Error(`Maximum bot limit of ${maxLimit} reached for phone number ${phoneNumber}.`);
      error.statusCode = 409;
      error.code = "BOT_LIMIT_EXCEEDED";
      throw error;
    }
    inMemoryPhoneLimits.set(phoneNumber, current + 1);
    return current + 1;
  }

  const database = await getMongoClient(mongoUri);

  if (database) {
    try {
      const limits = database.collection("phone_limits");

      // Ensure initial record exists
      await limits.updateOne(
        { _id: phoneNumber },
        { $setOnInsert: { count: 0 } },
        { upsert: true }
      );

      // Atomically increment counter only if current count < maxLimit
      const result = await limits.findOneAndUpdate(
        { _id: phoneNumber, count: { $lt: maxLimit } },
        { $inc: { count: 1 } },
        { returnDocument: "after" }
      );

      if (!result) {
        const error = new Error(`Maximum bot limit of ${maxLimit} reached for phone number ${phoneNumber}.`);
        error.statusCode = 409;
        error.code = "BOT_LIMIT_EXCEEDED";
        throw error;
      }

      return result.count;
    } catch (err) {
      if (err.statusCode) throw err;
      if (err.code === 11000) {
        const error = new Error(`Maximum bot limit of ${maxLimit} reached for phone number ${phoneNumber}.`);
        error.statusCode = 409;
        error.code = "BOT_LIMIT_EXCEEDED";
        throw error;
      }
      console.error("[BotStore] Error in reserveBotSlot:", err.message);
    }
  }

  // Fallback in-memory atomic reservation
  const current = inMemoryPhoneLimits.get(phoneNumber) || 0;
  if (current >= maxLimit) {
    const error = new Error(`Maximum bot limit of ${maxLimit} reached for phone number ${phoneNumber}.`);
    error.statusCode = 409;
    error.code = "BOT_LIMIT_EXCEEDED";
    throw error;
  }

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
    lastErrorCode: botData.lastErrorCode || null
  };

  // Always keep in-memory sync
  inMemoryBots.set(record.botId, { ...record });

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
 * Utility to reset in-memory store (for unit tests).
 */
export function clearInMemoryBotStore() {
  inMemoryBots.clear();
  inMemoryPhoneLimits.clear();
}
