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
      let mediaUrl = null;

      // Endpoint 1: densave
      try {
        const res1 = await fetch(`https://apis.emmyhenztech.xyz/api/densave?url=${encodeURIComponent(url)}`);
        const data1 = await res1.json();
        const resObj = data1.result || data1;
        mediaUrl = resObj?.url || resObj?.video || resObj?.image || resObj?.media;
      } catch {}

      // Endpoint 2: aio-rapidapi fallback
      if (!mediaUrl) {
        try {
          const res2 = await fetch(`https://apis.emmyhenztech.xyz/api/aio-rapidapi?url=${encodeURIComponent(url)}`);
          const data2 = await res2.json();
          const resObj2 = data2.result || data2;
          mediaUrl = resObj2?.url || resObj2?.video || resObj2?.image || resObj2?.media;
        } catch {}
      }

      if (mediaUrl) {
        const isVideo = String(mediaUrl).includes(".mp4") || String(mediaUrl).includes("video");
        if (isVideo) {
          await sock.sendMessage(
            remoteJid,
            { video: { url: mediaUrl }, caption: "Successfully Downloaded ✅️" },
            { quoted: message }
          );
        } else {
          await sock.sendMessage(
            remoteJid,
            { image: { url: mediaUrl }, caption: "Successfully Downloaded ✅️" },
            { quoted: message }
          );
        }
      } else {
        await reply(formatError("Could not retrieve Instagram media. Please verify the link is public."));
      }
    } catch (err) {
      console.error("[Instagram Downloader Error]", err);
      await reply(formatError(`Failed to download Instagram media: ${err.message || err}`));
    }
  }
};
