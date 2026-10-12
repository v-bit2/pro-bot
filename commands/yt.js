import { formatResponse, formatError } from "../lib/format.js";

export const command = {
  name: "yt",
  aliases: ["youtube", "ytdl", "ytv"],
  category: "DOWNLOADER",
  description: "Download YouTube videos by URL",
  usage: ".yt <youtube_url>",
  async execute({ sock, message, args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply(formatError("Please provide a YouTube video URL.\n\nExample: .yt https://www.youtube.com/watch?v=dQw4w9WgXcQ"));
      return;
    }

    const url = args[0].trim();
    if (!/youtube\.com|youtu\.be/i.test(url)) {
      await reply(formatError("Invalid YouTube URL. Please provide a valid YouTube link."));
      return;
    }

    try {
      const res = await fetch(`https://api.vkrdown.com/v1/youtube?url=${encodeURIComponent(url)}`);
      const data = await res.json().catch(() => ({}));

      const item = data?.data || data;
      const videoUrl = item?.url || item?.video || item?.downloadUrl;
      const title = item?.title || "YouTube Video";

      if (videoUrl) {
        await sock.sendMessage(
          remoteJid,
          { video: { url: videoUrl }, caption: formatResponse(`▶️ *YouTube Download*\n\n✦ *Title:* ${title}`, "YOUTUBE") },
          { quoted: message }
        );
      } else {
        await reply(formatError("Could not retrieve YouTube video download link."));
      }
    } catch (err) {
      console.error("[YouTube Downloader Error]", err);
      await reply(formatError(`Failed to download YouTube video: ${err.message || err}`));
    }
  }
};
