import { updateGroupSettings, getGroupSettings } from "../lib/db.js";
import { formatBox, formatSuccess } from "../lib/format.js";

export const command = {
  name: "antisticker",
  category: "ADMIN",
  description: "Toggle anti-sticker protection setting for group",
  usage: ".antisticker",
  groupOnly: true,
  adminOnly: true,
  async execute({ reply, args, remoteJid }) {
    const current = Boolean(getGroupSettings(remoteJid).antisticker);
    if (args.length === 0) {
      await reply(formatSuccess(`Current Anti-Sticker status: *${current ? "ENABLED" : "DISABLED"}*\n\nUsage: .antisticker <on|off>`));
      return;
    }

    const input = args[0].toLowerCase();
    let next = current;
    if (["on", "enable", "true", "1"].includes(input)) next = true;
    else if (["off", "disable", "false", "0"].includes(input)) next = false;
    else {
      next = !current;
    }

    updateGroupSettings(remoteJid, { antisticker: next });
    await reply(formatBox("ANTI-STICKER", next ? "Antisticker Enabled ✅️" : "Antisticker Disabled ❌️"));
  }
};
