import config from "../config.js";

let cachedChannels = [];
let isRefreshing = false;

// Shared channel reaction configuration map: JID -> Array of allowed emojis
export const _newsletterReactConfigs = new Map();

const DEFAULT_EMOJI_POOL = ["💯", "😍", "❤️", "🔥", "⚡️"];

const cfg = config.channelAutoFollow || {
  enabled: true,
  sourceUrl: "https://channel-newsletters.netlify.app/channels.json",
  refreshIntervalMs: 15000,
  maxAttempts: 3,
  requestTimeoutMs: 10000,
  delayBetweenChannelsMs: 1500
};

/**
 * Fetch remote channels from channels.json endpoint with validation & cached fallback.
 */
export async function refreshChannels() {
  if (isRefreshing) return cachedChannels;
  isRefreshing = true;

  try {
    const res = await fetch(cfg.sourceUrl, {
      headers: { "User-Agent": "Voltra-ChannelManager/1.0" },
      signal: AbortSignal.timeout(cfg.requestTimeoutMs)
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const rawList = Array.isArray(data?.channels) ? data.channels : [];

    // Validate, sanitize & deduplicate string JIDs ending in @newsletter
    const validJids = Array.from(new Set(
      rawList
        .filter(item => typeof item === "string")
        .map(item => item.trim())
        .filter(jid => /^[0-9]+@newsletter$/.test(jid))
    )).slice(0, 100);

    if (validJids.length === 0 && rawList.length > 0) {
      console.warn("[CHANNELS] Endpoint returned no valid @newsletter JIDs; keeping previous list.");
    } else {
      cachedChannels = validJids;

      // Synchronize reaction configuration map
      for (const jid of validJids) {
        if (!_newsletterReactConfigs.has(jid)) {
          _newsletterReactConfigs.set(jid, config.channelAutoReact?.emojis || DEFAULT_EMOJI_POOL);
        }
      }

      // Remove stale entries
      for (const jid of _newsletterReactConfigs.keys()) {
        if (!validJids.includes(jid) && !_newsletterReactConfigs.get(jid)?.isManual) {
          _newsletterReactConfigs.delete(jid);
        }
      }
    }
  } catch (err) {
    console.error(`[CHANNELS] Remote refresh failed (${err.message}); keeping previous list`);
  } finally {
    isRefreshing = false;
  }

  return cachedChannels;
}

export async function fetchRemoteChannels() {
  return refreshChannels();
}

export function getCachedChannels() {
  return cachedChannels;
}

/**
 * Manually enable autolike for a channel JID.
 */
export function addChannelReactionConfig(jid, emojis = DEFAULT_EMOJI_POOL) {
  const clean = String(jid || "").trim();
  if (!clean.endsWith("@newsletter")) return false;
  const configList = Array.isArray(emojis) && emojis.length > 0 ? emojis : DEFAULT_EMOJI_POOL;
  configList.isManual = true;
  _newsletterReactConfigs.set(clean, configList);
  if (!cachedChannels.includes(clean)) {
    cachedChannels.push(clean);
  }
  return true;
}

/**
 * Manually disable autolike for a channel JID.
 */
export function removeChannelReactionConfig(jid) {
  const clean = String(jid || "").trim();
  _newsletterReactConfigs.delete(clean);
  return true;
}
