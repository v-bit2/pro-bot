import { formatResponse } from "../../lib/format.js";

export const command = {
  name: "query",
  aliases: ["gcquery", "groupmeta", "inspectgc"],
  category: "ADMIN",
  description: "Inspect detailed group metadata and settings (.query)",
  usage: ".query",
  groupOnly: true,
  adminOnly: true,
  async execute({ isGroup, groupMeta, remoteJid, reply }) {
    if (!isGroup || !groupMeta) {
      await reply("Group metadata unavailable.");
      return;
    }

    const participants = groupMeta.participants || [];
    const admins = participants.filter(p => p.admin === "admin" || p.admin === "superadmin");
    const createdDate = groupMeta.creation ? new Date(groupMeta.creation * 1000).toLocaleString() : "Unknown";

    const content =
      `├─ Group Name: ${groupMeta.subject || "Unknown"}\n` +
      `├─ Group JID: ${remoteJid}\n` +
      `├─ Members Count: ${participants.length}\n` +
      `├─ Admin Count: ${admins.length}\n` +
      `├─ Created At: ${createdDate}\n` +
      `└─ Description: ${groupMeta.desc || "None"}`;

    await reply(formatResponse("𝖦𝖱𝖮𝖴𝖯 𝖬𝖖𝖳𝖠𝖣𝖠𝖳𝖠", content));
  }
};
