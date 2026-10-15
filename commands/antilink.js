import { updateGroupSettings, getGroupSettings } from "../lib/db.js";
import { formatBox, formatSuccess, formatError } from "../lib/format.js";

export const command = {
  name: "antilink",
  aliases: ["nolink"],
  category: "ADMIN",
  description: "Configure group link detection and action mode (off, delete, warn, kick)",
  usage: ".antilink <off|delete|warn|kick>",
  groupOnly: true,
  adminOnly: true,
  async execute({ sock, message, reply, args, remoteJid }) {
    if (args.length === 0) {
      const current = getGroupSettings(remoteJid).antilink || "off";
      await reply(formatSuccess(`Current Anti-Link mode: *${current.toUpperCase()}*\n\nUsage:\n.antilink on (or delete)\n.antilink warn\n.antilink kick\n.antilink off`));
      return;
    }

    let mode = args[0].toLowerCase();
    if (mode === "on" || mode === "enable") mode = "delete";
    if (mode === "disable") mode = "off";

    if (!["off", "delete", "warn", "kick"].includes(mode)) {
      await reply(formatError("Invalid mode. Choose: on, delete, warn, kick, or off."));
      return;
    }

    updateGroupSettings(remoteJid, { antilink: mode });
    if (mode === "off") {
      await sock.sendMessage(message.key.remoteJid, { text: "Antilink Disabled ❌️" }, { quoted: message });
    } else {
      await sock.sendMessage(message.key.remoteJid, { text: "Antilink Enabled ✅️" }, { quoted: message });
    }
  }
};
