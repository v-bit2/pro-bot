import { formatSuccess, formatError } from "../lib/format.js";

function getTargetJid(message, args) {
  const quoted = message.message?.extendedTextMessage?.contextInfo?.participant;
  if (quoted) return quoted;
  const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
  if (mentioned?.length) return mentioned[0];
  if (args.length > 0) {
    const raw = args[0].replace(/\D/g, "");
    if (raw.length >= 7) return `${raw}@s.whatsapp.net`;
  }
  return null;
}

export const command = {
  name: "unblock",
  aliases: ["unblockuser"],
  category: "OWNER",
  description: "Unblock a user on WhatsApp",
  usage: ".unblock @user or reply to user message",
  ownerOnly: true,
  async execute({ sock, message, args, reply }) {
    const target = getTargetJid(message, args);
    if (!target) {
      await reply(formatError("Please mention or reply to the user to unblock."));
      return;
    }

    try {
      await sock.updateBlockStatus(target, "unblock");
      await reply(formatSuccess(`Unblocked @${target.split("@")[0]}`));
    } catch (err) {
      await reply(formatError(`Failed to unblock user: ${err.message}`));
    }
  }
};
