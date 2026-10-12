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

export const command = {
  name: "pollvt",
  aliases: ["channelpollvote", "pollvote"],
  category: "CHANNEL",
  description: "Vote in a WhatsApp Channel poll URL",
  usage: ".pollvt <poll_url> <option_number_or_text>",
  ownerOnly: true,
  async execute({ sock, args, reply }) {
    if (args.length < 2) {
      await reply(formatError("Usage: .pollvt <poll_url> <option>\nExample: .pollvt https://whatsapp.com/channel/0029VaXXXXXX/101 2"));
      return;
    }

    const urlInput = args[0].trim();
    const optionInput = args.slice(1).join(" ").trim();

    const parsed = parsePollUrl(urlInput);
    if (!parsed || !parsed.pollId) {
      await reply(formatError("Invalid channel poll URL. Please provide a full poll link including the poll message ID."));
      return;
    }

    // Inspect Baileys capabilities for channel poll voting without subscription context
    await reply(formatError(
      `[Technical Limitation] Cannot vote on channel poll ${parsed.pollId} directly via URL.\n\n` +
      `WhatsApp Channel poll voting requires the full encrypted poll message context and pollEncKey, which cannot be retrieved from a URL without channel subscription context.`
    ));
  }
};
