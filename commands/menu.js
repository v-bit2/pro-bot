import { formatFullMenu } from "../lib/format.js";
import { sendBotResponse } from "../lib/response.js";

export const command = {
  name: "menu",
  aliases: ["help", "commands"],
  category: "GENERAL",
  description: "Display complete command list grouped by category or filter by category (.menu [category])",
  usage: ".menu [category]",
  async execute({ sock, message, args, prefix, remoteJid, getCommandsByCategory, getAllCommands }) {
    const categories = getCommandsByCategory();
    const allCommands = getAllCommands();
    const categoryFilter = args.length > 0 ? args[0].toLowerCase() : null;
    const username = message.pushName || message.key?.participant?.split("@")[0] || "User";

    const menuChunks = formatFullMenu(categories, prefix, categoryFilter, username, allCommands.length);

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
