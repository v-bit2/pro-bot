import { formatMenu } from "../lib/format.js";
import { sendBotResponse } from "../lib/response.js";

export const command = {
  name: "menu",
  aliases: ["help", "commands"],
  category: "GENERAL",
  description: "Display categorized command list or specified category commands (.menu <category>)",
  usage: ".menu [category]",
  async execute({ sock, message, args, prefix, remoteJid, getCommandsByCategory }) {
    const categories = getCommandsByCategory();
    const categoryFilter = args.length > 0 ? args[0].toLowerCase() : null;
    const username = message.pushName || message.key?.participant?.split("@")[0] || "User";

    const formatted = formatMenu(categories, prefix, categoryFilter, username);

    await sendBotResponse(sock, remoteJid, {
      title: "VOLTRA MINI",
      content: formatted,
      image: true,
      quoted: message
    });
  }
};
