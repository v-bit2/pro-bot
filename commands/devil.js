import { generateTextmakerImage } from "../lib/textmaker.js";
import { formatError, formatBox } from "../lib/format.js";

export const command = {
  name: "devil",
  category: "TEXTMAKER",
  description: "Generate styled DEVIL text graphic",
  usage: ".devil <text>",
  async execute({ sock, message, args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply(formatError("Please enter text for graphic generation, e.g. .devil Voltra Mini"));
      return;
    }

    const textStr = args.join(" ");

    try {
      await reply(formatBox("VOLTRA MINI", "⚡ Generating DEVIL effect for: " + textStr + "..."));
      const buffer = await generateTextmakerImage("devil", textStr);
      const caption = "⚡ *VOLTRA MINI | TEXTMAKER*\n\n✦ *Effect:* DEVIL\n✦ *Text:* " + textStr;
      await sock.sendMessage(remoteJid, {
        image: buffer,
        caption: caption
      }, { quoted: message });
    } catch (err) {
      await reply(formatError("Failed to generate graphic: " + err.message));
    }
  }
};
