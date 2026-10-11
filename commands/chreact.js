import { randomEmoji } from "../lib/channel-reactions.js";
import { formatSuccess, formatError } from "../lib/format.js";

/**
 * Parse WhatsApp channel post URL:
 * e.g. https://whatsapp.com/channel/0029VaXXXXXXXXXX/123
 */
function parseChannelPostUrl(urlStr) {
  if (!urlStr || typeof urlStr !== "string") return null;

  const match = urlStr.trim().match(/whatsapp\.com\/channel\/([a-zA-Z0-9_-]+)(?:\/([0-9]+))?/i);
  if (!match) return null;

  const channelId = match[1];
  const postId = match[2];

  // If channelId is numeric and ends with @newsletter or is a code
  const newsletterJid = channelId.endsWith("@newsletter")
    ? channelId
    : (channelId.includes("@") ? channelId : `${channelId}@newsletter`);

  return {
    newsletterJid,
    serverId: postId || null
  };
}

export const command = {
  name: "chreact",
  aliases: ["channelreact", "reactch"],
  category: "OWNER",
  description: "React to a specific WhatsApp Channel post by URL",
  usage: ".chreact <channel_post_url> [emoji]",
  ownerOnly: true,
  async execute({ sock, args, reply }) {
    if (args.length === 0) {
      await reply(formatError("Usage: .chreact <channel_post_url> [emoji]\nExample: .chreact https://whatsapp.com/channel/0029VaXXXXXX/101 🔥"));
      return;
    }

    const urlInput = args[0].trim();
    const emojiInput = args[1] ? args[1].trim() : randomEmoji();

    const parsed = parseChannelPostUrl(urlInput);
    if (!parsed || !parsed.serverId) {
      await reply(formatError("Invalid channel post URL. Please provide a full post link including the post ID, e.g. https://whatsapp.com/channel/CHANNEL_ID/POST_ID"));
      return;
    }

    if (typeof sock.newsletterReactMessage !== "function") {
      await reply(formatError("The installed Baileys version does not expose the newsletterReactMessage API method."));
      return;
    }

    try {
      await sock.newsletterReactMessage(parsed.newsletterJid, parsed.serverId, emojiInput);
      await reply(formatSuccess(`Successfully reacted with ${emojiInput} to channel post *${parsed.serverId}*!`));
    } catch (err) {
      await reply(formatError(`Failed to react to channel post: ${err.message || err}`));
    }
  }
};
