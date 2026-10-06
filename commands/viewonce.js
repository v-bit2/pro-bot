import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { formatError } from "../lib/format.js";

function extractViewOnceMedia(message) {
  const m = message?.message;
  if (!m) return null;

  // Inspect quoted message
  const quoted = m.extendedTextMessage?.contextInfo?.quotedMessage;
  if (!quoted) return null;

  let isViewOnce = false;
  let target = quoted;

  if (target.ephemeralMessage?.message) target = target.ephemeralMessage.message;

  if (target.viewOnceMessage?.message) {
    isViewOnce = true;
    target = target.viewOnceMessage.message;
  } else if (target.viewOnceMessageV2?.message) {
    isViewOnce = true;
    target = target.viewOnceMessageV2.message;
  } else if (target.viewOnceMessageV2Extension?.message) {
    isViewOnce = true;
    target = target.viewOnceMessageV2Extension.message;
  }

  const imageMsg = target.imageMessage;
  const videoMsg = target.videoMessage;

  if (imageMsg?.viewOnce) isViewOnce = true;
  if (videoMsg?.viewOnce) isViewOnce = true;

  if (!isViewOnce) return null;

  if (imageMsg) return { type: "image", msg: imageMsg, container: { message: target } };
  if (videoMsg) return { type: "video", msg: videoMsg, container: { message: target } };

  return null;
}

export const command = {
  name: "viewonce",
  aliases: ["rvo", "readviewonce"],
  category: "GENERAL",
  description: "Retrieve and reveal a view-once image or video message",
  usage: ".viewonce (reply to a view-once message)",
  async execute({ sock, message, reply, remoteJid }) {
    const media = extractViewOnceMedia(message);

    if (!media) {
      await reply(formatError("Reply to a view-once image or video.", "VIEWONCE"));
      return;
    }

    try {
      const buffer = await downloadMediaMessage(
        media.container,
        "buffer",
        {},
        { reconnect: async () => sock }
      );

      if (!buffer || buffer.length === 0) {
        await reply(formatError("Failed to retrieve view-once media. Media may have expired.", "VIEWONCE"));
        return;
      }

      const captionText = media.msg.caption ? `🔓 Revealed View-Once Media:\n${media.msg.caption}` : "🔓 Revealed View-Once Media";

      if (media.type === "image") {
        await sock.sendMessage(remoteJid, { image: buffer, caption: captionText }, { quoted: message });
      } else if (media.type === "video") {
        await sock.sendMessage(remoteJid, { video: buffer, caption: captionText }, { quoted: message });
      }
    } catch (err) {
      console.error("[ViewOnce Error]", err);
      await reply(formatError("Unable to download view-once media. It may be expired or corrupted.", "VIEWONCE"));
    }
  }
};
