import { generateTextmakerImage } from "../lib/textmaker.js";
import { formatError, formatBox } from "../lib/format.js";

export const command = {
  name: "purple",
  category: "TEXTMAKER",
  description: "Generate styled PURPLE text graphic",
  usage: ".purple <text>",
  async execute({ sock, message, args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply(formatError("Please enter text for graphic generation, e.g. .purple Voltra Mini"));
      return;
    }

    const textStr = args.join(" ");

    try {
      await reply(formatBox("VOLTRA MINI", "⚡ Generating PURPLE effect for: " + textStr + "..."));
      const buffer = await generateTextmakerImage("purple", textStr);
      const caption = "⚡ *VOLTRA MINI | TEXTMAKER*\n\n✦ *Effect:* PURPLE\n✦ *Text:* " + textStr;
      await sock.sendMessage(remoteJid, {
        image: buffer,
        caption: caption
      }, { quoted: message });
    } catch (err) {
      await reply(formatError("Failed to generate graphic: " + err.message));
    }
  }
};
