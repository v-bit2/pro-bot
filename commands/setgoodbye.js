import { updateGroupSettings } from "../lib/db.js";
import { formatSuccess, formatError } from "../lib/format.js";

export const command = {
  name: "setgoodbye",
  aliases: ["goodbyetext"],
  category: "ADMIN",
  description: "Set custom goodbye message text with placeholders {user}, {group}",
  usage: ".setgoodbye Goodbye @user from {group}!",
  groupOnly: true,
  adminOnly: true,
  async execute({ args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply(formatError("Please enter custom goodbye message text. Placeholders: {user}, {group}"));
      return;
    }

    const textStr = args.join(" ");
    updateGroupSettings(remoteJid, { goodbyeText: textStr, goodbye: true });
    await reply(formatSuccess(`Custom goodbye message set to:\n\n${textStr}`));
  }
};
