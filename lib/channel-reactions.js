import config from "../config.js";
import { getCachedChannels, fetchRemoteChannels, _newsletterReactConfigs } from "./channel-manager.js";

const DEFAULT_EMOJIS = ["💯", "😍", "❤️", "🔥", "⚡️"];

const reactCfg = config.channelAutoReact || {
  enabled: true,
  emojis: DEFAULT_EMOJIS,
  delayBetweenReactionsMs: 2000,
  maxRetries: 2
};

export function pickEmoji(customEmojis = null) {
  const list = (customEmojis && customEmojis.length > 0) ? customEmojis : (reactCfg.emojis || DEFAULT_EMOJIS);
  if (!list || list.length === 0) return "❤️";
  const index = Math.floor(Math.random() * list.length);
  return list[index];
}

export function randomEmoji(customEmojis = null) {
  return pickEmoji(customEmojis);
}

export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function randomReactDelay(minMs = 1000, maxMs = 3000) {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

/**
 * Extract actual server post ID inspecting candidates in order:
 * msg.newsletterServerId, msg.messageServerID, msg.server_id, msg.key?.server_id, msg.key?.id
 */
export function extractServerId(msg) {
  if (!msg) return null;

  const candidate =
    msg.newsletterServerId ||
    msg.messageServerID ||
    msg.server_id ||
    msg.key?.server_id ||
    msg.key?.id;

  if (!candidate || String(candidate).trim() === "") {
    return null;
  }

  const candidateStr = String(candidate).trim();
  if (!/^\d+$/.test(candidateStr)) {
    return null;
  }

  return candidateStr;
}

/**
 * Extract channel post details from incoming message/update payload.
 */
export function extractChannelPostDetails(msg) {
  if (!msg) return null;

  const jid = msg.key?.remoteJid || msg.newsletterJid;
  if (!jid || typeof jid !== "string" || !jid.endsWith("@newsletter")) {
    return null;
  }

  const serverId = extractServerId(msg);
  if (!serverId) {
    return null;
  }

  return {
    newsletterJid: jid,
    serverId,
    timestamp: msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : Date.now()
  };
}

/**
 * Global set of reacted message keys across sessions: "newsletterJid|serverId|sessionNumber"
 */
const _reactedMessageIds = new Set();

/**
 * Central reactToChannelPost handling reactions across ALL active session sockets.
 */
export async function reactToChannelPost(originSock, msg, originSession) {
  const details = extractChannelPostDetails(msg);
  if (!details) return;

  const { newsletterJid, serverId } = details;

  // Check if channel is listed in remote channel registry or reaction configs
  const validChannels = getCachedChannels();
  if (validChannels.length > 0 && !validChannels.includes(newsletterJid) && !_newsletterReactConfigs.has(newsletterJid)) {
    const refreshed = await fetchRemoteChannels();
    if (!refreshed.includes(newsletterJid) && !_newsletterReactConfigs.has(newsletterJid)) {
      return;
    }
  }

  // Determine all connected sessions to broadcast reactions from
  let targetSessions = [];
  if (originSession?.sessionManager && typeof originSession.sessionManager.getConnectedSessions === "function") {
    targetSessions = originSession.sessionManager.getConnectedSessions();
  } else if (originSession) {
    targetSessions = [originSession];
  }

  if (targetSessions.length === 0 && originSock) {
    targetSessions = [{ id: "current", sock: originSock }];
  }

  const allowedEmojis = _newsletterReactConfigs.get(newsletterJid) || reactCfg.emojis || DEFAULT_EMOJIS;

  if (_reactedMessageIds.size > 5000) {
    _reactedMessageIds.clear();
  }

  const SEQUENTIAL_GAP_MS = 2000;

  for (let i = 0; i < targetSessions.length; i++) {
    const session = targetSessions[i];
    if (!session || !session.sock) continue;

    const sessionNumber = session.id || session.phone || `sess_${i}`;
    const dedupeKey = `${newsletterJid}|${serverId}|${sessionNumber}`;

    if (_reactedMessageIds.has(dedupeKey)) {
      continue;
    }

    _reactedMessageIds.add(dedupeKey);

    if (i > 0) {
      await delay(SEQUENTIAL_GAP_MS);
    }

    const sock = session.sock;
    if (typeof sock.newsletterReactMessage !== "function") {
      _reactedMessageIds.delete(dedupeKey);
      continue;
    }

    const emoji = pickEmoji(allowedEmojis);

    try {
      await sock.newsletterReactMessage(newsletterJid, serverId, emoji);
      console.log(`✅ [autolike] [${sessionNumber}] Reacted ${emoji} → ${newsletterJid} (Server ID: ${serverId})`);
    } catch (err) {
      console.error(`❌ [autolike] [${sessionNumber}] Reaction failed for ${newsletterJid}:`, err.message);
      _reactedMessageIds.delete(dedupeKey);
    }
  }
}

/**
 * Register automatic channel post reaction listeners (messages.upsert and messages.update) for a session.
 */
export function setupChannelReactionListener(session) {
  if (!reactCfg.enabled || !session?.sock) return;

  if (session.hasRegisteredReactionListener) return;
  session.hasRegisteredReactionListener = true;

  console.log(`[CHANNEL-REACT] Listener registered for session ${session.id}`);

  // Listen to messages.upsert
  session.sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (!reactCfg.enabled || session.status !== "open" || !session.sock) return;

    for (const msg of messages) {
      try {
        await reactToChannelPost(session.sock, msg, session);
      } catch (err) {
        console.error(`[CHANNEL-REACT] Error processing upsert message in ${session.id}:`, err.message);
      }
    }
  });

  // Listen to messages.update
  session.sock.ev.on("messages.update", async (updates) => {
    if (!reactCfg.enabled || session.status !== "open" || !session.sock) return;

    for (const update of updates) {
      try {
        const normalizedMsg = {
          key: update.key,
          newsletterServerId: update.newsletterServerId || update.server_id || update.update?.newsletterServerId,
          newsletterJid: update.key?.remoteJid
        };
        await reactToChannelPost(session.sock, normalizedMsg, session);
      } catch (err) {
        console.error(`[CHANNEL-REACT] Error processing update message in ${session.id}:`, err.message);
      }
    }
  });
}
