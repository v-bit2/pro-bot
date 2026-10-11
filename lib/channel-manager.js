import config from "../config.js";

let cachedChannels = [];
let isRefreshing = false;
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
 * Fetch remote channels from channels.json endpoint with validation & cached fallback.
 */
export async function fetchRemoteChannels() {
  if (isRefreshing) return cachedChannels;
  isRefreshing = true;

  console.log("[CHANNELS] Fetching remote list");
  try {
    const res = await fetch(cfg.sourceUrl, {
      headers: { "User-Agent": "Voltra-ChannelFollow/1.0" },
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
    )).slice(0, 50); // Cap list at max 50 entries for safety

    if (validJids.length === 0 && rawList.length > 0) {
      console.warn("[CHANNELS] Endpoint returned no valid @newsletter JIDs; keeping previous list.");
    } else {
      console.log(`[CHANNELS] Loaded ${validJids.length} valid channels`);
      cachedChannels = validJids;
    }
  } catch (err) {
    console.error(`[CHANNELS] Remote refresh failed (${err.message}); keeping previous list`);
  } finally {
    isRefreshing = false;
  }

  return cachedChannels;
}

export function getCachedChannels() {
  return cachedChannels;
}
