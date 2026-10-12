import { updateGroupSettings, getGroupSettings } from "../lib/db.js";
import { formatSuccess } from "../lib/format.js";

export const command = {
  name: "antivideo",
  category: "ADMIN",
  description: "Toggle anti-video protection setting for group",
  usage: ".antivideo",
  groupOnly: true,
  adminOnly: true,
  async execute({ reply, args, remoteJid }) {
    const current = Boolean(getGroupSettings(remoteJid).antivideo);
    if (args.length === 0) {
      await reply(formatSuccess(`Current Anti-Video status: *${current ? "ENABLED" : "DISABLED"}*\n\nUsage: .antivideo <on|off>`));
      return;
    }

    const input = args[0].toLowerCase();
    let next = current;
    if (["on", "enable", "true", "1"].includes(input)) next = true;
    else if (["off", "disable", "false", "0"].includes(input)) next = false;
    else {
      next = !current;
    }

    updateGroupSettings(remoteJid, { antivideo: next });
    await reply(formatSuccess(`Anti-Video filter is now *${next ? "ENABLED" : "DISABLED"}*`));
  }
};
