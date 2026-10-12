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
      let mediaUrl = null;

      // Endpoint 1: densave
      try {
        const res1 = await fetch(`https://apis.emmyhenztech.xyz/api/densave?url=${encodeURIComponent(url)}`);
        const data1 = await res1.json();
        const resObj = data1.result || data1;
        mediaUrl = resObj?.url || resObj?.video || resObj?.media;
      } catch {}

      // Endpoint 2: aio-rapidapi fallback
      if (!mediaUrl) {
        try {
          const res2 = await fetch(`https://apis.emmyhenztech.xyz/api/aio-rapidapi?url=${encodeURIComponent(url)}`);
          const data2 = await res2.json();
          const resObj2 = data2.result || data2;
          mediaUrl = resObj2?.url || resObj2?.video || resObj2?.media;
        } catch {}
      }

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
