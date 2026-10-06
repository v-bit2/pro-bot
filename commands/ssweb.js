import { formatError } from "../lib/format.js";

export const command = {
  name: "ssweb",
  aliases: ["screenshot", "webss"],
  category: "GENERAL",
  description: "Capture and render a screenshot of a webpage",
  usage: ".ssweb <url>",
  async execute({ sock, message, args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply(formatError("Please specify a URL to capture, e.g. .ssweb https://github.com"));
      return;
    }

    let url = args[0].trim();
    if (!/^https?:\/\//i.test(url)) {
      url = "https://" + url;
    }

    const ssApiUrl = `https://image.thum.io/get/width/1200/crop/800/${url}`;

    try {
      await sock.sendMessage(remoteJid, {
        image: { url: ssApiUrl },
        caption: `🌐 Webpage Screenshot: ${url}`
      }, { quoted: message });
    } catch (err) {
      await reply(formatError(`Failed to render webpage screenshot: ${err.message}`));
    }
  }
};
