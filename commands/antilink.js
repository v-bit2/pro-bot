import { updateGroupSettings, getGroupSettings } from "../lib/db.js";
import { formatSuccess, formatError } from "../lib/format.js";

export const command = {
  name: "antilink",
  aliases: ["nolink"],
  category: "ADMIN",
  description: "Configure group link detection and action mode (off, delete, warn, kick)",
  usage: ".antilink <off|delete|warn|kick>",
  groupOnly: true,
  adminOnly: true,
  async execute({ reply, args, remoteJid }) {
    if (args.length === 0) {
      const current = getGroupSettings(remoteJid).antilink;
      await reply(formatSuccess(`Current Anti-Link mode: *${current.toUpperCase()}*\n\nUsage: .antilink <off|delete|warn|kick>`));
      return;
    }

    const mode = args[0].toLowerCase();
    if (!["off", "delete", "warn", "kick"].includes(mode)) {
      await reply(formatError("Invalid mode. Choose: off, delete, warn, or kick."));
      return;
    }

    updateGroupSettings(remoteJid, { antilink: mode });
    await reply(formatSuccess(`Anti-Link mode set to: *${mode.toUpperCase()}*`));
  }
};
