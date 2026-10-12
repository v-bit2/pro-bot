import { updateSessionSettings, getSessionSettings, updateSettings } from "../lib/db.js";
import { formatSuccess, formatError } from "../lib/format.js";

export const command = {
  name: "anticall",
  aliases: ["nocall"],
  category: "OWNER",
  description: "Configure anti-call protection setting (off, on, block)",
  usage: ".anticall <off|on|block>",
  ownerOnly: true,
  async execute({ reply, args, sock }) {
    const sessionId = sock?.user?.id?.split(":")[0] || "default";
    const sessionCfg = getSessionSettings(sessionId);

    if (args.length === 0) {
      const current = (sessionCfg.antiCall || "off").toUpperCase();
      await reply(formatSuccess(`Current Anti-Call setting: *${current}*\n\nUsage:\n.anticall on\n.anticall block\n.anticall off`));
      return;
    }

    let mode = args[0].toLowerCase();
    if (mode === "enable" || mode === "reject" || mode === "true" || mode === "1") mode = "on";
    if (mode === "disable" || mode === "false" || mode === "0") mode = "off";

    if (!["off", "on", "block"].includes(mode)) {
      await reply(formatError("Invalid mode. Choose: on (reject call), block (reject + block caller), or off."));
      return;
    }

    updateSessionSettings(sessionId, { antiCall: mode });
    updateSettings({ antiCall: mode !== "off" });

    let statusText = "";
    if (mode === "on") statusText = "ON (Reject calls automatically)";
    else if (mode === "block") statusText = "BLOCK (Reject calls & block callers)";
    else statusText = "OFF (Disabled)";

    await reply(formatSuccess(`Anti-Call protection mode set to: *${statusText}*`));
  }
};
