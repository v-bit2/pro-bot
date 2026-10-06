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
  name: "ping",
  aliases: ["p", "speed"],
  category: "GENERAL",
  description: "Calculate actual bot response latency and process uptime",
  usage: ".ping",
  async execute({ sendBox, receiveLatency }) {
    const uptimeStr = formatUptime(process.uptime());
    const content = `🏓 Pong!\n\nResponse : ${receiveLatency} ms\nUptime   : ${uptimeStr}`;
    await sendBox("VOLTRA MINI", content);
  }
};
