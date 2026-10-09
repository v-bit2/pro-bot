import { formatResponse } from "../lib/format.js";

export const command = {
  name: "runtime",
  aliases: ["upt", "uptime"],
  category: "GENERAL",
  description: "Display formatted bot process uptime",
  usage: ".runtime",
  async execute({ reply, settings }) {
    const uptime = Math.floor(process.uptime());
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;

    const parts = [];
    if (days > 0) parts.push(`${days} day${days === 1 ? "" : "s"}`);
    if (hours > 0) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
    parts.push(`${seconds} second${seconds === 1 ? "" : "s"}`);

    const body = `✦ 🤖 *Name:* ${settings.botName || "VOLTRA MINI"}\n✦ ⏳ *Uptime:* ${parts.join(" ")}`;
    await reply(formatResponse(body, "BOT UPTIME"));
  }
};
