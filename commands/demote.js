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
  name: "demote",
  aliases: ["unadmin"],
  category: "GROUP",
  description: "Demote an administrator to normal group member",
  usage: ".demote @user or reply to user message",
  groupOnly: true,
  adminOnly: true,
  botAdminRequired: true,
  async execute({ sock, message, args, reply, remoteJid }) {
    const target = getTargetJid(message, args);

    if (!target) {
      await reply(formatError("Please reply to a message or mention the administrator to demote."));
      return;
    }

    try {
      await sock.groupParticipantsUpdate(remoteJid, [target], "demote");
      const phone = target.split("@")[0];
      await reply(formatSuccess(`Demoted @${phone} to regular member.`));
    } catch (err) {
      await reply(formatError(`Failed to demote user: ${err.message}`));
    }
  }
};
