import { getGroupSettings, updateGroupSettings } from "../lib/db.js";

export const command = {
  name: "antilink",
  aliases: ["nolink"],
  category: "ADMIN",
  description: "Toggle Anti-Link protection for this group (.antilink on / off / warn / kick)",
  usage: ".antilink [on|off|warn|kick]",
  groupOnly: true,
  adminOnly: true,
  botAdminRequired: true,
  async execute({ message, args, remoteJid, reply }) {
    const groupCfg = getGroupSettings(remoteJid);
    const mode = args[0] ? args[0].toLowerCase() : null;

    if (!mode) {
      const currentMode = groupCfg.antilink || "off";
      const statusSymbol = currentMode !== "off" ? "✓" : "✗";
      await reply(`antilink ${currentMode} ${statusSymbol}`);
      return;
    }

    if (["on", "delete"].includes(mode)) {
      updateGroupSettings(remoteJid, { antilink: "on" });
      await reply("antilink on ✓");
    } else if (mode === "warn") {
      updateGroupSettings(remoteJid, { antilink: "warn" });
      await reply("antilink warn ✓");
    } else if (mode === "kick") {
      updateGroupSettings(remoteJid, { antilink: "kick" });
      await reply("antilink kick ✓");
    } else if (mode === "off") {
      updateGroupSettings(remoteJid, { antilink: "off" });
      await reply("antilink off ✗");
    } else {
      await reply("antilink off ✗");
    }
  }
};
