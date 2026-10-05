import { formatResponse } from "../lib/format.js";

export const command = {
  name: "tagall",
  aliases: ["everyone", "all"],
  category: "GROUP",
  description: "Mention all members in the group",
  usage: ".tagall [message]",
  groupOnly: true,
  adminOnly: true,
  async execute({ sock, message, args, remoteJid }) {
    const groupMeta = await sock.groupMetadata(remoteJid);
    const participants = groupMeta.participants || [];
    const customText = args.length > 0 ? args.join(" ") : "Calling everyone...";

    let body = `${customText}\n\n`;
    const mentions = [];

    for (const p of participants) {
      body += `@${p.id.split("@")[0]}\n`;
      mentions.push(p.id);
    }

    const text = formatResponse(body.trim(), "GROUP");
    await sock.sendMessage(remoteJid, { text, mentions }, { quoted: message });
  }
};
