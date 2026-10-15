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
      let videoUrl = null;

      // Endpoint 1: fbdown
      try {
        const res1 = await fetch(`https://apis.emmyhenztech.xyz/api/fbdown?url=${encodeURIComponent(url)}`);
        const data1 = await res1.json();
        const resObj = data1.result || data1;
        videoUrl = resObj?.hd || resObj?.sd || resObj?.url || resObj?.video;
      } catch {}

      // Endpoint 2: densave
      if (!videoUrl) {
        try {
          const res2 = await fetch(`https://apis.emmyhenztech.xyz/api/densave?url=${encodeURIComponent(url)}`);
          const data2 = await res2.json();
          const resObj2 = data2.result || data2;
          videoUrl = resObj2?.hd || resObj2?.sd || resObj2?.url || resObj2?.video;
        } catch {}
      }

      // Endpoint 3: aio-rapidapi fallback
      if (!videoUrl) {
        try {
          const res3 = await fetch(`https://apis.emmyhenztech.xyz/api/aio-rapidapi?url=${encodeURIComponent(url)}`);
          const data3 = await res3.json();
          const resObj3 = data3.result || data3;
          videoUrl = resObj3?.url || resObj3?.video || resObj3?.hd || resObj3?.sd;
        } catch {}
      }

      if (videoUrl) {
        await sock.sendMessage(
          remoteJid,
          { video: { url: videoUrl }, caption: "Successfully Downloaded ✅️" },
          { quoted: message }
        );
      } else {
        await reply(formatError("Could not retrieve Facebook video. Please verify the link is public."));
      }
    } catch (err) {
      console.error("[Facebook Downloader Error]", err);
      await reply(formatError(`Failed to download Facebook video: ${err.message || err}`));
    }
  }
};
