import { formatSuccess, formatError } from "../lib/format.js";

function getTargetJid(message, args) {
  const quoted = message.message?.extendedTextMessage?.contextInfo?.participant;
  if (quoted) return quoted;

  const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
  if (mentioned && mentioned.length > 0) return mentioned[0];

  if (args.length > 0) {
    const raw = args[0].replace(/\D/g, "");
    if (raw.length >= 7) return `${raw}@s.whatsapp.net`;
  }

  return null;
}

export const command = {
  name: "promote",
  aliases: ["admin"],
  category: "GROUP",
  description: "Promote a group member to administrator",
  usage: ".promote @user or reply to user message",
  groupOnly: true,
  adminOnly: true,
  botAdminRequired: true,
  async execute({ sock, message, args, reply, remoteJid }) {
    const target = getTargetJid(message, args);

    if (!target) {
      await reply(formatError("Please reply to a message or mention the user to promote."));
      return;
    }

    try {
      await sock.groupParticipantsUpdate(remoteJid, [target], "promote");
      const phone = target.split("@")[0];
      await reply(formatSuccess(`Promoted @${phone} to group administrator.`));
    } catch (err) {
      await reply(formatError(`Failed to promote user: ${err.message}`));
    }
  }
};
