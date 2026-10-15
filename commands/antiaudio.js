import { updateGroupSettings, getGroupSettings } from "../lib/db.js";
import { formatBox, formatSuccess } from "../lib/format.js";

export const command = {
  name: "antiaudio",
  category: "ADMIN",
  description: "Toggle anti-audio voice note protection setting for group",
  usage: ".antiaudio",
  groupOnly: true,
  adminOnly: true,
  async execute({ sock, message, reply, args, remoteJid }) {
    const current = Boolean(getGroupSettings(remoteJid).antiaudio);
    if (args.length === 0) {
      await reply(formatSuccess(`Current Anti-Audio status: *${current ? "ENABLED" : "DISABLED"}*\n\nUsage: .antiaudio <on|off>`));
      return;
    }

    const input = args[0].toLowerCase();
    let next = current;
    if (["on", "enable", "true", "1"].includes(input)) next = true;
    else if (["off", "disable", "false", "0"].includes(input)) next = false;
    else {
      next = !current;
    }

    updateGroupSettings(remoteJid, { antiaudio: next });
    await sock.sendMessage(message.key.remoteJid, { text: next ? "Antiaudio Enabled ✅️" : "Antiaudio Disabled ❌️" }, { quoted: message });
  }
};
