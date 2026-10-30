import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { WhatsAppSession } from "./whatsapp-session.js";
import { restoreAllSessionsFromMongo, startPeriodicSync } from "./mongo-store.js";

export class SessionManager {
  constructor(config) {
    this.config = config;
    this.sessions = new Map();
    this.discoveryTimer = null;

    // Start periodic 60-second MongoDB sweep
    if (this.config.mongoUri) {
      startPeriodicSync(this.config.sessionDir, 60000, this.config.mongoUri);
    }

    this.startSessionDiscoveryLoop();
  }

  startSessionDiscoveryLoop() {
    // Session inventory discovery refresh every 5 minutes (300,000 ms)
    clearInterval(this.discoveryTimer);
    this.discoveryTimer = setInterval(() => {
      this.restoreSessions().catch(err => {
        console.error("[SessionManager] Discovery refresh error:", err.message);
      });
    }, 300000);
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
    if (!id) return null;

    // Direct match
    if (this.sessions.has(id)) {
      return this.sessions.get(id);
    }

    // Phone number lookup
    const cleanId = String(id).replace(/\D/g, "");
    for (const [key, session] of this.sessions.entries()) {
      if (key === cleanId || key.startsWith(`${cleanId}_`) || session.phone === cleanId) {
        return session;
      }
    }

    return null;
  }

  async getOrCreateSession(id) {
    let session = this.get(id);
    if (!session) {
      const phoneDigits = id.split("_")[0];
      session = new WhatsAppSession({
        id,
        phone: phoneDigits,
        dir: path.join(this.config.sessionDir, id),
        config: this.config,
        sessionManager: this,
        onClosed: () => this.sessions.delete(id)
      });
      this.sessions.set(id, session);
    }
    return session;
  }

  getConnectedSessions() {
    const connected = [];
    for (const session of this.sessions.values()) {
      if ((session.status === "open" || session.registered) && session.sock) {
        connected.push(session);
      }
    }
    return connected;
  }

  async restoreSessions() {
    await fs.mkdir(this.config.sessionDir, { recursive: true });

    console.log(`🔁 [restore] Boot — scanning ${this.config.sessionDir}`);

    // Pre-restore all saved sessions from Mongo onto disk before Baileys is started
    if (this.config.mongoUri) {
      try {
        const restored = await restoreAllSessionsFromMongo(this.config.sessionDir, this.config.mongoUri);
        if (restored.length) {
          console.log(`☁️  [mongo] Pre-restored ${restored.length} session(s) from MongoDB`);
        } else {
          console.log(`☁️  [mongo] No registered sessions returned from MongoDB`);
        }
      } catch (e) {
        console.warn("[mongo] Pre-restore failed:", e.message);
      }
    }

    const sessionIds = new Set();

    // Check local directory entries and remove void/unpaired folders
    try {
      const entries = await fs.readdir(this.config.sessionDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const folderName = entry.name;
          const folderPath = path.join(this.config.sessionDir, folderName);
          const credsFile = path.join(folderPath, "creds.json");

          let isRegistered = false;
          if (fsSync.existsSync(credsFile)) {
            try {
              const raw = fsSync.readFileSync(credsFile, "utf-8");
              const creds = JSON.parse(raw);
              isRegistered = Boolean(creds?.registered || creds?.me?.id);
            } catch {}
          }

          if (isRegistered) {
            sessionIds.add(folderName);
          } else {
            console.log(`⚠️  [restore] ${folderName}: void or unregistered session — purging local folder`);
            try {
              await fs.rm(folderPath, { recursive: true, force: true });
            } catch {}
          }
        }
      }
    } catch {}

    console.log(`🔁 [restore] Triggering restoration for ${sessionIds.size} registered session(s)`);

    // Restore and connect each session
    for (const sessionId of sessionIds) {
      if (this.sessions.has(sessionId)) continue;

      const phoneDigits = sessionId.split("_")[0];
      const session = new WhatsAppSession({
        id: sessionId,
        phone: phoneDigits,
        dir: path.join(this.config.sessionDir, sessionId),
        config: this.config,
        sessionManager: this,
        onClosed: () => this.sessions.delete(sessionId)
      });

      this.sessions.set(sessionId, session);

      console.log(`♻️  [restore] Restoring session ${sessionId} (welcome suppressed)`);
      try {
        await session.connect();
      } catch (error) {
        console.error(`restore ${sessionId}:`, error.message);
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

    // Unlimited multi-session pairing under unique session IDs
    const uniqueSessionId = `${phone}_${Date.now()}`;

    const session = new WhatsAppSession({
      id: uniqueSessionId,
      phone,
      dir: path.join(this.config.sessionDir, uniqueSessionId),
      config: this.config,
      sessionManager: this,
      onClosed: () => this.sessions.delete(uniqueSessionId)
    });

    this.sessions.set(uniqueSessionId, session);

    const code = await session.pair();
    return {
      ok: true,
      sessionId: uniqueSessionId,
      code,
      status: session.status
    };
  }

  async disconnect(id) {
    const session = this.get(id);
    if (!session) throw new Error("Session not found.");
    await session.logout();
    this.sessions.delete(session.id);
  }
}
