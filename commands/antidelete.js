import { updateSessionSettings, getSessionSettings, updateSettings } from "../lib/db.js";
import { formatBox, formatSuccess } from "../lib/format.js";

export const command = {
  name: "antidelete",
  aliases: ["nodelete"],
  category: "OWNER",
  description: "Toggle anti-delete revoked message protection setting (off, on)",
  usage: ".antidelete <on|off>",
  ownerOnly: true,
  async execute({ reply, args, sock }) {
    const sessionId = sock?.user?.id?.split(":")[0] || "default";
    const sessionCfg = getSessionSettings(sessionId);
    const current = Boolean(sessionCfg.antiDelete);

    if (args.length === 0) {
      await reply(formatSuccess(`Current Anti-Delete setting: *${current ? "ENABLED" : "DISABLED"}*\n\nUsage: .antidelete <on|off>`));
      return;
    }

    const input = args[0].toLowerCase();
    let next = current;
    if (["on", "enable", "true", "1"].includes(input)) next = true;
    else if (["off", "disable", "false", "0"].includes(input)) next = false;
    else next = !current;

    updateSessionSettings(sessionId, { antiDelete: next });
    updateSettings({ antiDelete: next });

    await reply(formatBox("ANTI-DELETE", next ? "Antidelete Enabled ✅️" : "Antidelete Disabled ❌️"));
  }
};
