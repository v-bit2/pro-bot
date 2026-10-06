import { updateGroupSettings, getGroupSettings } from "../lib/db.js";
import { formatSuccess } from "../lib/format.js";

export const command = {
  name: "goodbye",
  aliases: ["togglegoodbye"],
  category: "ADMIN",
  description: "Toggle automatic goodbye message for members leaving the group",
  usage: ".goodbye",
  groupOnly: true,
  adminOnly: true,
  async execute({ reply, remoteJid }) {
    const current = getGroupSettings(remoteJid).goodbye;
    const next = !current;
    updateGroupSettings(remoteJid, { goodbye: next });
    await reply(formatSuccess(`Goodbye message is now *${next ? "ENABLED" : "DISABLED"}*`));
  }
};
