import { formatResponse, formatError } from "../lib/format.js";

export const command = {
  name: "tk",
  aliases: ["tiktok", "tt"],
  category: "DOWNLOADER",
  description: "Download TikTok videos or image slideshows by URL",
  usage: ".tk <tiktok_url>",
  async execute({ sock, message, args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply(formatError("Please provide a TikTok video or post URL.\n\nExample: .tk https://www.tiktok.com/@user/video/1234567890"));
      return;
    }

    const url = args[0].trim();
    if (!/tiktok\.com/i.test(url)) {
      await reply(formatError("Invalid TikTok URL. Please provide a valid TikTok link."));
      return;
    }

    try {
      // Scrape TikTok media via API
      const res = await fetch(`https://api.vkrdown.com/v1/tiktok?url=${encodeURIComponent(url)}`);
      const data = await res.json().catch(() => ({}));

      if (!data.status && !data.data) {
        // Fallback to TikWM
        const res2 = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
        const data2 = await res2.json().catch(() => ({}));

        if (data2?.data?.play) {
          const videoUrl = data2.data.play;
          const title = data2.data.title || "TikTok Video";
          await sock.sendMessage(
            remoteJid,
            { video: { url: videoUrl }, caption: formatResponse(`🎵 *TikTok Download*\n\n✦ *Title:* ${title}`, "TIKTOK") },
            { quoted: message }
          );
          return;
        }
        throw new Error(data.message || "Failed to fetch TikTok media");
      }

      const item = data.data || data;
      const videoUrl = item.play || item.hdplay || item.wmplay || item.video;
      const title = item.title || "TikTok Download";

      if (videoUrl) {
        await sock.sendMessage(
          remoteJid,
          { video: { url: videoUrl }, caption: formatResponse(`🎵 *TikTok Download*\n\n✦ *Title:* ${title}`, "TIKTOK") },
          { quoted: message }
        );
      } else {
        await reply(formatError("Could not retrieve downloadable video stream from TikTok."));
      }
    } catch (err) {
      console.error("[TikTok Downloader Error]", err);
      await reply(formatError(`Failed to download TikTok media: ${err.message || err}`));
    }
  }
};
