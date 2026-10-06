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
import { saveSessionToMongo, restoreSessionFromMongo, deleteSessionFromMongo } from "./mongo-store.js";

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
    if (this.sock && (this.status === "connecting" || this.status === "open")) {
      return this.sock;
    }

    await fs.mkdir(this.dir, { recursive: true });

    // Restore from MongoDB if available
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

    const sock = makeWASocket({
      version,
      auth: state,
      logger,
      browser: Browsers.ubuntu("Chrome"),
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false
    });

    this.sock = sock;

    sock.ev.on("creds.update", async () => {
      await saveCreds();
      if (this.config.mongoUri) {
        await saveSessionToMongo(this.config.mongoUri, this.id, this.dir);
      }
    });

    sock.ev.on("connection.update", async ({ connection, qr, lastDisconnect }) => {
      if (qr && !this.registered) {
        this.status = "pairing";
        this.pairReadyResolve?.();
        this.pairReadyResolve = null;
        this.pairReadyReject = null;
      }

      if (connection === "open") {
        this.registered = true;
        this.pairReadyResolve?.();
        this.pairReadyResolve = null;
        this.pairReadyReject = null;
        this.status = "open";
        this.lastPairingCode = null;
        console.log(`[${this.id}] ✅ WhatsApp connected`);

        // Backup to MongoDB on connection open
        if (this.config.mongoUri) {
          await saveSessionToMongo(this.config.mongoUri, this.id, this.dir);
        }
      }

      if (connection === "close") {
        this.pairReadyReject?.(new Error("WhatsApp closed the pairing connection before a code could be requested."));
        this.pairReadyResolve = null;
        this.pairReadyReject = null;
        this.sock = null;

        const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut;
        const restartRequired = code === DisconnectReason.restartRequired;

        if (loggedOut || this.manualLogout) {
          this.status = "logged_out";
          console.log(`[${this.id}] 🔌 Logged out`);
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
            console.error(`[${this.id}] reconnect failed:`, error.message)
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
          console.error(`[${this.id}] command error:`, error.message);
        }
      }
    });

    return sock;
  }

  async pair() {
    if (this.pairingPromise) return this.pairingPromise;

    this.pairingPromise = (async () => {
      this.pairReadyPromise = new Promise((resolve, reject) => {
        this.pairReadyResolve = resolve;
        this.pairReadyReject = reject;
      });

      const sock = await this.connect({ pair: true });

      if (this.registered) {
        this.status = "open";
        this.pairReadyResolve?.();
        return "ALREADY_LINKED";
      }

      await Promise.race([
        this.pairReadyPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(
          "WhatsApp pairing channel did not become ready. Please try again."
        )), 15000))
      ]);

      if (this.registered) {
        this.status = "open";
        return "ALREADY_LINKED";
      }

      const code = await sock.requestPairingCode(this.phone);

      if (!code || typeof code !== "string" || code.length !== 8) {
        throw new Error("Baileys did not return a valid 8-character WhatsApp pairing code.");
      }

      this.lastPairingCode = code;
      this.status = "pairing";
      console.log(`[${this.id}] 🔑 WhatsApp pairing code: ${code}`);
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
