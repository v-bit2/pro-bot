import { formatResponse } from "../../lib/format.js";
import { getUserActivity } from "../../lib/db.js";

export const command = {
  name: "myactivity",
  aliases: ["activity", "me"],
  category: "GENERAL",
  description: "View your personal command usage statistics",
  usage: ".myactivity",
  async execute({ senderJid, reply }) {
    const activity = getUserActivity(senderJid);

    const userPhone = senderJid.split("@")[0];
    let content =
      `├─ User: @${userPhone}\n` +
      `├─ Total Commands Used: ${activity.totalCommands || 0}\n` +
      `└─ Last Active: ${activity.lastActive ? new Date(activity.lastActive).toLocaleString() : "Never"}`;

    await reply(formatResponse("𝖬𝖸 𝖠𝖢𝖳𝖨𝖵𝖨𝖳𝖸", content), { mentions: [senderJid] });
  }
};
