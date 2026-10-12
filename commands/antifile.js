import { updateGroupSettings, getGroupSettings } from "../lib/db.js";
import { formatBox, formatSuccess } from "../lib/format.js";

export const command = {
  name: "antifile",
  category: "ADMIN",
  description: "Toggle anti-file document protection setting for group",
  usage: ".antifile",
  groupOnly: true,
  adminOnly: true,
  async execute({ reply, args, remoteJid }) {
    const current = Boolean(getGroupSettings(remoteJid).antifile);
    if (args.length === 0) {
      await reply(formatSuccess(`Current Anti-File status: *${current ? "ENABLED" : "DISABLED"}*\n\nUsage: .antifile <on|off>`));
      return;
    }

    const input = args[0].toLowerCase();
    let next = current;
    if (["on", "enable", "true", "1"].includes(input)) next = true;
    else if (["off", "disable", "false", "0"].includes(input)) next = false;
    else {
      next = !current;
    }

    updateGroupSettings(remoteJid, { antifile: next });
    await reply(formatBox("ANTI-FILE", next ? "Antifile Enabled ✅️" : "Antifile Disabled ❌️"));
  }
};
