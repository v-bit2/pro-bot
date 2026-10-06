import { formatBox } from "../lib/format.js";

export const command = {
  name: "groupstats",
  aliases: ["gstats"],
  category: "GENERAL",
  description: "Display group member counts, admin metrics, and creation details",
  usage: ".groupstats",
  groupOnly: true,
  async execute({ sock, reply, remoteJid }) {
    const meta = await sock.groupMetadata(remoteJid);
    const participants = meta.participants || [];
    const admins = participants.filter(p => p.admin === "admin" || p.admin === "superadmin");
    const superAdmins = participants.filter(p => p.admin === "superadmin");
    const regular = participants.length - admins.length;

    const content = `Group Subject : ${meta.subject}
Total Members : ${participants.length}
Admins        : ${admins.length} (Super: ${superAdmins.length})
Regular Users : ${regular}
Created On    : ${meta.creation ? new Date(meta.creation * 1000).toLocaleDateString() : "Unknown"}`;

    await reply(formatBox("GROUP STATISTICS", content));
  }
};
