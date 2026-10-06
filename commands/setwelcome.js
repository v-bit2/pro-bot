import { updateGroupSettings } from "../lib/db.js";
import { formatSuccess, formatError } from "../lib/format.js";

export const command = {
  name: "setwelcome",
  aliases: ["welcometext"],
  category: "ADMIN",
  description: "Set custom welcome message text with placeholders {user}, {group}, {count}",
  usage: ".setwelcome Welcome @user to {group}!",
  groupOnly: true,
  adminOnly: true,
  async execute({ args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply(formatError("Please enter custom welcome message text. Placeholders: {user}, {group}, {count}"));
      return;
    }

    const textStr = args.join(" ");
    updateGroupSettings(remoteJid, { welcomeText: textStr, welcome: true });
    await reply(formatSuccess(`Custom welcome message set to:\n\n${textStr}`));
  }
};
