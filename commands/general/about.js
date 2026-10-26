import { formatResponse } from "../../lib/format.js";
import { getAllCommands } from "../../lib/command-loader.js";

function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);

  return parts.join(" ");
}

export const command = {
  name: "about",
  aliases: ["info", "botinfo"],
  category: "GENERAL",
  description: "Display information about Voltra Mini",
  usage: ".about",
  async execute({ config, reply }) {
    const totalCmds = getAllCommands().length;
    const uptimeText = formatUptime(process.uptime());
    const ownerNum = config.owner || "263786624966";

    const content =
      `├─ Developer: ${ownerNum}\n` +
      `├─ Commands: ${totalCmds}\n` +
      `├─ Version: v2.0.0\n` +
      `└─ Uptime: ${uptimeText}`;

    await reply(formatResponse("𝖠𝖡𝖮𝖴𝖳 𝖵𝖮𝖫𝖳𝖱𝖠", content));
  }
};
