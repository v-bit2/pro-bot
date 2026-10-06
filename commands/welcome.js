import { updateGroupSettings, getGroupSettings } from "../lib/db.js";
import { formatSuccess } from "../lib/format.js";

export const command = {
  name: "welcome",
  aliases: ["togglewelcome"],
  category: "ADMIN",
  description: "Toggle automatic welcome message for new members joining the group",
  usage: ".welcome",
  groupOnly: true,
  adminOnly: true,
  async execute({ reply, remoteJid }) {
    const current = getGroupSettings(remoteJid).welcome;
    const next = !current;
    updateGroupSettings(remoteJid, { welcome: next });
    await reply(formatSuccess(`Welcome message is now *${next ? "ENABLED" : "DISABLED"}*`));
  }
};
