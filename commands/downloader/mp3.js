import axios from "axios";
import yts from "yt-search";
import { toMp3 } from "../../lib/converter.js";

const AXIOS_TIMEOUT_MS = 45000;
const DOWNLOAD_TIMEOUT_MS = 90000;

function sanitizeFileName(title) {
  return String(title || "audio")
    .replace(/[^\w\s\-\.\(\)\[\]]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "audio";
}

/**
 * Provider 1: Hector YouTube audio downloader
 * Endpoint: https://yt-dl.officialhectormanuel.workers.dev?url=YOUTUBE_URL
 */
async function tryHector(youtubeUrl) {
  const res = await axios.get("https://yt-dl.officialhectormanuel.workers.dev", {
    params: { url: youtubeUrl },
    timeout: AXIOS_TIMEOUT_MS,
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
  });

  const data = res?.data?.data || res?.data;
  const audioUrl = data?.audio || data?.link || data?.downloadUrl || data?.url;
  const title = data?.title || "YouTube Audio";
  const thumbnail = data?.thumbnail || data?.thumb || "";

  if (audioUrl && typeof audioUrl === "string" && /^https?:\/\//i.test(audioUrl)) {
    return {
      provider: "Hector",
      audioUrl,
      title,
      thumbnail
    };
  }

  throw new Error("Hector provider returned no valid audio URL");
}

/**
 * Provider 2: Prexzy YouTube MP3 downloader
 * Endpoint: https://prexzyapis.com/download/ytmp3?url=YOUTUBE_URL
 */
async function tryPrexzy(youtubeUrl) {
  const res = await axios.get("https://prexzyapis.com/download/ytmp3", {
    params: { url: youtubeUrl },
    timeout: AXIOS_TIMEOUT_MS,
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
  });

  const audioUrl = res?.data?.download_url || res?.data?.format?.download_url || res?.data?.downloadURL;
  const title = res?.data?.info?.title || res?.data?.title || "YouTube Audio";
  const thumbnail = res?.data?.info?.thumbnail || "";

  if (audioUrl && typeof audioUrl === "string" && /^https?:\/\//i.test(audioUrl)) {
    return {
      provider: "Prexzy",
      audioUrl,
      title,
      thumbnail
    };
  }

  throw new Error("Prexzy provider returned no valid download_url");
}

/**
 * Download actual audio bytes and validate non-empty audio media
 */
async function fetchAudioBuffer(audioUrl) {
  const res = await axios.get(audioUrl, {
    responseType: "arraybuffer",
    timeout: DOWNLOAD_TIMEOUT_MS,
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
  });

  const rawBuffer = Buffer.from(res.data);
  if (!rawBuffer || rawBuffer.length < 5000) {
    throw new Error("Downloaded audio file is empty or too small");
  }

  const sample = rawBuffer.slice(0, 64).toString("utf8").toLowerCase();
  if (sample.includes("<!doctype") || sample.includes("<html") || sample.includes("{\"status\":false")) {
    throw new Error("Download URL returned HTML/error page instead of media");
  }

  return rawBuffer;
}

export const command = {
  name: "song",
  aliases: ["mp3", "music", "play"],
  category: "DOWNLOADER",
  description: "Search and download YouTube MP3 audio (.song <song_name_or_url>)",
  usage: ".song <song_name_or_url>",
  async execute({ sock, message, args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply("Please enter a song name or YouTube link.\nExample: .song Drake - Hotline Bling");
      return;
    }

    const query = args.join(" ").trim();

    try {
      // Step A: Resolve YouTube URL or Search Query
      let videoUrl = "";
      let videoTitle = "";
      let videoThumb = "";
      let videoDuration = "";

      if (/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)/i.test(query)) {
        videoUrl = query;
        videoTitle = "YouTube Video";
        const match = query.match(/(?:watch\?v=|embed\/|v\/|shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (match && match[1]) {
          try {
            const videoMeta = await yts({ videoId: match[1] });
            if (videoMeta) {
              videoTitle = videoMeta.title || videoTitle;
              videoThumb = videoMeta.thumbnail || "";
              videoDuration = videoMeta.timestamp || "";
            }
          } catch {}
        }
      } else {
        const search = await yts(query);
        const firstVideo = search?.videos?.[0];
        if (!firstVideo || !firstVideo.url) {
          await reply("No matching YouTube video found for your search.");
          return;
        }
        videoUrl = firstVideo.url;
        videoTitle = firstVideo.title;
        videoThumb = firstVideo.thumbnail || "";
        videoDuration = firstVideo.timestamp || "";
      }

      // Progress notification
      if (videoThumb) {
        await sock.sendMessage(
          remoteJid,
          {
            image: { url: videoThumb },
            caption: `🎵 Downloading: *${videoTitle}*\n⏱ Duration: ${videoDuration || "N/A"}`
          },
          { quoted: message }
        );
      } else {
        await reply(`🎵 Downloading: *${videoTitle}*`);
      }

      // Step B: Mandatory Fallback Chain — Hector (1) -> Prexzy (2)
      const providers = [
        () => tryHector(videoUrl),
        () => tryPrexzy(videoUrl)
      ];

      let mediaResult = null;
      let rawBuffer = null;
      const errors = [];

      for (const getMedia of providers) {
        try {
          mediaResult = await getMedia();
          rawBuffer = await fetchAudioBuffer(mediaResult.audioUrl);
          if (rawBuffer && rawBuffer.length >= 5000) {
            console.log(`[Song Downloader] Downloaded audio successfully via provider: ${mediaResult.provider}`);
            break;
          }
        } catch (err) {
          errors.push(err.message || String(err));
          mediaResult = null;
          rawBuffer = null;
        }
      }

      if (!rawBuffer || !mediaResult) {
        console.error("[Song Downloader] Both providers failed:", errors.join(" | "));
        await reply("❌ Audio downloading is temporarily unavailable. Both Hector and Prexzy providers failed.");
        return;
      }

      // Step C: Format conversion to MP3
      let finalMp3Buffer;
      try {
        finalMp3Buffer = await toMp3(rawBuffer, "mp3");
      } catch {
        finalMp3Buffer = rawBuffer;
      }

      const songTitle = mediaResult.title || videoTitle || "audio";
      const safeTitle = sanitizeFileName(songTitle);

      // Step D: Send audio attachment to WhatsApp chat
      await sock.sendMessage(
        remoteJid,
        {
          audio: finalMp3Buffer,
          mimetype: "audio/mpeg",
          ptt: false,
          fileName: `${safeTitle}.mp3`
        },
        { quoted: message }
      );
    } catch (err) {
      console.error("[Song Command Error]:", err);
      await reply(`❌ Failed to process song: ${err.message || String(err)}`);
    }
  }
};
