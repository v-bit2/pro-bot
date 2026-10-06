import { generateTextmakerImage } from "../lib/textmaker.js";
import { formatError } from "../lib/format.js";

export const command = {
  name: "neon",
  category: "TEXTMAKER",
  description: "Generate styled NEON text graphic",
  usage: ".neon <text>",
  async execute({ sock, message, args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply(formatError("Please enter text for graphic generation, e.g. .neon Voltra"));
      return;
    }

    const textStr = args.join(" ");

    try {
      const buffer = await generateTextmakerImage("neon", textStr);
      await sock.sendMessage(remoteJid, {
        image: buffer,
        caption: "🎨 Styled Text: " + textStr
      }, { quoted: message });
    } catch (err) {
      await reply(formatError("Failed to generate graphic: " + err.message));
    }
  }
};
