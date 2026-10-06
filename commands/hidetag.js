import { formatBox } from "../lib/format.js";

export const command = {
  name: "hidetag",
  aliases: ["htag"],
  category: "ADMIN",
  description: "Send a hidden mention message to all group members",
  usage: ".hidetag <message>",
  groupOnly: true,
  adminOnly: true,
  async execute({ sock, message, args, remoteJid }) {
    const groupMeta = await sock.groupMetadata(remoteJid);
    const participants = groupMeta.participants || [];
    const mentions = participants.map(p => p.id);
    const textStr = args.length > 0 ? args.join(" ") : "📢 Announcement";

    await sock.sendMessage(remoteJid, {
      text: formatBox("VOLTRA ANNOUNCEMENT", textStr),
      mentions
    }, { quoted: message });
  }
};
