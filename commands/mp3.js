import axios from "axios";
import yts from "yt-search";
import { toMp3 } from "../lib/converter.js";

function sanitizeFileName(title) {
  return String(title || "audio")
    .replace(/[^\w\s\-\.\(\)\[\]]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "audio";
}

export const command = {
  name: "mp3",
  aliases: ["song", "music", "play"],
  category: "DOWNLOADER",
  description: "Search and download YouTube MP3 songs (.mp3 <song_name_or_url>)",
  usage: ".mp3 <song_name_or_url>",
  async execute({ sock, message, args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply("Please enter a song name or YouTube link.\nExample: .mp3 Drake - Hotline Bling");
      return;
    }

    const query = args.join(" ").trim();

    try {
      // 1. Resolve YouTube video URL via yt-search
      let video;
      if (/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)/i.test(query)) {
        const match = query.match(/(?:watch\?v=|embed\/|v\/|shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (match && match[1]) {
          video = await yts({ videoId: match[1] });
        } else {
          video = { url: query, title: "YouTube Audio", timestamp: "N/A" };
        }
      } else {
        const search = await yts(query);
        video = search?.videos?.[0];
      }

      if (!video || !video.url) {
        await reply("No YouTube results found.");
        return;
      }

      // Send downloading notification with thumbnail
      if (video.thumbnail) {
        await sock.sendMessage(
          remoteJid,
          {
            image: { url: video.thumbnail },
            caption: `🎵 Downloading: *${video.title}*\n⏱ Duration: ${video.timestamp || "N/A"}`
          },
          { quoted: message }
        );
      } else {
        await reply(`🎵 Downloading: *${video.title}*`);
      }

      // 2. Query PrexzyAPIs endpoint directly
      const apiUrl = `https://prexzyapis.com/download/ytmp3?url=${encodeURIComponent(video.url)}&format=mp3`;
      const apiRes = await axios.get(apiUrl, {
        timeout: 45000,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
      });

      const audioUrl = apiRes.data?.downloadURL || apiRes.data?.downloadUrl || apiRes.data?.url || apiRes.data?.result?.downloadURL;

      if (!audioUrl || typeof audioUrl !== "string") {
        throw new Error("Prexzy API did not return a valid audio download URL.");
      }

      // 3. Download the audio file arraybuffer directly into memory
      const audioResponse = await axios.get(audioUrl, {
        responseType: "arraybuffer",
        timeout: 90000,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
      });

      const rawBuffer = Buffer.from(audioResponse.data);
      if (!rawBuffer || rawBuffer.length < 5000) {
        throw new Error("Downloaded audio file is empty or corrupted.");
      }

      // 4. Convert stream to clean MP3 buffer
      let mp3Buffer;
      try {
        mp3Buffer = await toMp3(rawBuffer, "mp3");
      } catch {
        mp3Buffer = rawBuffer;
      }

      const songTitle = apiRes.data?.title || video.title;
      const safeTitle = sanitizeFileName(songTitle);

      // 5. Send audio file to WhatsApp chat
      await sock.sendMessage(
        remoteJid,
        {
          audio: mp3Buffer,
          mimetype: "audio/mpeg",
          ptt: false,
          fileName: `${safeTitle}.mp3`
        },
        { quoted: message }
      );
    } catch (err) {
      console.error("[Song/MP3 Error]:", err);
      await reply(`❌ Failed to download song: ${err.message || String(err)}`);
    }
  }
};
