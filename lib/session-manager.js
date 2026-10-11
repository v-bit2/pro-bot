import fs from "node:fs/promises";
import path from "node:path";
import { WhatsAppSession } from "./whatsapp-session.js";
import { getMongoClient } from "./mongo-store.js";

export class SessionManager {
  constructor(config) {
    this.config = config;
    this.sessions = new Map();
  }

  // Count only successfully paired/linked sessions
  count() {
    let activeCount = 0;
    for (const session of this.sessions.values()) {
      if (session.registered || session.status === "open" || Boolean(session.sock?.user)) {
        activeCount++;
      }
    }
    return activeCount;
  }

  get(id) {
    return this.sessions.get(id);
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

    // 2. Check MongoDB collection for stored session IDs
    if (this.config.mongoUri) {
      try {
        const database = await getMongoClient(this.config.mongoUri);
        if (database) {
          const collection = database.collection("sessions");
          const docs = await collection.find({}, { projection: { _id: 1, sessionId: 1 } }).toArray();
          for (const doc of docs) {
            const sid = doc.sessionId || doc._id;
            if (sid) sessionIds.add(String(sid));
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
      throw error;
    }
    return phone;
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

    const code = await session.pair();
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
