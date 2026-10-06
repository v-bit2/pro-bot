import { formatSuccess, formatError } from "../lib/format.js";

function getTargetJid(message, args) {
  // Quoted message
  const quoted = message.message?.extendedTextMessage?.contextInfo?.participant;
  if (quoted) return quoted;

  // Mentioned JID
  const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
  if (mentioned && mentioned.length > 0) return mentioned[0];

  // Raw args phone number
  if (args.length > 0) {
    const raw = args[0].replace(/\D/g, "");
    if (raw.length >= 7) return `${raw}@s.whatsapp.net`;
  }

  return null;
}

export const command = {
  name: "kick",
  aliases: ["remove"],
  category: "GROUP",
  description: "Remove a user from the group",
  usage: ".kick @user or reply to user message",
  groupOnly: true,
  adminOnly: true,
  botAdminRequired: true,
  async execute({ sock, message, args, reply, remoteJid }) {
    const target = getTargetJid(message, args);

    if (!target) {
      await reply(formatError("Please reply to a message or mention the user to remove."));
      return;
    }

    try {
      await sock.groupParticipantsUpdate(remoteJid, [target], "remove");
      const phone = target.split("@")[0];
      await reply(formatSuccess(`Removed @${phone} from the group.`));
    } catch (err) {
      await reply(formatError(`Failed to remove user: ${err.message}`));
    }
  }
};
