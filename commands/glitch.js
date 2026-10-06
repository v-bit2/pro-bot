import { generateTextmakerImage } from "../lib/textmaker.js";
import { formatError } from "../lib/format.js";

export const command = {
  name: "glitch",
  category: "TEXTMAKER",
  description: "Generate styled GLITCH text graphic",
  usage: ".glitch <text>",
  async execute({ sock, message, args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply(formatError("Please enter text for graphic generation, e.g. .glitch Voltra"));
      return;
    }

    const textStr = args.join(" ");

    try {
      const buffer = await generateTextmakerImage("glitch", textStr);
      await sock.sendMessage(remoteJid, {
        image: buffer,
        caption: "🎨 Styled Text: " + textStr
      }, { quoted: message });
    } catch (err) {
      await reply(formatError("Failed to generate graphic: " + err.message));
    }
  }
};
