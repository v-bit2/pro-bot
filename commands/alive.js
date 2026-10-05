import { formatResponse } from "../lib/format.js";

export const command = {
  name: "alive",
  aliases: ["status", "info"],
  category: "GENERAL",
  description: "Display live bot status and dynamic system metrics",
  usage: ".alive",
  async execute({ reply, config }) {
    const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const uptime = Math.floor(process.uptime());
    const hours = Math.floor(uptime / 3600);
    const mins = Math.floor((uptime % 3600) / 60);
    const secs = uptime % 60;
    const timeStr = `${hours}h ${mins}m ${secs}s`;
    const currentTime = new Date().toLocaleTimeString("en-US", { hour12: false });

    const body = `Bot Name: ${config.name}
Status: Online 🟢
Uptime: ${timeStr}
Memory Usage: ${memory} MB
Node.js: ${process.version}
Baileys: v7.0.0-rc14
Current Time: ${currentTime}`;

    await reply(formatResponse(body, "GENERAL"));
  }
};
