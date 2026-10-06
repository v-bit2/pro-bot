import sharp from "sharp";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { formatError } from "../lib/format.js";

export const command = {
  name: "crop",
  aliases: ["squarecrop"],
  category: "GENERAL",
  description: "Crop an attached or quoted image into a square 1:1 format",
  usage: ".crop (reply to image)",
  async execute({ sock, message, reply, remoteJid }) {
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const imgMsg = message.message?.imageMessage || quoted?.imageMessage;

    if (!imgMsg) {
      await reply(formatError("Please reply to an image to crop."));
      return;
    }

    try {
      const container = message.message?.imageMessage ? message : { message: quoted };
      const buffer = await downloadMediaMessage(container, "buffer", {}, { reconnect: async () => sock });

      const croppedBuffer = await sharp(buffer)
        .resize(500, 500, { fit: "cover" })
        .jpeg({ quality: 90 })
        .toBuffer();

      await sock.sendMessage(remoteJid, { image: croppedBuffer, caption: "✂️ Image cropped 1:1" }, { quoted: message });
    } catch (err) {
      await reply(formatError(`Failed to crop image: ${err.message}`));
    }
  }
};
