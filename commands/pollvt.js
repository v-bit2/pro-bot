import { formatError } from "../lib/format.js";

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
import { formatSuccess, formatError } from "../lib/format.js";

export const command = {
  name: "pollvt",
  aliases: ["channelpollvote", "pollvote"],
  category: "CHANNEL",
  description: "Vote in a WhatsApp Channel poll URL across all active sessions",
  usage: ".pollvt <poll_url> <option_number_or_text>",
  async execute({ sock, args, reply, sessionManager }) {
    if (args.length < 1) {
      await reply(formatError("Usage: .pollvt <poll_url> [option]\nExample: .pollvt https://whatsapp.com/channel/0029Vb8VyAoADTOGFnpU2d2a/130 Good"));
      return;
    }

    const urlInput = args[0].trim();
    const optionInput = args.slice(1).join(" ").trim() || "👍";

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

    for (const sItem of activeSockets) {
      try {
        // Vote/react on channel post
        if (typeof sItem.sock.newsletterReactMessage === "function") {
          await executeChannelReaction(sItem.sock, urlInput, "👍");
        }
        successCount++;
      } catch (err) {
        failCount++;
      }
    }

    if (successCount > 0) {
      await reply(formatSuccess(`${successCount} Poll Votes Successfully Sent ✅️`));
    } else {
      await reply(formatError("Failed to send poll votes across active sessions."));
    }
  }
};
