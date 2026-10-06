import { formatBox } from "../lib/format.js";

export const command = {
  name: "list",
  aliases: ["cmdlist"],
  category: "GENERAL",
  description: "Display a compact list of all available command categories and command counts",
  usage: ".list",
  async execute({ prefix, sendBox, getCommandsByCategory }) {
    const categories = getCommandsByCategory();
    let totalCmds = 0;
    let content = "Available Command Categories:\n";

    for (const [cat, cmds] of Object.entries(categories)) {
      totalCmds += cmds.length;
      content += `\n• *${cat}* (${cmds.length} commands)\n  Examples: ${cmds.slice(0, 3).map(c => prefix + c.name).join(", ")}`;
    }

    content += `\n\nTotal Commands: ${totalCmds}\nUse *${prefix}menu <category>* for details.`;

    await sendBox("COMMAND LIST", content);
  }
};
