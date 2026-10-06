import { updateGroupSettings, getGroupSettings } from "../lib/db.js";
import { formatSuccess } from "../lib/format.js";

export const command = {
  name: "antifile",
  category: "ADMIN",
  description: "Toggle anti-file document protection setting for group",
  usage: ".antifile",
  groupOnly: true,
  adminOnly: true,
  async execute({ reply, remoteJid }) {
    const current = getGroupSettings(remoteJid).antifile;
    const next = !current;
    updateGroupSettings(remoteJid, { antifile: next });
    await reply(formatSuccess(`Anti-File filter is now *${next ? "ENABLED" : "DISABLED"}*`));
  }
};
