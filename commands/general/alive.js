import { formatResponse } from "../../lib/format.js";

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
  name: "alive",
  aliases: ["online", "status"],
  category: "GENERAL",
  description: "Display dynamic bot online status and system state",
  usage: ".alive",
  async execute({ config, reply, sessionManager }) {
    const uptimeText = formatUptime(process.uptime());
    const memUsageMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    const activeCount = sessionManager ? sessionManager.count() : 1;

    const content =
      `├─ Bot Name: ${config.name || "Voltra Mini"}\n` +
      `├─ Status: Online 🟢\n` +
      `├─ Uptime: ${uptimeText}\n` +
      `├─ Memory: ${memUsageMb} MB\n` +
      `├─ Node.js: ${process.version}\n` +
      `└─ Active Sessions: ${activeCount}`;

    await reply(formatResponse("𝖠𝖫𝖨𝖵𝖤", content));
  }
};
