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
      let videoUrl = null;
      let title = "TikTok Video";

      // Endpoint 1: vibetik-tiktokdl
      try {
        const res1 = await fetch(`https://apis.emmyhenztech.xyz/api/vibetik-tiktokdl?url=${encodeURIComponent(url)}`);
        const data1 = await res1.json();
        const resObj = data1.result || data1;
        videoUrl = resObj?.play || resObj?.video || resObj?.url || resObj?.nowatermark;
        title = resObj?.title || title;
      } catch {}

      // Endpoint 2: tiktokdl-rapidapi
      if (!videoUrl) {
        try {
          const res2 = await fetch(`https://apis.emmyhenztech.xyz/api/tiktokdl-rapidapi?url=${encodeURIComponent(url)}`);
          const data2 = await res2.json();
          const resObj2 = data2.result || data2;
          videoUrl = resObj2?.play || resObj2?.video || resObj2?.url || resObj2?.nowatermark;
          title = resObj2?.title || title;
        } catch {}
      }

      // Endpoint 3: savetik
      if (!videoUrl) {
        try {
          const res3 = await fetch(`https://apis.emmyhenztech.xyz/api/savetik?url=${encodeURIComponent(url)}`);
          const data3 = await res3.json();
          const resObj3 = data3.result || data3;
          videoUrl = resObj3?.play || resObj3?.video || resObj3?.url || resObj3?.nowatermark;
          title = resObj3?.title || title;
        } catch {}
      }

      // Endpoint 4: aio-rapidapi fallback
      if (!videoUrl) {
        try {
          const res4 = await fetch(`https://apis.emmyhenztech.xyz/api/aio-rapidapi?url=${encodeURIComponent(url)}`);
          const data4 = await res4.json();
          const resObj4 = data4.result || data4;
          videoUrl = resObj4?.url || resObj4?.video || resObj4?.play;
          title = resObj4?.title || title;
        } catch {}
      }

      if (videoUrl) {
        await sock.sendMessage(
          remoteJid,
          { video: { url: videoUrl }, caption: formatResponse(`🎵 *TikTok Download*\n\n✦ *Title:* ${title}`, "TIKTOK") },
          { quoted: message }
        );
      } else {
        await reply(formatError("Could not retrieve TikTok video. Please try again."));
      }
    } catch (err) {
      console.error("[TikTok Downloader Error]", err);
      await reply(formatError(`Failed to download TikTok media: ${err.message || err}`));
    }
  }
};
