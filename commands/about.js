import { formatResponse } from "../lib/format.js";

export const command = {
  name: "about",
  aliases: ["voltra", "botinfo"],
  category: "GENERAL",
  description: "Display information about Voltra Mini",
  usage: ".about",
  async execute({ reply, config }) {
    const body = `${config.name} is a high-performance, lightweight multi-session WhatsApp bot built with Node.js and Baileys.

Features:
• Multi-Session Support
• Dynamic Command Loader
• Built-in Web UI & Pairing
• Self-Chat Support ("Note to Self")
• Human-like typing presence
• Group management suite
• Render hosting keep-alive support`;

    await reply(formatResponse(body, "GENERAL"));
  }
};
