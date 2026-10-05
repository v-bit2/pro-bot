export const command = {
  name: "ping",
  description: "Check bot response",
  async execute({ reply }) {
    const start = Date.now();
    await reply("🏓 Pong!");
    // Kept intentionally simple for the MVP.
  }
};
