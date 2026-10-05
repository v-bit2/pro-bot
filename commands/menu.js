import { formatMenu } from "../lib/format.js";

export const command = {
  name: "menu",
  aliases: ["help", "commands"],
  category: "GENERAL",
  description: "Display all available commands grouped by category",
  usage: ".menu",
  async execute({ reply, prefix, config, getCommandsByCategory }) {
    const categories = getCommandsByCategory();
    const formatted = formatMenu(categories, prefix, config.name);
    await reply(formatted);
  }
};
