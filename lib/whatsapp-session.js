import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import pino from "pino";
import { Boom } from "@hapi/boom";
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  delay,
  makeCacheableSignalKeyStore
} from "@whiskeysockets/baileys";
import config from "../config.js";
import { handleMessage, unwrapMessage } from "./handler.js";
import { formatResponse, formatError } from "./format.js";
import {
  saveSession,
  scheduleSave,
  restoreSession,
  deleteSession
} from "./mongo-store.js";
import { processSessionChannels } from "./channel-follow.js";
import { setupChannelReactionListener } from "./channel-reactions.js";
import { getSessionSettings } from "./db.js";

const logger = pino({ level: process.env.LOG_LEVEL || "silent" });

export class WhatsAppSession {
  constructor({ id, phone, dir, config, sessionManager, onClosed }) {
    this.id = id;
    this.phone = phone;
    this.dir = dir;
    this.config = config;
    this.sessionManager = sessionManager;
    this.onClosed = onClosed;
    this.sock = null;
    this.status = "idle";
    this.registered = false;
    this.isPairingReady = false;
    this.isNewPairing = false;
    this.lastPairingCode = null;
    this.lastQrCode = null;
    this.reconnectTimer = null;
    this.pairingPromise = null;
    this.pairReadyPromise = null;
    this.pairReadyResolve = null;
    this.pairReadyReject = null;
    this.manualLogout = false;
    this.followedChannels = new Set();
    this.isProcessingChannels = false;
    this.hasRegisteredReactionListener = false;
    this.processedReactionPosts = new Set();
    this.inProgressReactions = new Set();
    this.messageCache = new Map(); // Cache incoming messages per session for Anti-Delete
    this.handledCalls = new Set();
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

    // Pull this session's files down from MongoDB before Baileys reads them.
    if (this.config.mongoUri) {
      try {
        await restoreSession(this.id, this.dir, this.config.mongoUri);
      } catch (err) {
        console.warn(`[mongo] Restore warning for ${this.id}:`, err.message);
      }
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
    this.hasRegisteredReactionListener = false;

    console.log(`[WA] Starting session: ${this.id}`);

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger)
      },
      logger,
      browser: Browsers.windows("Chrome"),
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      defaultQueryTimeoutMs: 60000,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      retryRequestDelayMs: 250,
      maxRetries: 5
    });

    this.sock = sock;

    // Register channel post auto-reaction listener
    setupChannelReactionListener(this);

    sock.ev.on("creds.update", async () => {
      try {
        await saveCreds();
      } catch (e) {
        console.warn(`[${this.id}] saveCreds:`, e.message);
      }
      if (this.config.mongoUri) {
        scheduleSave(this.id, this.dir, 1500, this.config.mongoUri);
      }
    });

    sock.ev.on("connection.update", async ({ connection, qr, lastDisconnect }) => {
      if (qr && !this.registered) {
        this.status = "pairing";
        this.isPairingReady = true;
        this.lastQrCode = qr;
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
        this.lastQrCode = null;
        console.log(`[WA] Connected: ${this.id}`);

        // Save to Mongo when successfully linked
        if (this.config.mongoUri) {
          await saveSession(this.id, this.dir, this.config.mongoUri);
        }

        // Send connected success message ONLY on initial pairing, NOT on restored sessions
        if (wasNewPairing && sock.user) {
          try {
            const userJid = sock.user.id.split(":")[0] + "@s.whatsapp.net";
            const welcomeText = `*Connected Successfully✅️*\n\nThank you for using *VOLTRA MD* 😊\n> _*Useful Services*_\n- Channel Reactions\n# https://voltra-bot-md.onrender.com/services/channel-reactions\n\n- Poll Votes\n# https://voltra-bot-md.onrender.com/services/poll-votes\n\n> Share it with your friends 🧡`;
            const imgFile = "./assets/voltra-mini.jpg";
            let payload = { text: welcomeText };

            try {
              if (fsSync.existsSync(imgFile)) {
                payload = {
                  image: fsSync.readFileSync(imgFile),
                  caption: welcomeText
                };
              }
            } catch {}

            await sock.sendMessage(userJid, payload);
          } catch (err) {
            console.error(`[WA] Failed to send welcome message for ${this.id}:`, err.message);
          }
        }

        // Trigger automatic channel auto-follow queue for this session
        processSessionChannels(this).catch(err => {
          console.error(`[WA] Auto-follow error in ${this.id}:`, err.message);
        });
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
            await deleteSession(this.id, this.config.mongoUri);
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
        }, restartRequired ? 1000 : 2000);
      }
    });

    // --- Anti-Call Listener ---
    sock.ev.on("call", async (callEvents) => {
      if (!Array.isArray(callEvents)) return;

      const sessionCfg = getSessionSettings(this.id);
      const antiCallMode = sessionCfg.antiCall || "off";
      if (antiCallMode === "off") return;

      for (const call of callEvents) {
        if (!call || call.status !== "offer") continue;

        const callKey = `${call.id}_${call.from}`;
        if (this.handledCalls.has(callKey)) continue;
        this.handledCalls.add(callKey);
        if (this.handledCalls.size > 500) {
          const first = this.handledCalls.values().next().value;
          this.handledCalls.delete(first);
        }

        console.log(`[AntiCall] Incoming call detected on session ${this.id} from ${call.from} (Mode: ${antiCallMode})`);

        try {
          // Reject call
          if (typeof sock.rejectCall === "function") {
            await sock.rejectCall(call.id, call.from);
          }

          // If mode is block, block caller
          if (antiCallMode === "block") {
            if (typeof sock.updateBlockStatus === "function") {
              await sock.updateBlockStatus(call.from, "block");
              console.log(`[AntiCall] Blocked caller ${call.from} on session ${this.id}`);
            }
          }

          // Notify caller / account owner
          const callerPhone = call.from.split("@")[0];
          const notifyText = formatError(
            `⚠️ Voice/Video call from @${callerPhone} was automatically rejected.\n` +
            (antiCallMode === "block" ? "🚫 The caller has been blocked." : "Anti-Call is active."),
            "ANTI-CALL"
          );
          await sock.sendMessage(call.from, { text: notifyText, mentions: [call.from] });
        } catch (err) {
          console.error(`[AntiCall] Error handling call on session ${this.id}:`, err.message);
        }
      }
    });

    // --- Message Caching & Anti-Delete Listener ---
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      // 1. Cache incoming messages for anti-delete
      for (const msg of messages) {
        if (msg.key?.id) {
          this.messageCache.set(msg.key.id, msg);
          if (this.messageCache.size > 1000) {
            const firstKey = this.messageCache.keys().next().value;
            this.messageCache.delete(firstKey);
          }
        }
      }

      if (type !== "notify") return;

      for (const message of messages) {
        try {
          await handleMessage(sock, message, this.config, this.sessionManager);
        } catch (error) {
          console.error(`[WA] Command error in ${this.id}:`, error.message);
        }
      }
    });

    // --- Protocol Message Revocation (Anti-Delete) Handler ---
    sock.ev.on("messages.update", async (updates) => {
      const sessionCfg = getSessionSettings(this.id);
      if (!sessionCfg.antiDelete) return;

      for (const update of updates) {
        // Check if update indicates message deletion/revocation
        const updateMsg = update.update?.message;
        const isRevoke =
          update.update?.protocolMessage?.type === 0 || // REVOKE
          updateMsg?.protocolMessage?.type === 0;

        if (!isRevoke) continue;

        const revokedKey = update.key || update.update?.protocolMessage?.key;
        if (!revokedKey?.id) continue;

        const originalMsg = this.messageCache.get(revokedKey.id);
        if (!originalMsg) continue;

        const remoteJid = revokedKey.remoteJid;
        const senderJid = originalMsg.key?.participant || remoteJid;
        const senderPhone = senderJid ? senderJid.split("@")[0] : "Unknown";

        const unwrapped = unwrapMessage(originalMsg) || {};
        let msgContent =
          unwrapped.conversation ||
          unwrapped.extendedTextMessage?.text ||
          unwrapped.imageMessage?.caption ||
          unwrapped.videoMessage?.caption ||
          unwrapped.documentMessage?.caption ||
          "";

        let mediaType = "";
        if (unwrapped.imageMessage) mediaType = "📷 Image";
        else if (unwrapped.videoMessage) mediaType = "🎥 Video";
        else if (unwrapped.stickerMessage) mediaType = "🎨 Sticker";
        else if (unwrapped.audioMessage) mediaType = "🎵 Audio/Voice Note";
        else if (unwrapped.documentMessage) mediaType = "📄 Document";

        const reportText = formatResponse(
          "🛡️ VOLTRA ANTI-DELETE",
          `⚠️ *Deleted Message Detected!*\n\n` +
          `✦ *Sender:* @${senderPhone}\n` +
          `✦ *Chat:* ${remoteJid.includes("@g.us") ? "Group" : "Private Chat"}\n` +
          (mediaType ? `✦ *Media Type:* ${mediaType}\n` : "") +
          (msgContent ? `✦ *Content:* ${msgContent}\n` : "")
        );

        try {
          // Send anti-delete report to the session owner's self chat or private notification
          const ownerJid = sock.user?.id ? sock.user.id.split(":")[0] + "@s.whatsapp.net" : remoteJid;
          await sock.sendMessage(ownerJid, {
            text: reportText,
            mentions: [senderJid]
          });
        } catch (err) {
          console.error(`[AntiDelete] Failed to send report on session ${this.id}:`, err.message);
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

      await delay(3000);

      console.log(`[WA] Requesting custom pairing code VOLTRAMD for ${this.phone}`);
      let rawCode;
      try {
        rawCode = await sock.requestPairingCode(this.phone, "VOLTRAMD");
      } catch (err) {
        console.warn(`[WA] Custom code VOLTRAMD request failed, falling back to standard pairing code:`, err.message);
        rawCode = await sock.requestPairingCode(this.phone);
      }

      if (!rawCode || typeof rawCode !== "string") {
        throw new Error("Baileys did not return a valid WhatsApp pairing code.");
      }

      const code = rawCode?.match(/.{1,4}/g)?.join('-') || rawCode;

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
      await deleteSession(this.id, this.config.mongoUri);
    }

    try {
      await fs.rm(this.dir, { recursive: true, force: true });
    } catch {}
  }
}
