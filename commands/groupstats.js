import { formatResponse, formatGroupOnly } from "../lib/format.js";

export const command = {
  name: "groupstats",
  aliases: ["gstats"],
  category: "GROUP",
  description: "Display group statistics and participant metrics",
  usage: ".groupstats",
  groupOnly: true,
  async execute({ isGroup, groupMeta, reply }) {
    if (!isGroup || !groupMeta) {
      await reply(formatGroupOnly("groupstats"));
      return;
    }

    const participants = groupMeta.participants || [];
    const admins = participants.filter(p => p.admin === "admin" || p.admin === "superadmin");
    const members = participants.filter(p => !p.admin);

    const content =
      `├─ Group Name: ${groupMeta.subject}\n` +
      `├─ Total Members: ${participants.length}\n` +
      `├─ Administrators: ${admins.length}\n` +
      `└─ Regular Members: ${members.length}`;

    await reply(formatResponse("𝖦𝖱𝖮𝖴𝖯 𝖲𝖳𝖠𝖳𝖲", content));
  }
};
