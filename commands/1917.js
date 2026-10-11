import { generateTextmakerImage } from "../lib/textmaker.js";
import { formatError, formatBox } from "../lib/format.js";

export const command = {
  name: "1917",
  category: "TEXTMAKER",
  description: "Generate styled 1917 text graphic",
  usage: ".1917 <text>",
  async execute({ sock, message, args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply(formatError("Please enter text for graphic generation, e.g. .1917 Voltra Mini"));
      return;
    }

    const textStr = args.join(" ");

    try {
      await reply(formatBox("VOLTRA MINI", "⚡ Generating 1917 effect for: " + textStr + "..."));
      const buffer = await generateTextmakerImage("1917", textStr);
      const caption = "⚡ *VOLTRA MINI | TEXTMAKER*\n\n✦ *Effect:* 1917\n✦ *Text:* " + textStr;
      await sock.sendMessage(remoteJid, {
        image: buffer,
        caption: caption
      }, { quoted: message });
    } catch (err) {
      await reply(formatError("Failed to generate graphic: " + err.message));
    }
  }
};
