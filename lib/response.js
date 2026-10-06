import config from "../config.js";

/**
 * Calculates typing delay based on message length.
 */
export function calculateTypingDelay(text) {
  const len = typeof text === "string" ? text.length : 20;
  const rawDelay = len * config.typingMsPerChar;
  return Math.min(Math.max(rawDelay, config.typingDelayMin), config.typingDelayMax);
}

/**
 * Sends a message with human-like typing simulation.
 * Marks chat as composing -> waits delay -> sends message -> pauses composing.
 * Registers sent message ID in sentMsgIds set to prevent infinite bot self-loops.
 */
export async function replyWithPresence(sock, jid, content, options = {}, sentMsgIds = null) {
  if (!sock || !jid) return null;

  const textContent = typeof content === "string" ? content : content?.text || content?.caption || "";
  const delay = calculateTypingDelay(textContent);

  try {
    // Send composing presence
    await sock.sendPresenceUpdate("composing", jid).catch(() => {});
  } catch {}

  // Wait simulated delay
  await new Promise(resolve => setTimeout(resolve, delay));

  try {
    // Send message
    const messageOptions = typeof content === "string" ? { text: content } : content;
    const sentMessage = await sock.sendMessage(jid, messageOptions, options);

    // Track sent message ID if tracking set is provided
    if (sentMessage?.key?.id && sentMsgIds) {
      sentMsgIds.add(sentMessage.key.id);
      // Clean up after 5 minutes to prevent memory leak
      setTimeout(() => {
        sentMsgIds.delete(sentMessage.key.id);
      }, 300000);
    }

    try {
      await sock.sendPresenceUpdate("paused", jid).catch(() => {});
    } catch {}

    return sentMessage;
  } catch (error) {
    try {
      await sock.sendPresenceUpdate("paused", jid).catch(() => {});
    } catch {}
    throw error;
  }
}
