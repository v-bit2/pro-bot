import { downloadMediaMessage } from "@whiskeysockets/baileys";
import sharp from "sharp";
import { formatError } from "../lib/format.js";

export const command = {
  name: "take",
  aliases: ["wm", "stickerwm"],
  category: "GENERAL",
  description: "Change sticker metadata and custom pack name",
  usage: ".take PackName | AuthorName (reply to sticker)",
  async execute({ sock, message, args, reply, remoteJid }) {
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const stickerMsg = message.message?.stickerMessage || quoted?.stickerMessage;

    if (!stickerMsg) {
      await reply(formatError("Please reply to a sticker to modify metadata."));
      return;
    }

    try {
      const container = message.message?.stickerMessage ? message : { message: quoted };
      const buffer = await downloadMediaMessage(container, "buffer", {}, { reconnect: async () => sock });

      const webpBuffer = await sharp(buffer)
        .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 80 })
        .toBuffer();

      await sock.sendMessage(remoteJid, { sticker: webpBuffer }, { quoted: message });
    } catch (err) {
      await reply(formatError(`Failed to update sticker: ${err.message}`));
    }
  }
};
