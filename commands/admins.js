import { formatResponse } from "../lib/format.js";

export const command = {
  name: "admins",
  aliases: ["adminlist"],
  category: "GROUP",
  description: "List and mention group administrators",
  usage: ".admins",
  groupOnly: true,
  async execute({ sock, message, remoteJid }) {
    const groupMeta = await sock.groupMetadata(remoteJid);
    const participants = groupMeta.participants || [];
    const admins = participants.filter(p => p.admin === "admin" || p.admin === "superadmin");

    let body = `Group Administrators (${admins.length}):\n\n`;
    const mentions = [];

    for (const a of admins) {
      body += `• @${a.id.split("@")[0]}\n`;
      mentions.push(a.id);
    }

    const text = formatResponse(body.trim(), "GROUP");
    await sock.sendMessage(remoteJid, { text, mentions }, { quoted: message });
  }
};
