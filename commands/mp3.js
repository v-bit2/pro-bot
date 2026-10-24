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

// 1. Try Prexzy AIO Endpoint (https://prexzyapis.com/download/aio?url=)
async function getPrexzyAioAudioUrl(youtubeUrl) {
  const apiUrl = `https://prexzyapis.com/download/aio?url=${encodeURIComponent(youtubeUrl)}`;
  const res = await axios.get(apiUrl, {
    timeout: 35000,
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
  });

  const medias = res.data?.data?.medias || [];
  const title = res.data?.data?.title || "YouTube Audio";

  // Filter audio media with extension mp3
  const audioMedias = medias.filter(m => m && (m.type === "audio" || m.extension === "mp3" || m.quality?.includes("kbps")));

  if (audioMedias.length > 0) {
    // Sort by highest quality in kbps (320kbps -> 256kbps -> 128kbps)
    audioMedias.sort((a, b) => {
      const qA = parseInt(a.quality) || 0;
      const qB = parseInt(b.quality) || 0;
      return qB - qA;
    });

    const bestAudio = audioMedias[0];
    if (bestAudio?.url) {
      return { url: bestAudio.url, title, extension: bestAudio.extension || "mp3" };
    }
  }

  throw new Error("No MP3 audio media found in Prexzy AIO response.");
}

// 2. Fallback to Prexzy YTMP3 Endpoint (https://prexzyapis.com/download/ytmp3?url=)
async function getPrexzyYtmp3AudioUrl(youtubeUrl) {
  const apiUrl = `https://prexzyapis.com/download/ytmp3?url=${encodeURIComponent(youtubeUrl)}&format=mp3`;
  const res = await axios.get(apiUrl, {
    timeout: 35000,
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
  });

  const downloadUrl = res.data?.download_url || res.data?.format?.download_url || res.data?.downloadURL || res.data?.downloadUrl;
  const title = res.data?.info?.title || res.data?.title || "YouTube Audio";
  const ext = res.data?.ext || "m4a";

  if (downloadUrl && typeof downloadUrl === "string") {
    return { url: downloadUrl, title, extension: ext };
  }

  throw new Error("No download URL returned from Prexzy YTMP3 endpoint.");
}

export const command = {
  name: "mp3",
  aliases: ["song", "music", "play"],
  category: "DOWNLOADER",
  description: "Search and download YouTube MP3 audio (.mp3 <song_name_or_url>)",
  usage: ".mp3 <song_name_or_url>",
  async execute({ sock, message, args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply("Please enter a song name or YouTube link.\nExample: .mp3 Drake - Hotline Bling");
      return;
    }

    const query = args.join(" ").trim();

    try {
      // Resolve video metadata via yt-search
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

      // Notify user
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

      // Execute Prexzy AIO first, fall back to Prexzy YTMP3
      let audioResult = null;
      try {
        audioResult = await getPrexzyAioAudioUrl(video.url);
      } catch (aioErr) {
        console.warn("[Song Downloader] AIO failed, trying YTMP3:", aioErr.message);
        audioResult = await getPrexzyYtmp3AudioUrl(video.url);
      }

      if (!audioResult?.url) {
        throw new Error("Unable to retrieve audio download link from Prexzy servers.");
      }

      // Download audio stream arraybuffer
      const audioRes = await axios.get(audioResult.url, {
        responseType: "arraybuffer",
        timeout: 90000,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
      });

      const rawBuffer = Buffer.from(audioRes.data);
      if (!rawBuffer || rawBuffer.length < 5000) {
        throw new Error("Downloaded audio file is empty or corrupted.");
      }

      // Convert stream to clean MP3 buffer
      let mp3Buffer;
      try {
        mp3Buffer = await toMp3(rawBuffer, audioResult.extension || "mp3");
      } catch {
        mp3Buffer = rawBuffer;
      }

      const safeTitle = sanitizeFileName(audioResult.title || video.title);

      // Send to WhatsApp chat
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
