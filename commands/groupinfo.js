import { formatResponse } from "../lib/format.js";

export const command = {
  name: "groupinfo",
  aliases: ["gcinfo", "ginfo"],
  category: "GROUP",
  description: "Display metadata and information about the current group",
  usage: ".groupinfo",
  groupOnly: true,
  async execute({ sock, reply, remoteJid }) {
    const meta = await sock.groupMetadata(remoteJid);
    const participants = meta.participants || [];
    const admins = participants.filter(p => p.admin === "admin" || p.admin === "superadmin");
    const creationDate = meta.creation ? new Date(meta.creation * 1000).toLocaleDateString() : "Unknown";

    const body = `✦ 👥 *Name:* ${meta.subject}
✦ 🆔 *Group ID:* ${meta.id}
✦ 👥 *Members:* ${participants.length}
✦ 🛡️ *Admins:* ${admins.length}
✦ 📅 *Created:* ${creationDate}
✦ 📝 *Description:* ${meta.desc ? meta.desc.toString() : "No description"}`;

    await reply(formatResponse(body, "GROUP INFO"));
  }
};
