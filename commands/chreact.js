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
  category: "CHANNEL",
  description: "React to a specific WhatsApp Channel post by URL across all active sessions",
  usage: ".chreact <channel_post_url> [emoji]",
  ownerOnly: true,
  async execute({ sock, args, reply, sessionManager }) {
    if (args.length === 0) {
      await reply(formatError("Usage: .chreact <channel_post_url> [emoji]\nExample: .chreact https://whatsapp.com/channel/0029VaXXXXXX/101 🔥"));
      return;
    }

    const urlInput = args[0].trim();
    const emojiInput = args[1] ? args[1].trim() : null;

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
    let lastResult = null;
    let errors = [];

    for (const sItem of activeSockets) {
      try {
        const res = await executeChannelReaction(sItem.sock, urlInput, emojiInput);
        lastResult = res;
        successCount++;
      } catch (err) {
        failCount++;
        errors.push(`${sItem.id}: ${err.message || err}`);
      }
    }

    if (successCount > 0) {
      let msg = `Successfully reacted with ${lastResult.emoji} to channel post *${lastResult.serverId}* across *${successCount}/${activeSockets.length}* connected session(s)!`;
      if (failCount > 0) {
        msg += `\n\n⚠️ ${failCount} session(s) failed.`;
      }
      await reply(formatSuccess(msg));
    } else {
      await reply(formatError(`Failed to react across all sessions:\n${errors.join("\n")}`));
    }
  }
};
