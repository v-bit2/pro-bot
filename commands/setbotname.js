import { updateSettings } from "../lib/db.js";
import { formatSuccess, formatError } from "../lib/format.js";

export const command = {
  name: "setbotname",
  aliases: ["botname", "renamebot"],
  category: "OWNER",
  description: "Change the bot display name and persist it across restarts",
  usage: ".setbotname <new_name>",
  ownerOnly: true,
  async execute({ args, reply }) {
    if (args.length === 0) {
      await reply(formatError("Please specify a new bot name."));
      return;
    }

    const newName = args.join(" ").trim();
    updateSettings({ botName: newName });

    await reply(formatSuccess(`Bot name successfully changed to: *${newName}*`));
  }
};
