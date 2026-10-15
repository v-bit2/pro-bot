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
      let videoUrl = null;
      let title = "YouTube Video";

      // Endpoint 1: ssvid
      try {
        const res1 = await fetch(`https://apis.emmyhenztech.xyz/api/ssvid?url=${encodeURIComponent(url)}`);
        const data1 = await res1.json();
        const resObj = data1.result || data1;
        videoUrl = resObj?.url || resObj?.video || resObj?.downloadUrl || resObj?.link;
        title = resObj?.title || title;
      } catch {}

      // Endpoint 2: savetube
      if (!videoUrl) {
        try {
          const res2 = await fetch(`https://apis.emmyhenztech.xyz/api/savetube?url=${encodeURIComponent(url)}`);
          const data2 = await res2.json();
          const resObj2 = data2.result || data2;
          videoUrl = resObj2?.url || resObj2?.video || resObj2?.downloadUrl || resObj2?.link;
          title = resObj2?.title || title;
        } catch {}
      }

      // Endpoint 3: clipto
      if (!videoUrl) {
        try {
          const res3 = await fetch(`https://apis.emmyhenztech.xyz/api/clipto?url=${encodeURIComponent(url)}`);
          const data3 = await res3.json();
          const resObj3 = data3.result || data3;
          videoUrl = resObj3?.url || resObj3?.video || resObj3?.downloadUrl || resObj3?.link;
          title = resObj3?.title || title;
        } catch {}
      }

      // Endpoint 4: ytdl-rapidapi
      if (!videoUrl) {
        try {
          const res4 = await fetch(`https://apis.emmyhenztech.xyz/api/ytdl-rapidapi?url=${encodeURIComponent(url)}`);
          const data4 = await res4.json();
          const resObj4 = data4.result || data4;
          videoUrl = resObj4?.url || resObj4?.video || resObj4?.downloadUrl || resObj4?.link;
          title = resObj4?.title || title;
        } catch {}
      }

      // Endpoint 5: All-in-one fallback
      if (!videoUrl) {
        try {
          const res5 = await fetch(`https://apis.emmyhenztech.xyz/api/densave?url=${encodeURIComponent(url)}`);
          const data5 = await res5.json();
          const resObj5 = data5.result || data5;
          videoUrl = resObj5?.url || resObj5?.video || resObj5?.downloadUrl || resObj5?.link;
          title = resObj5?.title || title;
        } catch {}
      }

      if (videoUrl) {
        await sock.sendMessage(
          remoteJid,
          { video: { url: videoUrl }, caption: "Successfully Downloaded ✅️" },
          { quoted: message }
        );
      } else {
        await reply(formatError("Could not retrieve YouTube video. Please try again."));
      }
    } catch (err) {
      console.error("[YouTube Downloader Error]", err);
      await reply(formatError(`Failed to download YouTube video: ${err.message || err}`));
    }
  }
};
