import fs from "node:fs/promises";
import path from "node:path";
import { WhatsAppSession } from "./whatsapp-session.js";
import { getMongoClient } from "./mongo-store.js";
import { updateBotStatus } from "./bot-store.js";

export class SessionManager {
  constructor(config) {
    this.config = config;
    this.sessions = new Map();
    this.initLocks = new Set();
  }

  // Count only successfully paired/linked sessions
  count() {
    let activeCount = 0;
    for (const session of this.sessions.values()) {
      if (session.registered || session.status === "open" || session.status === "connected" || Boolean(session.sock?.user)) {
        activeCount++;
      }
    }
    return activeCount;
  }

  get(id) {
    return this.sessions.get(id);
  }

  /**
   * Prevents concurrent pair/initialize calls on the same bot ID.
   */
  acquireLock(botId) {
    if (this.initLocks.has(botId)) {
      const error = new Error("An initialization or pairing operation is already in progress for this bot.");
      error.statusCode = 409;
      error.code = "CONFLICT";
      throw error;
    }
    this.initLocks.add(botId);
  }

  releaseLock(botId) {
    this.initLocks.delete(botId);
  }

  getOrCreateSession(sessionId, phone, botId = null) {
    let session = this.sessions.get(sessionId);

    if (!session) {
      session = new WhatsAppSession({
        id: sessionId,
        phone,
        dir: path.join(this.config.sessionDir, sessionId),
        config: this.config,
        onClosed: () => this.sessions.delete(sessionId),
        onStatusChange: (status, extraUpdates = {}) => {
          if (botId) {
            updateBotStatus(this.config.mongoUri, botId, { status, ...extraUpdates }).catch(() => {});
          }
        }
      });
      this.sessions.set(sessionId, session);
    }

    return session;
  }

  async restoreSessions() {
    await fs.mkdir(this.config.sessionDir, { recursive: true });

    const sessionIds = new Set();

    // 1. Check local directory entries
    try {
      const entries = await fs.readdir(this.config.sessionDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) sessionIds.add(entry.name);
      }
    } catch {}

    // 2. Check MongoDB collection for stored session IDs and bot IDs
    if (this.config.mongoUri) {
      try {
        const database = await getMongoClient(this.config.mongoUri);
        if (database) {
          const sessionsCol = database.collection("sessions");
          const sessionDocs = await sessionsCol.find({}, { projection: { _id: 1, sessionId: 1 } }).toArray();
          for (const doc of sessionDocs) {
            const sid = doc.sessionId || doc._id;
            if (sid) sessionIds.add(String(sid));
          }

          const botsCol = database.collection("bots");
          const botDocs = await botsCol.find({ status: { $in: ["connected", "open", "connecting", "awaiting_pairing"] } }).toArray();
          for (const bot of botDocs) {
            if (bot.sessionId) sessionIds.add(String(bot.sessionId));
          }
        }
      } catch (err) {
        console.error("[SessionManager] Failed to query Mongo for sessions:", err.message);
      }
    }

    // 3. Restore and connect each session
    for (const sessionId of sessionIds) {
      if (this.sessions.has(sessionId)) continue;

      const session = new WhatsAppSession({
        id: sessionId,
        phone: sessionId,
        dir: path.join(this.config.sessionDir, sessionId),
        config: this.config,
        onClosed: () => this.sessions.delete(sessionId)
      });

      this.sessions.set(sessionId, session);

      try {
        await session.connect();
      } catch (error) {
        console.error(`[${sessionId}] restore failed:`, error.message);
      }
    }
  }

  normalizePhone(input) {
    const phone = String(input || "").replace(/\D/g, "");
    if (!/^[1-9]\d{7,14}$/.test(phone)) {
      const error = new Error("Enter a valid international phone number, e.g. 263786624966.");
      error.statusCode = 400;
      error.code = "INVALID_INPUT";
      throw error;
    }
    return phone;
  }

  async pairBot({ botId, sessionId, phoneNumber, method = "code" }) {
    this.acquireLock(botId);

    try {
      if (this.sessions.size >= this.config.maxSessions && !this.sessions.has(sessionId)) {
        const error = new Error("The server has reached its max session limit.");
        error.statusCode = 429;
        error.code = "RATE_LIMIT_EXCEEDED";
        throw error;
      }

      const session = this.getOrCreateSession(sessionId, phoneNumber, botId);

      // Update status to initializing
      await updateBotStatus(this.config.mongoUri, botId, { status: "initializing" });

      const result = await session.pair({ method, phoneNumber });
      return result;
    } catch (err) {
      await updateBotStatus(this.config.mongoUri, botId, {
        status: "failed",
        lastErrorCode: err.message || "PAIRING_FAILED"
      }).catch(() => {});
      throw err;
    } finally {
      this.releaseLock(botId);
    }
  }

  async createOrPair(input) {
    const phone = this.normalizePhone(input);

    if (this.sessions.size >= this.config.maxSessions && !this.sessions.has(phone)) {
      const error = new Error("The server has reached its session limit.");
      error.statusCode = 429;
      throw error;
    }

    let session = this.sessions.get(phone);

    if (!session) {
      session = new WhatsAppSession({
        id: phone,
        phone,
        dir: path.join(this.config.sessionDir, phone),
        config: this.config,
        onClosed: () => this.sessions.delete(phone)
      });
      this.sessions.set(phone, session);
    }

    const pairRes = await session.pair({ method: "code", phoneNumber: phone });
    const code = typeof pairRes === "string" ? pairRes : pairRes.pairingCode || pairRes.result;

    return {
      ok: true,
      sessionId: phone,
      code,
      status: session.status
    };
  }

  async disconnect(id) {
    const session = this.sessions.get(id);
    if (!session) throw new Error("Session not found.");
    await session.logout();
    this.sessions.delete(id);
  }
}
