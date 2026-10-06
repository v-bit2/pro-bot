import { formatError } from "../lib/format.js";

function getTargetJid(message, args) {
  const quoted = message.message?.extendedTextMessage?.contextInfo?.participant;
  if (quoted) return quoted;
  const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
  if (mentioned?.length) return mentioned[0];
  if (args.length > 0) {
    const raw = args[0].replace(/\D/g, "");
    if (raw.length >= 7) return `${raw}@s.whatsapp.net`;
  }
  return message.key?.participant || message.key.remoteJid;
}

export const command = {
  name: "getpp",
  aliases: ["pp", "profilepic"],
  category: "GENERAL",
  description: "Retrieve profile picture of mentioned/quoted user or chat",
  usage: ".getpp [@user or reply]",
  async execute({ sock, message, args, reply, remoteJid }) {
    const targetJid = getTargetJid(message, args);

    try {
      const ppUrl = await sock.profilePictureUrl(targetJid, "image");
      if (!ppUrl) {
        await reply(formatError("Profile picture is not available or hidden by privacy settings."));
        return;
      }

      await sock.sendMessage(remoteJid, { image: { url: ppUrl }, caption: `🖼️ Profile picture of @${targetJid.split("@")[0]}`, mentions: [targetJid] }, { quoted: message });
    } catch (err) {
      await reply(formatError("Profile picture unavailable or restricted by privacy settings."));
    }
  }
};
