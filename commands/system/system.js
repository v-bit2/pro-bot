import os from "node:os";
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
  name: "system",
  aliases: ["sys", "sysinfo"],
  category: "SYSTEM",
  description: "Display process and system information",
  usage: ".system",
  async execute({ reply, sessionManager }) {
    const memUsage = process.memoryUsage();
    const heapUsedMb = Math.round(memUsage.heapUsed / 1024 / 1024);
    const totalMemMb = Math.round(os.totalmem() / 1024 / 1024);
    const freeMemMb = Math.round(os.freemem() / 1024 / 1024);
    const usedMemMb = totalMemMb - freeMemMb;
    const uptimeText = formatUptime(process.uptime());

    const content =
      `├─ 🤖 *𝖡𝗈𝗍:* 𝖵𝗈𝗅𝗍𝗋𝖺 𝖬𝗂𝗇𝗂\n` +
      `├─ 🟢 *𝖲𝗍𝖺𝗍𝗎𝗌:* 𝖮𝗇𝗅𝗂𝗇𝖾\n` +
      `├─ ⏳ *𝖴𝗉𝗍𝗂𝗆𝖾:* ${uptimeText}\n` +
      `├─ 💻 *𝖯𝗅𝖺𝗍𝖿𝗈𝗋𝗆:* ${os.platform()} (${os.arch()})\n` +
      `├─ ⚙️ *𝖭𝗈𝖽𝖾.𝗃𝗌:* ${process.version}\n` +
      `├─ 🧠 *𝖧𝖾𝖺𝗉 𝖴𝗌𝖺𝗀𝖾:* ${heapUsedMb} 𝖬𝖡\n` +
      `└─ 📊 *𝖲𝗒𝗌𝗍𝖾𝗆 𝖬𝖾𝗆𝗈𝗋𝗒:* ${usedMemMb} / ${totalMemMb} 𝖬𝖡 🤖`;

    await reply(formatResponse("SYSTEM", content));
  }
};
