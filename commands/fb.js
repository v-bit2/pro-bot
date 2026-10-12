import { formatResponse, formatError } from "../lib/format.js";

export const command = {
  name: "fb",
  aliases: ["facebook", "fbdl", "fbreel"],
  category: "DOWNLOADER",
  description: "Download Facebook videos or reels by URL",
  usage: ".fb <facebook_url>",
  async execute({ sock, message, args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply(formatError("Please provide a Facebook video or reel URL.\n\nExample: .fb https://www.facebook.com/reel/123456/"));
      return;
    }

    const url = args[0].trim();
    if (!/facebook\.com|fb\.watch/i.test(url)) {
      await reply(formatError("Invalid Facebook URL. Please provide a valid Facebook link."));
      return;
    }

    try {
      const res = await fetch(`https://api.vkrdown.com/v1/facebook?url=${encodeURIComponent(url)}`);
      const data = await res.json().catch(() => ({}));

      const videoUrl = data?.data?.hd || data?.data?.sd || data?.data?.url || data?.url;
      if (videoUrl) {
        await sock.sendMessage(
          remoteJid,
          { video: { url: videoUrl }, caption: formatResponse("📘 *Facebook Download*", "FACEBOOK") },
          { quoted: message }
        );
      } else {
        await reply(formatError("Could not retrieve Facebook video. Please verify the video is public."));
      }
    } catch (err) {
      console.error("[Facebook Downloader Error]", err);
      await reply(formatError(`Failed to download Facebook video: ${err.message || err}`));
    }
  }
};
