import { formatFullMenu } from "../../lib/format.js";
import { sendBotResponse } from "../../lib/response.js";

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

    if (categoryFilter) {
      const matchedCat = Object.keys(filteredCategories).find(
        c => c.toLowerCase() === categoryFilter
      );
      if (matchedCat) {
        const singleCatObj = { [matchedCat]: filteredCategories[matchedCat] };
        const menuText = formatFullMenu({
          commandsByCategory: singleCatObj,
          totalCommands: filteredCategories[matchedCat].length,
          prefix
        });

        await sendBotResponse(sock, remoteJid, {
          content: menuText,
          image: true,
          quoted: message,
          forwarded: true
        });
        return;
      }
    }

    const menuText = formatFullMenu({
      commandsByCategory: filteredCategories,
      totalCommands: visibleCommands.length,
      prefix
    });

    await sendBotResponse(sock, remoteJid, {
      content: menuText,
      image: true,
      quoted: message,
      forwarded: true
    });
  }
};
