import { generateTextmakerImage } from "../lib/textmaker.js";
import { formatError, formatBox } from "../lib/format.js";

export const command = {
  name: "impressive",
  category: "TEXTMAKER",
  description: "Generate styled IMPRESSIVE text graphic",
  usage: ".impressive <text>",
  async execute({ sock, message, args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply(formatError("Please enter text for graphic generation, e.g. .impressive Voltra Mini"));
      return;
    }

    const textStr = args.join(" ");

    try {
      await reply(formatBox("VOLTRA MINI", "⚡ Generating IMPRESSIVE effect for: " + textStr + "..."));
      const buffer = await generateTextmakerImage("impressive", textStr);
      const caption = "⚡ *VOLTRA MINI | TEXTMAKER*\n\n✦ *Effect:* IMPRESSIVE\n✦ *Text:* " + textStr;
      await sock.sendMessage(remoteJid, {
        image: buffer,
        caption: caption
      }, { quoted: message });
    } catch (err) {
      await reply(formatError("Failed to generate graphic: " + err.message));
    }
  }
};
