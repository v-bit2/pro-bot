import { getGroupSettings } from "../lib/db.js";
import { formatBox } from "../lib/format.js";

export const command = {
  name: "groupstatus",
  aliases: ["gstatus"],
  category: "ADMIN",
  description: "Display current group moderation settings and protection status",
  usage: ".groupstatus",
  groupOnly: true,
  adminOnly: true,
  async execute({ reply, remoteJid }) {
    const cfg = getGroupSettings(remoteJid);
    const content = `Anti-Link  : ${cfg.antilink.toUpperCase()}
Welcome    : ${cfg.welcome ? "ENABLED" : "DISABLED"}
Goodbye    : ${cfg.goodbye ? "ENABLED" : "DISABLED"}
Anti-Audio : ${cfg.antiaudio ? "ENABLED" : "DISABLED"}
Anti-File  : ${cfg.antifile ? "ENABLED" : "DISABLED"}
Anti-Sticker: ${cfg.antisticker ? "ENABLED" : "DISABLED"}
Anti-Video : ${cfg.antivideo ? "ENABLED" : "DISABLED"}`;

    await reply(formatBox("GROUP MODERATION STATUS", content));
  }
};
