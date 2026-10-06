import fs from "node:fs";
import path from "node:path";
import config from "../config.js";
import { getSettings } from "./db.js";
import { formatBox, splitBox } from "./format.js";

/**
 * Calculate dynamic human-like typing delay based on text character count.
 */
export function calculateTypingDelay(text) {
  const len = typeof text === "string" ? text.length : 20;
  const rawDelay = len * config.typingMsPerChar;
  return Math.min(Math.max(rawDelay, config.typingDelayMin), config.typingDelayMax);
}

/**
 * Universal response sender for Voltra Mini commands.
 */
export async function sendBotResponse(sock, jid, {
  title = null,
  content = "",
  image = false,
  imagePath = null,
  quoted = null,
  mentions = [],
  sentMsgIds = null
}) {
  if (!sock || !jid) return null;

  const settings = getSettings();
  const boxTitle = title || settings.botName || "VOLTRA MINI";

  // Presence simulation if autoTyping enabled or for commands
  const delay = calculateTypingDelay(content);
  try {
    await sock.sendPresenceUpdate("composing", jid).catch(() => {});
  } catch {}

  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  const chunks = splitBox(boxTitle, content);
  let lastSent = null;

  for (let i = 0; i < chunks.length; i++) {
    const chunkText = chunks[i];
    let payload = { text: chunkText, mentions };

    // Attach bot/menu image if requested on first chunk
    if (i === 0 && image) {
      const imgFile = imagePath || settings.menuImage || settings.botImage || "./assets/voltra-mini.jpg";
      if (fs.existsSync(imgFile)) {
        payload = {
          image: fs.readFileSync(imgFile),
          caption: chunkText,
          mentions
        };
      }
    }

    try {
      const sent = await sock.sendMessage(jid, payload, { quoted });
      if (sent?.key?.id && sentMsgIds) {
        sentMsgIds.add(sent.key.id);
        setTimeout(() => sentMsgIds.delete(sent.key.id), 300000);
      }
      lastSent = sent;
    } catch (err) {
      console.error("[Response Error] Failed to send bot response:", err);
    }
  }

  try {
    await sock.sendPresenceUpdate("paused", jid).catch(() => {});
  } catch {}

  return lastSent;
}
