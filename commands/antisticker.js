import { updateGroupSettings, getGroupSettings } from "../lib/db.js";
import { formatSuccess } from "../lib/format.js";

export const command = {
  name: "antisticker",
  category: "ADMIN",
  description: "Toggle anti-sticker protection setting for group",
  usage: ".antisticker",
  groupOnly: true,
  adminOnly: true,
  async execute({ reply, remoteJid }) {
    const current = getGroupSettings(remoteJid).antisticker;
    const next = !current;
    updateGroupSettings(remoteJid, { antisticker: next });
    await reply(formatSuccess(`Anti-Sticker filter is now *${next ? "ENABLED" : "DISABLED"}*`));
  }
};
