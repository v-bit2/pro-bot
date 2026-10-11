import { randomEmoji } from "../lib/channel-reactions.js";
import { formatSuccess, formatError } from "../lib/format.js";

/**
 * Parse WhatsApp channel post URL:
 * e.g. https://whatsapp.com/channel/0029VaXXXXXXXXXX/101
 */
export function parseChannelPostUrl(urlStr) {
  if (!urlStr || typeof urlStr !== "string") return null;

  const match = urlStr.trim().match(/whatsapp\.com\/channel\/([a-zA-Z0-9_-]+)(?:\/([0-9]+))?/i);
  if (!match) return null;

  const channelIdOrCode = match[1];
  const postId = match[2];

  return {
    channelIdOrCode,
    serverId: postId || null
  };
}

/**
 * Perform channel reaction using Baileys newsletterMetadata and newsletterReactMessage
 */
export async function executeChannelReaction(sock, urlInput, customEmoji = null) {
  const parsed = parseChannelPostUrl(urlInput);
  if (!parsed || !parsed.serverId) {
    throw new Error("Invalid channel post URL. Please provide a full post link including post ID, e.g. https://whatsapp.com/channel/0029VaXXXXXX/101");
  }

  if (typeof sock.newsletterReactMessage !== "function") {
    throw new Error("The installed Baileys version does not expose newsletterReactMessage.");
  }

  let newsletterJid = parsed.channelIdOrCode;

  // If channelIdOrCode is an invite code (like 0029VaXXXXXX) rather than numeric@newsletter
  if (!newsletterJid.endsWith("@newsletter")) {
    if (typeof sock.newsletterMetadata === "function") {
      try {
        const meta = await sock.newsletterMetadata("invite", newsletterJid);
        if (meta?.id) {
          newsletterJid = meta.id.endsWith("@newsletter") ? meta.id : `${meta.id}@newsletter`;
        } else {
          newsletterJid = `${newsletterJid}@newsletter`;
        }
      } catch (err) {
        console.warn(`[ChReact] Could not resolve invite metadata for ${newsletterJid}, appending @newsletter fallback...`);
        newsletterJid = `${newsletterJid}@newsletter`;
      }
    } else {
      newsletterJid = `${newsletterJid}@newsletter`;
    }
  }

  const emoji = customEmoji || randomEmoji();
  await sock.newsletterReactMessage(newsletterJid, parsed.serverId, emoji);

  return {
    newsletterJid,
    serverId: parsed.serverId,
    emoji
  };
}

export const command = {
  name: "chreact",
  aliases: ["chreat", "channelreact", "reactch"],
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
    const emojiInput = args[1] ? args[1].trim() : null;

    try {
      const res = await executeChannelReaction(sock, urlInput, emojiInput);
      await reply(formatSuccess(`Successfully reacted with ${res.emoji} to channel post *${res.serverId}* (${res.newsletterJid})!`));
    } catch (err) {
      await reply(formatError(`Failed to react to channel post: ${err.message || err}`));
    }
  }
};
