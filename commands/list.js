import { formatResponse } from "../lib/format.js";
import { getCommandsByCategory, getAllCommands } from "../lib/command-loader.js";

export const command = {
  name: "list",
  aliases: ["allcmds", "commandlist"],
  category: "GENERAL",
  description: "Display a clean text list of all available commands",
  usage: ".list",
  async execute({ prefix, reply }) {
    const categories = getCommandsByCategory();
    const totalCmds = getAllCommands().length;

    let text = `├─ Total Commands: ${totalCmds}\n`;

    for (const [cat, cmds] of Object.entries(categories)) {
      text += `├─ ${cat.toUpperCase()} (${cmds.length}):\n`;
      text += `│  ` + cmds.map(c => `${prefix}${c.name}`).join(", ") + "\n";
    }

    await reply(formatResponse("𝖢𝖮𝖬𝖬𝖠𝖭𝖣 𝖫𝖨𝖲𝖳", text.trim()));
  }
};
