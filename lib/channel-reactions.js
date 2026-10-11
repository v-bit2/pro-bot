import config from "../config.js";
import { getCachedChannels, fetchRemoteChannels, _newsletterReactConfigs } from "./channel-manager.js";

const DEFAULT_EMOJIS = ["💯", "😍", "❤️", "🔥", "⚡️"];

const reactCfg = config.channelAutoReact || {
  enabled: true,
  emojis: DEFAULT_EMOJIS,
  delayBetweenReactionsMs: 2000,
  maxRetries: 2
};

export function randomEmoji(customEmojis = null) {
  const list = (customEmojis && customEmojis.length > 0) ? customEmojis : (reactCfg.emojis || DEFAULT_EMOJIS);
  if (!list || list.length === 0) return "❤️";
  const index = Math.floor(Math.random() * list.length);
  return list[index];
}

export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function randomReactDelay(minMs = 2000, maxMs = 5000) {
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

  return String(candidate).trim();
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
 * Central reactToChannelPost handling reactions across session sockets.
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

  const sessionNumber = originSession?.id || "session";
  const postKey = `${newsletterJid}|${serverId}|${sessionNumber}`;

  if (!originSession.processedReactionPosts) {
    originSession.processedReactionPosts = new Set();
  }
  if (!originSession.inProgressReactions) {
    originSession.inProgressReactions = new Set();
  }

  if (originSession.processedReactionPosts.has(postKey) || originSession.inProgressReactions.has(postKey)) {
    return;
  }

  originSession.inProgressReactions.add(postKey);
  console.log(`[CHANNEL-REACT] New post detected in ${newsletterJid} (Server ID: ${serverId})`);

  const sock = originSession.sock || originSock;
  if (!sock || typeof sock.newsletterReactMessage !== "function") {
    console.warn(`[CHANNEL-REACT] newsletterReactMessage method unavailable on session ${sessionNumber}`);
    originSession.inProgressReactions.delete(postKey);
    return;
  }

  // Random reaction delay between 2000ms and 5000ms
  const initialDelay = randomReactDelay();
  await delay(initialDelay);

  const allowedEmojis = _newsletterReactConfigs.get(newsletterJid) || reactCfg.emojis || DEFAULT_EMOJIS;
  const emoji = randomEmoji(allowedEmojis);

  let attempt = 0;
  let success = false;

  console.log(`[CHANNEL-REACT] Reacting with ${emoji} to ${postKey}`);

  while (attempt <= (reactCfg.maxRetries || 2) && !success) {
    attempt++;
    try {
      await sock.newsletterReactMessage(newsletterJid, serverId, emoji);
      success = true;
      originSession.processedReactionPosts.add(postKey);

      // Bound size of processed set to prevent memory leaks (max 1000 items)
      if (originSession.processedReactionPosts.size > 1000) {
        const first = originSession.processedReactionPosts.values().next().value;
        originSession.processedReactionPosts.delete(first);
      }

      console.log(`[CHANNEL-REACT] Reaction successful for ${postKey}`);
    } catch (err) {
      console.error(`[CHANNEL-REACT] Reaction failed for ${postKey} (Attempt ${attempt}/${reactCfg.maxRetries + 1}):`, err.message);
      if (attempt <= reactCfg.maxRetries) {
        await delay((reactCfg.delayBetweenReactionsMs || 2000) * attempt);
      }
    }
  }

  originSession.inProgressReactions.delete(postKey);
}

/**
 * Register automatic channel post reaction listeners (messages.upsert and messages.update) for a session.
 */
export function setupChannelReactionListener(session) {
  if (!reactCfg.enabled || !session?.sock) return;

  if (session.hasRegisteredReactionListener) return;
  session.hasRegisteredReactionListener = true;

  if (!session.processedReactionPosts) {
    session.processedReactionPosts = new Set();
  }
  if (!session.inProgressReactions) {
    session.inProgressReactions = new Set();
  }

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
