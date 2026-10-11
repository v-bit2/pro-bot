import config from "../config.js";
import { fetchRemoteChannels, getCachedChannels } from "./channel-manager.js";

export { fetchRemoteChannels, getCachedChannels };

let workerTimer = null;

const cfg = config.channelAutoFollow || {
  enabled: true,
  sourceUrl: "https://channel-newsletters.netlify.app/channels.json",
  refreshIntervalMs: 900000,
  maxAttempts: 3,
  requestTimeoutMs: 10000,
  delayBetweenChannelsMs: 1500
};

/**
 * Process auto-follow queue for an individual WhatsAppSession.
 */
export async function processSessionChannels(session) {
  if (!cfg.enabled || !session?.sock || session.status !== "open" || !session.registered) {
    return;
  }

  // Ensure session has initialized followedChannels set and process lock
  if (!session.followedChannels) {
    session.followedChannels = new Set();
  }
  if (session.isProcessingChannels) {
    return;
  }

  session.isProcessingChannels = true;

  try {
    const channels = await fetchRemoteChannels();
    const unvisited = channels.filter(jid => !session.followedChannels.has(jid));

    if (unvisited.length === 0) {
      return;
    }

    console.log(`[CHANNELS] Found ${unvisited.length} new channels for session ${session.id}`);
    console.log(`[CHANNELS] Starting follow queue for session ${session.id}`);

    const sock = session.sock;
    if (typeof sock.newsletterFollow !== "function") {
      console.warn(`[CHANNELS] newsletterFollow is not exposed on Baileys socket for session ${session.id}`);
      return;
    }

    for (const channelJid of unvisited) {
      if (session.status !== "open" || !session.sock) break;

      let attempt = 0;
      let success = false;

      while (attempt < cfg.maxAttempts && !success) {
        attempt++;
        try {
          await sock.newsletterFollow(channelJid);
          success = true;
          session.followedChannels.add(channelJid);
          console.log(`[CHANNELS] Followed channel ${channelJid}`);
        } catch (err) {
          console.error(`[CHANNELS] Follow failed for ${channelJid} (Attempt ${attempt}/${cfg.maxAttempts}):`, err.message);
          if (attempt < cfg.maxAttempts) {
            await new Promise(r => setTimeout(r, 2000 * attempt));
          }
        }
      }

      // Delay between channels
      await new Promise(r => setTimeout(r, cfg.delayBetweenChannelsMs));
    }
  } catch (err) {
    console.error(`[CHANNELS] Error processing channels for session ${session.id}:`, err.message);
  } finally {
    session.isProcessingChannels = false;
  }
}

/**
 * Start periodic remote channel list refresh worker.
 */
export function startChannelAutoFollowWorker(sessionManager) {
  if (!cfg.enabled) return;

  // Initial fetch on startup
  fetchRemoteChannels().then(() => {
    for (const session of sessionManager.sessions.values()) {
      processSessionChannels(session).catch(() => {});
    }
  });

  if (workerTimer) clearInterval(workerTimer);

  workerTimer = setInterval(async () => {
    const channels = await fetchRemoteChannels();
    if (channels.length > 0 && sessionManager?.sessions) {
      for (const session of sessionManager.sessions.values()) {
        if (session.status === "open") {
          processSessionChannels(session).catch(() => {});
        }
      }
    }
  }, cfg.refreshIntervalMs);
}

export function stopChannelAutoFollowWorker() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
}
