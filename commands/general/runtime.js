import { formatResponse } from "../../lib/format.js";

function formatUptimeDetailed(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts = [];
  if (d > 0) parts.push(`${d} day${d > 1 ? "s" : ""}`);
  if (h > 0) parts.push(`${h} hour${h > 1 ? "s" : ""}`);
  if (m > 0) parts.push(`${m} minute${m > 1 ? "s" : ""}`);
  parts.push(`${s} second${s !== 1 ? "s" : ""}`);

  return parts.join(" ");
}

export const command = {
  name: "runtime",
  aliases: ["uptime"],
  category: "GENERAL",
  description: "Show formatted bot uptime",
  usage: ".runtime",
  async execute({ reply }) {
    const uptimeText = formatUptimeDetailed(process.uptime());
    const content = `└─ Uptime: ${uptimeText}`;
    await reply(formatResponse("𝖱𝖴𝖭𝖳𝖨𝖬𝖤", content));
  }
};
