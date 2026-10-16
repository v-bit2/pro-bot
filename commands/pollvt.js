import { formatSuccess, formatError } from "../lib/format.js";

/**
 * Parse WhatsApp Channel poll URL:
 * e.g. https://whatsapp.com/channel/CHANNEL_ID/POLL_ID
 */
function parsePollUrl(urlStr) {
  if (!urlStr || typeof urlStr !== "string") return null;

  const match = urlStr.trim().match(/whatsapp\.com\/channel\/([a-zA-Z0-9_-]+)(?:\/([0-9]+))?/i);
  if (!match) return null;

  const channelId = match[1];
  const pollId = match[2];

  const newsletterJid = channelId.endsWith("@newsletter")
    ? channelId
    : (channelId.includes("@") ? channelId : `${channelId}@newsletter`);

  return {
    newsletterJid,
    pollId: pollId || null
  };
}

import { executeChannelReaction } from "./chreact.js";

export const command = {
  name: "pollvt",
  aliases: ["channelpollvote", "pollvote"],
  category: "CHANNEL",
  description: "Vote in a WhatsApp Channel poll URL across all active sessions",
  usage: ".pollvt <poll_url> [option]",
  async execute({ sock, args, reply, sessionManager }) {
    if (args.length < 1) {
      await reply(formatError("Usage: .pollvt <poll_url> [option_text_or_number]\nExample: .pollvt https://whatsapp.com/channel/0029Vb8VyAoADTOGFnpU2d2a/130 Option 1"));
      return;
    }

    const urlInput = args[0].trim();
    const optionInput = args.slice(1).join(" ").trim();

    const parsed = parsePollUrl(urlInput);
    if (!parsed || !parsed.pollId) {
      await reply(formatError("Invalid channel poll URL. Please provide a full poll link including message ID."));
      return;
    }

    // Collect all active sessions
    let activeSockets = [];
    if (sessionManager && typeof sessionManager.getConnectedSessions === "function") {
      const sessions = sessionManager.getConnectedSessions();
      activeSockets = sessions.map(s => ({ id: s.id, sock: s.sock })).filter(s => s.sock);
    }

    if (activeSockets.length === 0) {
      activeSockets = [{ id: "current", sock }];
    }

    let successCount = 0;
    let failCount = 0;

    // Inspect Baileys capabilities for channel poll voting without in-chat pollEncKey
    await reply(formatError(
      `[Technical Limitation] Cannot vote on channel poll ${parsed.pollId} directly via URL.\n\n` +
      `WhatsApp Channel poll voting requires the full encrypted poll message context and pollEncKey, which cannot be retrieved from a URL without in-chat channel message context.`
    ));
  }
};
