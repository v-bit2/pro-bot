import axios from "axios";
import yts from "yt-search";
import { toMp3 } from "../lib/converter.js";

const AXIOS_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "*/*"
};

function pickAudioUrl(data) {
  if (!data) return null;
  const res = data?.result ?? data?.data ?? data;
  const candidates = [
    res?.downloadURL, res?.downloadUrl, res?.download, res?.url, res?.link, res?.mp3, res?.audio,
    res?.data?.download_url, res?.result?.url, data?.downloadURL, data?.downloadUrl, data?.url
  ];
  return candidates.find(c => typeof c === "string" && /^https?:\/\//i.test(c));
}

function sanitizeFileName(title) {
  return String(title || "audio")
    .replace(/[^\w\s\-\.\(\)\[\]]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "audio";
}

async function downloadAudioBuffer(url) {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 90000,
    headers: AXIOS_HEADERS
  });
  const buf = Buffer.from(response.data);
  const sample = buf.slice(0, 64).toString("utf8").toLowerCase();
  if (sample.includes("<!doctype") || sample.includes("<html")) {
    throw new Error("Provider returned HTML webpage instead of audio buffer.");
  }
  if (buf.length < 5000) {
    throw new Error("Downloaded audio file is empty or corrupted.");
  }
  return buf;
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
      // 1. Resolve YouTube video metadata
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

      // 2. Notify user with thumbnail and details
      if (video.thumbnail) {
        await sock.sendMessage(
          remoteJid,
          {
            image: { url: video.thumbnail },
            caption: `🎵 Downloading: *${video.title}*\n👤 Channel: ${video.author?.name || "N/A"}\n⏱ Duration: ${video.timestamp || "N/A"}`
          },
          { quoted: message }
        );
      } else {
        await reply(`🎵 Downloading: *${video.title}*`);
      }

      // 3. Multi-provider download endpoints waterfall using resolved video URL
      const endpoints = [
        `https://prexzyapis.com/download/ytmp3?url=${encodeURIComponent(video.url)}&format=mp3`,
        `https://apis.emmyhenztech.xyz/api/ytmp3-mobi?youtubeUrl=${encodeURIComponent(video.url)}`,
        `https://apis.emmyhenztech.xyz/api/clipto?url=${encodeURIComponent(video.url)}`,
        `https://apis.emmyhenztech.xyz/api/ssvid?url=${encodeURIComponent(video.url)}`,
        `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(video.url)}`
      ];

      let rawBuffer = null;
      let downloadTitle = video.title;

      for (const endpoint of endpoints) {
        try {
          const apiRes = await axios.get(endpoint, { timeout: 25000, headers: AXIOS_HEADERS });
          const audioUrl = pickAudioUrl(apiRes.data);
          if (!audioUrl) continue;

          rawBuffer = await downloadAudioBuffer(audioUrl);
          if (apiRes.data?.title || apiRes.data?.result?.title) {
            downloadTitle = apiRes.data.title || apiRes.data.result.title;
          }
          if (rawBuffer && rawBuffer.length > 5000) break;
        } catch (e) {
          console.warn("[Song Downloader] Provider failed:", e.message);
        }
      }

      if (!rawBuffer) {
        throw new Error("All YouTube download providers failed. Please try again later.");
      }

      // 4. Convert stream to standard MP3 buffer
      let mp3Buffer;
      try {
        mp3Buffer = await toMp3(rawBuffer, "mp3");
      } catch {
        mp3Buffer = rawBuffer;
      }

      const safeTitle = sanitizeFileName(downloadTitle);

      // 5. Deliver audio message to WhatsApp chat
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
