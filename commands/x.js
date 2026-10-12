import { formatResponse, formatError } from "../lib/format.js";

export const command = {
  name: "x",
  aliases: ["twitter", "xdl", "twdl"],
  category: "DOWNLOADER",
  description: "Download Twitter/X videos or media by URL",
  usage: ".x <x_url>",
  async execute({ sock, message, args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply(formatError("Please provide a Twitter/X post URL.\n\nExample: .x https://x.com/user/status/123456/"));
      return;
    }

    const url = args[0].trim();
    if (!/twitter\.com|x\.com/i.test(url)) {
      await reply(formatError("Invalid Twitter/X URL. Please provide a valid link."));
      return;
    }

    try {
      const res = await fetch(`https://api.vkrdown.com/v1/twitter?url=${encodeURIComponent(url)}`);
      const data = await res.json().catch(() => ({}));

      const mediaUrl = data?.data?.url || data?.data?.video || data?.url;
      if (mediaUrl) {
        await sock.sendMessage(
          remoteJid,
          { video: { url: mediaUrl }, caption: formatResponse("🐦 *Twitter/X Download*", "TWITTER/X") },
          { quoted: message }
        );
      } else {
        await reply(formatError("Could not retrieve Twitter/X media from the provided link."));
      }
    } catch (err) {
      console.error("[X Downloader Error]", err);
      await reply(formatError(`Failed to download X/Twitter media: ${err.message || err}`));
    }
  }
};
