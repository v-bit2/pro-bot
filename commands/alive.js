import { sendBotResponse } from "../lib/response.js";

export const command = {
  name: "alive",
  aliases: ["status", "info"],
  category: "GENERAL",
  description: "Display live bot status, dynamic system metrics, and Baileys version",
  usage: ".alive",
  async execute({ sock, message, remoteJid, settings }) {
    const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const uptime = Math.floor(process.uptime());
    const hours = Math.floor(uptime / 3600);
    const mins = Math.floor((uptime % 3600) / 60);
    const secs = uptime % 60;
    const timeStr = `${hours}h ${mins}m ${secs}s`;
    const currentTime = new Date().toLocaleTimeString("en-US", { hour12: false });

    const content = `✦ 🤖 *Bot:* ${settings.botName}
✦ 🟢 *Status:* Online
✦ ⏳ *Uptime:* ${timeStr}
✦ 🧠 *Memory:* ${memory} MB
✦ 💻 *Node.js:* ${process.version}
✦ 📦 *Baileys:* v7.0.0-rc14
✦ 🕒 *Current Time:* ${currentTime}`;

    await sendBotResponse(sock, remoteJid, {
      title: "VOLTRA ALIVE",
      content,
      image: true,
      quoted: message
    });
  }
};
