import { formatError } from "../lib/format.js";

export const command = {
  name: "qr",
  aliases: ["qrcode"],
  category: "GENERAL",
  description: "Generate a QR code image from supplied text or URL",
  usage: ".qr <text_or_url>",
  async execute({ sock, message, args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply(formatError("Please specify text or a URL to generate a QR code."));
      return;
    }

    const input = args.join(" ");
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(input)}`;

    try {
      await sock.sendMessage(remoteJid, {
        image: { url: qrApiUrl },
        caption: `📱 QR Code generated for: ${input}`
      }, { quoted: message });
    } catch (err) {
      await reply(formatError(`Failed to generate QR code: ${err.message}`));
    }
  }
};
