import fs from "node:fs/promises";
import path from "node:path";
import pino from "pino";
import { Boom } from "@hapi/boom";
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers
} from "@whiskeysockets/baileys";
import config from "../config.js";
import { handleMessage } from "./handler.js";
import { formatResponse } from "./format.js";
import { saveSessionToMongo, saveSessionToMongoDebounced, restoreSessionFromMongo, deleteSessionFromMongo } from "./mongo-store.js";

const logger = pino({ level: process.env.LOG_LEVEL || "silent" });

export class WhatsAppSession {
  constructor({ id, phone, dir, config, onClosed }) {
    this.id = id;
    this.phone = phone;
    this.dir = dir;
    this.config = config;
    this.onClosed = onClosed;
    this.sock = null;
    this.status = "idle";
    this.registered = false;
    this.isPairingReady = false;
    this.isNewPairing = false;
    this.lastPairingCode = null;
    this.reconnectTimer = null;
    this.pairingPromise = null;
    this.pairReadyPromise = null;
    this.pairReadyResolve = null;
    this.pairReadyReject = null;
    this.manualLogout = false;
  }

  publicStatus() {
    return {
      sessionId: this.id,
      phone: this.phone,
      status: this.status,
      paired: this.registered || Boolean(this.sock?.user),
      pairingCode: this.lastPairingCode
    };
  }

  async connect({ pair = false } = {}) {
    if (this.sock && (this.status === "connecting" || this.status === "open" || this.status === "pairing")) {
      return this.sock;
    }

    await fs.mkdir(this.dir, { recursive: true });

    // Restore from MongoDB BEFORE starting socket
    if (this.config.mongoUri) {
      await restoreSessionFromMongo(this.config.mongoUri, this.id, this.dir);
    }

    const { state, saveCreds } = await useMultiFileAuthState(this.dir);
    this.registered = Boolean(state.creds.registered);
    let version;
    try {
      ({ version } = await fetchLatestBaileysVersion());
    } catch {
      version = undefined;
    }

    this.status = "connecting";
    this.manualLogout = false;

    console.log(`[WA] Starting session: ${this.id}`);

    const sock = makeWASocket({
      version,
      auth: state,
      logger,
      browser: Browsers.ubuntu("Desktop"),
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false
    });

    this.sock = sock;

    sock.ev.on("creds.update", async () => {
      await saveCreds();
      // Only persist to MongoDB if session is successfully registered/paired
      if (this.config.mongoUri && (this.registered || Boolean(sock.user))) {
        saveSessionToMongoDebounced(this.config.mongoUri, this.id, this.dir);
      }
    });

    sock.ev.on("connection.update", async ({ connection, qr, lastDisconnect }) => {
      if (qr && !this.registered) {
        this.status = "pairing";
        this.isPairingReady = true;
        if (this.pairReadyResolve) {
          this.pairReadyResolve();
          this.pairReadyResolve = null;
          this.pairReadyReject = null;
        }
      }

      if (connection === "open") {
        const wasNewPairing = this.isNewPairing;
        this.registered = true;
        this.isPairingReady = false;
        this.isNewPairing = false;
        if (this.pairReadyResolve) {
          this.pairReadyResolve();
          this.pairReadyResolve = null;
          this.pairReadyReject = null;
        }
        this.status = "open";
        this.lastPairingCode = null;
        console.log(`[WA] Connected: ${this.id}`);

        // Save to Mongo when successfully linked
        if (this.config.mongoUri) {
          await saveSessionToMongo(this.config.mongoUri, this.id, this.dir);
        }

        // Send connected success message ONLY on initial pairing, NOT on restored sessions
        if (wasNewPairing && sock.user) {
          try {
            const userJid = sock.user.id.split(":")[0] + "@s.whatsapp.net";
            const welcomeText = formatResponse(
              "⚡ VOLTRA MINI CONNECTED",
              "🎉 *Successfully Connected!*\n\n" +
              "Your WhatsApp account is now linked with Voltra Mini.\n" +
              "Type *.menu* or *.help* to explore commands."
            );
            await sock.sendMessage(userJid, { text: welcomeText });
          } catch (err) {
            console.error(`[WA] Failed to send welcome message for ${this.id}:`, err.message);
          }
        }
      }

      if (connection === "close") {
        this.isPairingReady = false;
        if (this.pairReadyReject) {
          this.pairReadyReject(new Error("WhatsApp closed the pairing connection before a code could be requested."));
          this.pairReadyResolve = null;
          this.pairReadyReject = null;
        }
        this.sock = null;

        const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut;
        const restartRequired = code === DisconnectReason.restartRequired;

        if (loggedOut || this.manualLogout) {
          this.status = "logged_out";
          console.log(`[WA] Logged out: ${this.id}`);
          if (this.config.mongoUri) {
            await deleteSessionFromMongo(this.config.mongoUri, this.id);
          }
          if (this.manualLogout) this.onClosed?.();
          return;
        }

        this.status = "reconnecting";
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          this.connect().catch(error =>
            console.error(`[WA] Reconnect failed for ${this.id}:`, error.message)
          );
        }, restartRequired ? 500 : 2000);
      }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;

      for (const message of messages) {
        try {
          await handleMessage(sock, message, this.config);
        } catch (error) {
          console.error(`[WA] Command error in ${this.id}:`, error.message);
        }
      }
    });

    return sock;
  }

  async pair() {
    if (this.pairingPromise) return this.pairingPromise;

    this.pairingPromise = (async () => {
      if (!this.pairReadyPromise || !this.isPairingReady) {
        this.pairReadyPromise = new Promise((resolve, reject) => {
          this.pairReadyResolve = resolve;
          this.pairReadyReject = reject;
        });
      }

      const sock = await this.connect({ pair: true });

      if (this.registered) {
        this.status = "open";
        this.pairReadyResolve?.();
        return "ALREADY_LINKED";
      }

      if (!this.isPairingReady) {
        await Promise.race([
          this.pairReadyPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error(
            "WhatsApp pairing channel did not become ready. Please try again."
          )), 20000))
        ]);
      }

      if (this.registered) {
        this.status = "open";
        return "ALREADY_LINKED";
      }

      console.log(`[WA] Requesting custom pairing code VOLTRAMD for ${this.phone}`);
      let code;
      try {
        code = await sock.requestPairingCode(this.phone, "VOLTRAMD");
      } catch (err) {
        console.warn(`[WA] Custom code VOLTRAMD request failed, falling back to standard pairing code:`, err.message);
        code = await sock.requestPairingCode(this.phone);
      }

      if (!code || typeof code !== "string") {
        throw new Error("Baileys did not return a valid WhatsApp pairing code.");
      }

      this.isNewPairing = true;
      this.lastPairingCode = code;
      this.status = "pairing";
      console.log(`[WA] Pairing code generated: ${code}`);
      return code;
    })();

    try {
      return await this.pairingPromise;
    } finally {
      this.pairingPromise = null;
    }
  }

  async logout() {
    this.manualLogout = true;
    clearTimeout(this.reconnectTimer);

    try {
      await this.sock?.logout();
    } catch {}

    this.sock = null;
    this.status = "logged_out";

    if (this.config.mongoUri) {
      await deleteSessionFromMongo(this.config.mongoUri, this.id);
    }

    try {
      await fs.rm(this.dir, { recursive: true, force: true });
    } catch {}
  }
}
