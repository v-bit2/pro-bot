import { generateTextmakerImage } from "../lib/textmaker.js";
import { formatError, formatBox } from "../lib/format.js";

export const command = {
  name: "fire",
  category: "TEXTMAKER",
  description: "Generate styled FIRE text graphic",
  usage: ".fire <text>",
  async execute({ sock, message, args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply(formatError("Please enter text for graphic generation, e.g. .fire Voltra Mini"));
      return;
    }

    const textStr = args.join(" ");

    try {
      await reply(formatBox("VOLTRA MINI", "⚡ Generating FIRE effect for: " + textStr + "..."));
      const buffer = await generateTextmakerImage("fire", textStr);
      const caption = "⚡ *VOLTRA MINI | TEXTMAKER*\n\n✦ *Effect:* FIRE\n✦ *Text:* " + textStr;
      await sock.sendMessage(remoteJid, {
        image: buffer,
        caption: caption
      }, { quoted: message });
    } catch (err) {
      await reply(formatError("Failed to generate graphic: " + err.message));
    }
  }
};
