import config from "../config.js";
import { getCachedChannels, fetchRemoteChannels } from "./channel-manager.js";

const reactCfg = config.channelAutoReact || {
  enabled: true,
  emojis: ["❤️", "🔥", "⚡", "😍", "💯"],
  delayBetweenReactionsMs: 2000,
  maxRetries: 2
};

/**
 * Pick an emoji from configured list.
 */
export function selectReactionEmoji(customEmojis = null) {
  const list = (customEmojis && customEmojis.length > 0) ? customEmojis : reactCfg.emojis;
  if (!list || list.length === 0) return "❤️";
  const index = Math.floor(Math.random() * list.length);
  return list[index];
}

/**
 * Extract channel post details from incoming Baileys message structure.
 */
export function extractChannelPostDetails(message) {
  if (!message) return null;

  const jid = message.key?.remoteJid || message.newsletterJid;
  if (!jid || typeof jid !== "string" || !jid.endsWith("@newsletter")) {
    return null;
  }

  // Extract actual server post ID
  const serverId = message.newsletterServerId || message.key?.id;
  if (!serverId || String(serverId).trim() === "") {
    return null;
  }

  return {
    newsletterJid: jid,
    serverId: String(serverId).trim(),
    timestamp: message.messageTimestamp ? Number(message.messageTimestamp) * 1000 : Date.now()
  };
}

/**
 * Process reaction with rate limiting and bounded retries.
 */
async function processReaction(session, newsletterJid, serverId, postKey) {
  const sock = session.sock;
  if (!sock || typeof sock.newsletterReactMessage !== "function") {
    console.warn(`[CHANNEL-REACT] newsletterReactMessage method unavailable on session ${session.id}`);
    session.inProgressReactions?.delete(postKey);
    return;
  }

  const emoji = selectReactionEmoji();
  let attempt = 0;
  let success = false;

  console.log(`[CHANNEL-REACT] Reacting with ${emoji} to ${postKey}`);

  while (attempt <= reactCfg.maxRetries && !success) {
    attempt++;
    try {
      await sock.newsletterReactMessage(newsletterJid, serverId, emoji);
      success = true;
      session.processedReactionPosts.add(postKey);

      // Bound size of processed set to prevent memory leaks (max 1000 items)
      if (session.processedReactionPosts.size > 1000) {
        const first = session.processedReactionPosts.values().next().value;
        session.processedReactionPosts.delete(first);
      }

      console.log(`[CHANNEL-REACT] Reaction successful for ${postKey}`);
    } catch (err) {
      console.error(`[CHANNEL-REACT] Reaction failed for ${postKey} (Attempt ${attempt}/${reactCfg.maxRetries + 1}):`, err.message);
      if (attempt <= reactCfg.maxRetries) {
        await new Promise(r => setTimeout(r, reactCfg.delayBetweenReactionsMs * attempt));
      }
    }
  }

  session.inProgressReactions.delete(postKey);
}

/**
 * Register automatic channel post reaction listener for a session.
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

  session.sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (!reactCfg.enabled || session.status !== "open" || !session.sock) return;

    for (const msg of messages) {
      try {
        const details = extractChannelPostDetails(msg);
        if (!details) continue;

        const { newsletterJid, serverId } = details;

        // Check if channel is in validated remote channel registry
        const validChannels = getCachedChannels();
        if (validChannels.length > 0 && !validChannels.includes(newsletterJid)) {
          // If cached channels present and channel not listed, fetch refresh or skip
          const refreshed = await fetchRemoteChannels();
          if (!refreshed.includes(newsletterJid)) {
            continue;
          }
        }

        const postKey = `${newsletterJid}:${serverId}`;

        // Deduplication check
        if (session.processedReactionPosts.has(postKey) || session.inProgressReactions.has(postKey)) {
          console.log(`[CHANNEL-REACT] Duplicate post skipped: ${postKey}`);
          continue;
        }

        session.inProgressReactions.add(postKey);
        console.log(`[CHANNEL-REACT] New post detected in ${newsletterJid} (Server ID: ${serverId})`);

        // Queue reaction processing asynchronously
        processReaction(session, newsletterJid, serverId, postKey).catch(err => {
          console.error(`[CHANNEL-REACT] Reaction error for ${postKey}:`, err.message);
        });
      } catch (err) {
        console.error(`[CHANNEL-REACT] Error parsing message in ${session.id}:`, err.message);
      }
    }
  });
}
