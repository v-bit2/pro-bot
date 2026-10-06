import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { formatError } from "../lib/format.js";

export const command = {
  name: "viewonce",
  aliases: ["rvo", "readviewonce"],
  category: "GENERAL",
  description: "Retrieve and view view-once image or video message",
  usage: ".viewonce (reply to a view-once message)",
  async execute({ sock, message, reply, remoteJid }) {
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) {
      await reply(formatError("Please reply to a view-once message."));
      return;
    }

    const voImage = quoted.viewOnceMessage?.message?.imageMessage || quoted.viewOnceMessageV2?.message?.imageMessage;
    const voVideo = quoted.viewOnceMessage?.message?.videoMessage || quoted.viewOnceMessageV2?.message?.videoMessage;

    if (!voImage && !voVideo) {
      await reply(formatError("The quoted message is not a valid view-once media message."));
      return;
    }

    try {
      const container = { message: quoted.viewOnceMessage?.message || quoted.viewOnceMessageV2?.message };
      const buffer = await downloadMediaMessage(container, "buffer", {}, { reconnect: async () => sock });

      if (voImage) {
        await sock.sendMessage(remoteJid, { image: buffer, caption: "🔓 View-once image revealed" }, { quoted: message });
      } else if (voVideo) {
        await sock.sendMessage(remoteJid, { video: buffer, caption: "🔓 View-once video revealed" }, { quoted: message });
      }
    } catch (err) {
      await reply(formatError(`Failed to retrieve view-once media: ${err.message}`));
    }
  }
};
