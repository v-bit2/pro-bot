import { downloadMediaMessage } from "@whiskeysockets/baileys";
import sharp from "sharp";
import { formatError } from "../lib/format.js";

export const command = {
  name: "simage",
  aliases: ["toimg", "sticker2img"],
  category: "GENERAL",
  description: "Convert a WhatsApp sticker into a downloadable JPEG image",
  usage: ".simage (reply to a sticker)",
  async execute({ sock, message, reply, remoteJid }) {
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const stickerMsg = message.message?.stickerMessage || quoted?.stickerMessage;

    if (!stickerMsg) {
      await reply(formatError("Please reply to a sticker to convert to an image."));
      return;
    }

    try {
      const container = message.message?.stickerMessage ? message : { message: quoted };
      const buffer = await downloadMediaMessage(container, "buffer", {}, { reconnect: async () => sock });

      const jpegBuffer = await sharp(buffer)
        .jpeg({ quality: 90 })
        .toBuffer();

      await sock.sendMessage(remoteJid, { image: jpegBuffer, caption: "🖼️ Converted from sticker" }, { quoted: message });
    } catch (err) {
      await reply(formatError(`Failed to convert sticker to image: ${err.message}`));
    }
  }
};
