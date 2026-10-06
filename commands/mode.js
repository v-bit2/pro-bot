import { updateSettings, getSettings } from "../lib/db.js";
import { formatSuccess, formatError } from "../lib/format.js";

export const command = {
  name: "mode",
  aliases: ["botmode", "setmode"],
  category: "OWNER",
  description: "Set bot operating mode: public, self (owner only), or private (DM only)",
  usage: ".mode <public|self|private>",
  ownerOnly: true,
  async execute({ args, reply }) {
    if (args.length === 0) {
      const current = getSettings().mode;
      await reply(formatSuccess(`Current bot mode: *${current}*\n\nUsage: .mode <public|self|private>`));
      return;
    }

    const mode = args[0].toLowerCase();
    if (!["public", "self", "private"].includes(mode)) {
      await reply(formatError("Invalid mode. Choose: public, self, or private."));
      return;
    }

    updateSettings({ mode });
    await reply(formatSuccess(`Bot mode changed to: *${mode.toUpperCase()}*`));
  }
};
