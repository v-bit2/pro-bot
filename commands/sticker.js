import { downloadMediaMessage } from "@whiskeysockets/baileys";
import sharp from "sharp";
import { formatError } from "../lib/format.js";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function getMediaMessage(message) {
  const m = message.message;
  if (!m) return null;

  if (m.imageMessage) return { type: "image", msg: m.imageMessage, container: message };
  if (m.videoMessage) return { type: "video", msg: m.videoMessage, container: message };

  const quoted = m.extendedTextMessage?.contextInfo?.quotedMessage;
  if (quoted) {
    if (quoted.imageMessage) return { type: "image", msg: quoted.imageMessage, container: { message: quoted } };
    if (quoted.videoMessage) return { type: "video", msg: quoted.videoMessage, container: { message: quoted } };
  }

  return null;
}

export const command = {
  name: "sticker",
  aliases: ["s", "stiker"],
  category: "MEDIA",
  description: "Convert an attached or quoted image, GIF, or video into a sticker",
  usage: ".sticker (reply to media or send media with caption .sticker)",
  async execute({ sock, message, reply, remoteJid }) {
    const targetMedia = getMediaMessage(message);

    if (!targetMedia) {
      await reply(formatError("Please reply to an image or video, or attach media with caption .sticker"));
      return;
    }

    const fileSize = targetMedia.msg.fileLength ? Number(targetMedia.msg.fileLength) : 0;
    if (fileSize > MAX_FILE_SIZE) {
      await reply(formatError("The media file is too large (max 10MB)."));
      return;
    }

    try {
      const buffer = await downloadMediaMessage(
        targetMedia.container,
        "buffer",
        {},
        {
          reconnect: async () => sock
        }
      );

      if (!buffer || buffer.length === 0) {
        await reply(formatError("Failed to download media. Please try again."));
        return;
      }

      // Convert to 512x512 WebP sticker using sharp
      const webpSticker = await sharp(buffer, { animated: true })
        .resize(512, 512, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .webp({ quality: 80 })
        .toBuffer();

      await sock.sendMessage(
        remoteJid,
        { sticker: webpSticker },
        { quoted: message }
      );
    } catch (err) {
      console.error("[Sticker Error]", err);
      await reply(formatError("Conversion failed. Please ensure the media format is supported."));
    }
  }
};
