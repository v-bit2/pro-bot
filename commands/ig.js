import { formatResponse, formatError } from "../lib/format.js";

export const command = {
  name: "ig",
  aliases: ["instagram", "igdl", "reel"],
  category: "DOWNLOADER",
  description: "Download Instagram Reels, videos, or posts by URL",
  usage: ".ig <instagram_url>",
  async execute({ sock, message, args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply(formatError("Please provide an Instagram Reel or post URL.\n\nExample: .ig https://www.instagram.com/reel/C123456/"));
      return;
    }

    const url = args[0].trim();
    if (!/instagram\.com/i.test(url)) {
      await reply(formatError("Invalid Instagram URL. Please provide a valid Instagram link."));
      return;
    }

    try {
      const res = await fetch(`https://api.vkrdown.com/v1/instagram?url=${encodeURIComponent(url)}`);
      const data = await res.json().catch(() => ({}));

      const mediaUrl = data?.data?.url || data?.data?.video || data?.url;
      if (mediaUrl) {
        const isVideo = mediaUrl.includes(".mp4") || data?.data?.isVideo;
        if (isVideo) {
          await sock.sendMessage(
            remoteJid,
            { video: { url: mediaUrl }, caption: formatResponse("📸 *Instagram Download*", "INSTAGRAM") },
            { quoted: message }
          );
        } else {
          await sock.sendMessage(
            remoteJid,
            { image: { url: mediaUrl }, caption: formatResponse("📸 *Instagram Download*", "INSTAGRAM") },
            { quoted: message }
          );
        }
      } else {
        await reply(formatError("Could not retrieve Instagram media. Please verify the post is public."));
      }
    } catch (err) {
      console.error("[Instagram Downloader Error]", err);
      await reply(formatError(`Failed to download Instagram media: ${err.message || err}`));
    }
  }
};
