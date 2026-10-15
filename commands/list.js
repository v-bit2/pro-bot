import { sendBotResponse } from "../lib/response.js";
import { formatBox } from "../lib/format.js";

export const command = {
  name: "list",
  aliases: ["cmdlist"],
  category: "GENERAL",
  description: "Display a compact list of all available command categories and command counts",
  usage: ".list",
  async execute({ sock, message, remoteJid, prefix, getCommandsByCategory }) {
    const categories = getCommandsByCategory();
    let totalCmds = 0;
    let content = "Available Command Categories:\n\n";

    for (const [cat, cmds] of Object.entries(categories)) {
      totalCmds += cmds.length;
      content += `✦ *${cat}* : ${cmds.length}\n`;
    }

    content += `\n✦ Total Commands: ${totalCmds}\n✦ Use *${prefix}menu <category>* for details.`;

    await sendBotResponse(sock, remoteJid, {
      title: "COMMAND LIST",
      content,
      image: true,
      quoted: message,
      forwarded: true
    });
  }
};
