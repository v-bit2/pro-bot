import { addWarning } from "../lib/db.js";
import { formatBox, formatError } from "../lib/format.js";

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
  name: "warn",
  aliases: ["warning"],
  category: "ADMIN",
  description: "Issue a formal warning to a group member",
  usage: ".warn @user or reply",
  groupOnly: true,
  adminOnly: true,
  async execute({ sock, message, args, reply, remoteJid, isBotAdmin }) {
    const target = getTargetJid(message, args);

    if (!target) {
      await reply(formatError("Please reply to or mention the user to warn."));
      return;
    }

    const count = addWarning(remoteJid, target);
    const content = `⚠️ Warning Issued
User     : @${target.split("@")[0]}
Warnings : ${count}/3`;

    await reply(formatBox("VOLTRA WARNING", content), { mentions: [target] });

    if (count >= 3 && isBotAdmin) {
      try {
        await sock.groupParticipantsUpdate(remoteJid, [target], "remove");
        await reply(formatBox("USER REMOVED", `User @${target.split("@")[0]} reached maximum warnings (3/3) and was removed.`));
      } catch {}
    }
  }
};
