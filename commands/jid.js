import { formatResponse, formatError } from "../lib/format.js";

/**
 * Parse WhatsApp Channel invite link or code.
 * e.g. https://whatsapp.com/channel/0029VaXXXXXXXXXX or 0029VaXXXXXXXXXX
 */
export function parseChannelInviteCode(inputStr) {
  if (!inputStr || typeof inputStr !== "string") return null;
  const match = inputStr.trim().match(/(?:whatsapp\.com\/channel\/)?([a-zA-Z0-9_-]{10,})/i);
  return match ? match[1] : null;
}

export const command = {
  name: "jid",
  aliases: ["channeljid", "newsletterjid", "cjid"],
  category: "CHANNEL",
  description: "Get the newsletterJid and metadata of a WhatsApp Channel using its invite link or code",
  usage: ".jid <channel_url_or_code>",
  async execute({ sock, args, reply, message }) {
    // Check if input is provided in args or quoted text
    let input = args.length > 0 ? args.join(" ") : "";

    if (!input && message?.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
      const q = message.message.extendedTextMessage.contextInfo.quotedMessage;
      input = q.conversation || q.extendedTextMessage?.text || "";
    }

    const inviteCode = parseChannelInviteCode(input);

    if (!inviteCode) {
      await reply(formatError("Please provide a valid WhatsApp Channel link or code.\n\nExample: .jid https://whatsapp.com/channel/0029VaXXXXXX"));
      return;
    }

    if (typeof sock.newsletterMetadata !== "function") {
      await reply(formatError("The installed Baileys library does not support newsletter metadata lookup."));
      return;
    }

    try {
      const meta = await sock.newsletterMetadata("invite", inviteCode);

      if (!meta || !meta.id) {
        await reply(formatError("Could not retrieve channel metadata for the provided link/code."));
        return;
      }

      const newsletterJid = meta.id.endsWith("@newsletter") ? meta.id : `${meta.id}@newsletter`;
      await sock.sendMessage(message.key.remoteJid, { text: newsletterJid }, { quoted: message });
    } catch (err) {
      console.error("[JID Command] Error fetching channel metadata:", err);
      await reply(formatError(`Failed to fetch channel JID: ${err.message || err}`));
    }
  }
};
