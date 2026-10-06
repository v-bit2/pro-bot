import sharp from "sharp";
import { formatError } from "../lib/format.js";

export const command = {
  name: "attp",
  aliases: ["textsticker"],
  category: "GENERAL",
  description: "Create an animated/colored text sticker from supplied text",
  usage: ".attp <text>",
  async execute({ sock, message, args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply(formatError("Please enter text for the sticker, e.g. .attp Voltra"));
      return;
    }

    const textStr = args.join(" ");

    try {
      const svg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <rect width="512" height="512" rx="30" fill="#0b0e14"/>
        <text x="256" y="270" font-family="Arial, sans-serif" font-size="52" font-weight="bold" fill="#7c5cff" text-anchor="middle">${textStr.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</text>
      </svg>`;

      const webpBuffer = await sharp(Buffer.from(svg))
        .resize(512, 512)
        .webp({ quality: 80 })
        .toBuffer();

      await sock.sendMessage(remoteJid, { sticker: webpBuffer }, { quoted: message });
    } catch (err) {
      await reply(formatError(`Failed to generate sticker: ${err.message}`));
    }
  }
};
