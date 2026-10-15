import { sendBotResponse } from "../lib/response.js";
import { formatResponse } from "../lib/format.js";

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

export const command = {
  name: "about",
  aliases: ["voltra", "botinfo"],
  category: "GENERAL",
  description: "Display information about Voltra Mini",
  usage: ".about",
  async execute({ sock, message, remoteJid, config, getAllCommands }) {
    const totalCmds = getAllCommands().length;
    const uptimeStr = formatUptime(process.uptime());

    const body = `✦ Developer: ${config.owner}
✦ Commands: ${totalCmds}
✦ Version: v2.0.0
✦ Uptime: ${uptimeStr}`;

    await sendBotResponse(sock, remoteJid, {
      title: "ABOUT VOLTRA",
      content: body,
      image: true,
      quoted: message,
      forwarded: true
    });
  }
};
