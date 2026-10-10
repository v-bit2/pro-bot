import os from "node:os";
import { formatResponse } from "../lib/format.js";

export const command = {
  name: "system",
  aliases: ["sys", "host"],
  category: "SYSTEM",
  description: "Display host system resource statistics",
  usage: ".system",
  async execute({ reply, settings }) {
    const memory = process.memoryUsage();
    const totalMemMB = Math.round(os.totalmem() / 1024 / 1024);
    const freeMemMB = Math.round(os.freemem() / 1024 / 1024);
    const heapUsedMB = Math.round(memory.heapUsed / 1024 / 1024);
    const uptime = Math.floor(process.uptime());

    const body = `✦ 🤖 *Bot:* ${settings.botName || "VOLTRA MINI"}
✦ 🟢 *Status:* Online
✦ ⏳ *Uptime:* ${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s
✦ 💻 *Platform:* ${os.platform()} (${os.arch()})
✦ ⚙️ *Node.js:* ${process.version}
✦ 🧠 *Heap Usage:* ${heapUsedMB} MB
✦ 📊 *System Memory:* ${totalMemMB - freeMemMB} / ${totalMemMB} MB`;

    await reply(formatResponse(body, "SYSTEM STATUS"));
  }
};
