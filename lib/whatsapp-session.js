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
      // Use a canonical Baileys browser identity for phone-number pairing.
      // Custom browser labels can make WhatsApp reject companion_hello.
      browser: Browsers.ubuntu("Chrome"),
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false
    });

    this.sock = sock;
    sock.ev.on("creds.update", saveCreds);

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
      // Create the readiness waiter before creating the socket so we cannot
      // miss the first connection.update/qr event.
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

      // WhatsApp/Baileys emits a QR update even when using phone-number
      // pairing. That event means the socket is ready for requestPairingCode().
      // Never use an arbitrary sleep and never fabricate a code.
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

    try {
      await fs.rm(this.dir, { recursive: true, force: true });
    } catch {}
  }
}
