import { resetWarnings } from "../lib/db.js";
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
  name: "resetwarn",
  aliases: ["clearwarn", "unwarn"],
  category: "ADMIN",
  description: "Reset warning count for a group member",
  usage: ".resetwarn @user or reply",
  groupOnly: true,
  adminOnly: true,
  async execute({ message, args, reply, remoteJid }) {
    const target = getTargetJid(message, args);

    if (!target) {
      await reply(formatError("Please reply to or mention the user to reset warnings."));
      return;
    }

    resetWarnings(remoteJid, target);
    await reply(formatSuccess(`Warnings cleared for @${target.split("@")[0]}`), { mentions: [target] });
  }
};
