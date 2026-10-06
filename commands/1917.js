import { generateTextmakerImage } from "../lib/textmaker.js";
import { formatError } from "../lib/format.js";

export const command = {
  name: "1917",
  category: "TEXTMAKER",
  description: "Generate styled 1917 text graphic",
  usage: ".1917 <text>",
  async execute({ sock, message, args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply(formatError("Please enter text for graphic generation, e.g. .1917 Voltra"));
      return;
    }

    const textStr = args.join(" ");

    try {
      const buffer = await generateTextmakerImage("1917", textStr);
      await sock.sendMessage(remoteJid, {
        image: buffer,
        caption: "🎨 Styled Text: " + textStr
      }, { quoted: message });
    } catch (err) {
      await reply(formatError("Failed to generate graphic: " + err.message));
    }
  }
};
