import { formatFullMenu } from "../lib/format.js";
import { sendBotResponse } from "../lib/response.js";

const HIDDEN_MENU_COMMANDS = new Set(["autolike", "stoplike"]);

export const command = {
  name: "menu",
  aliases: ["help", "commands"],
  category: "GENERAL",
  description: "Display complete command list grouped by category or filter by category (.menu [category])",
  usage: ".menu [category]",
  async execute({ sock, message, args, prefix, remoteJid, getCommandsByCategory, getAllCommands }) {
    const rawCategories = getCommandsByCategory();
    const rawAllCommands = getAllCommands();

    // Filter out hidden commands (autolike, stoplike) from menu display & visible count
    const visibleCommands = rawAllCommands.filter(c => !HIDDEN_MENU_COMMANDS.has(c.name));
    const filteredCategories = {};

    for (const [cat, cmds] of Object.entries(rawCategories)) {
      const visible = cmds.filter(c => !HIDDEN_MENU_COMMANDS.has(c.name));
      if (visible.length > 0) {
        filteredCategories[cat] = visible;
      }
    }

    const categoryFilter = args.length > 0 ? args[0].toLowerCase() : null;
    const username = message.pushName || message.key?.participant?.split("@")[0] || "User";

    const menuChunks = formatFullMenu(filteredCategories, prefix, categoryFilter, username, visibleCommands.length);

    for (let i = 0; i < menuChunks.length; i++) {
      const chunkText = menuChunks[i];
      await sendBotResponse(sock, remoteJid, {
        content: chunkText,
        image: i === 0, // Attach landscape bot image on first menu chunk
        quoted: message
      });
    }
  }
};
