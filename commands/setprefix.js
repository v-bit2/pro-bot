import { updateSettings } from "../lib/db.js";
import { formatSuccess, formatError } from "../lib/format.js";

export const command = {
  name: "setprefix",
  aliases: ["prefix", "changeprefix"],
  category: "OWNER",
  description: "Change the command prefix symbol and persist it",
  usage: ".setprefix <new_prefix>",
  ownerOnly: true,
  async execute({ args, reply }) {
    if (args.length === 0) {
      await reply(formatError("Please specify a new prefix, e.g. .setprefix !"));
      return;
    }

    const newPrefix = args[0].trim();
    updateSettings({ prefix: newPrefix });

    await reply(formatSuccess(`Command prefix updated to: *${newPrefix}*\n\nExample: ${newPrefix}menu`));
  }
};
