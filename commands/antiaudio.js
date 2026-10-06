import { updateGroupSettings, getGroupSettings } from "../lib/db.js";
import { formatSuccess } from "../lib/format.js";

export const command = {
  name: "antiaudio",
  category: "ADMIN",
  description: "Toggle anti-audio voice note protection setting for group",
  usage: ".antiaudio",
  groupOnly: true,
  adminOnly: true,
  async execute({ reply, remoteJid }) {
    const current = getGroupSettings(remoteJid).antiaudio;
    const next = !current;
    updateGroupSettings(remoteJid, { antiaudio: next });
    await reply(formatSuccess(`Anti-Audio filter is now *${next ? "ENABLED" : "DISABLED"}*`));
  }
};
