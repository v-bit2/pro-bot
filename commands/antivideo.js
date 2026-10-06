import { updateGroupSettings, getGroupSettings } from "../lib/db.js";
import { formatSuccess } from "../lib/format.js";

export const command = {
  name: "antivideo",
  category: "ADMIN",
  description: "Toggle anti-video protection setting for group",
  usage: ".antivideo",
  groupOnly: true,
  adminOnly: true,
  async execute({ reply, remoteJid }) {
    const current = getGroupSettings(remoteJid).antivideo;
    const next = !current;
    updateGroupSettings(remoteJid, { antivideo: next });
    await reply(formatSuccess(`Anti-Video filter is now *${next ? "ENABLED" : "DISABLED"}*`));
  }
};
