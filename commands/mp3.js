import axios from "axios";
import yts from "yt-search";
import { toMp3 } from "../lib/converter.js";

const AXIOS_DEFAULTS = {
  timeout: 60000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*"
  }
};

async function tryRequest(getter, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await getter();
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }
  throw lastError;
}

// Multi-provider fallback chain
async function getPrexzyDownloadUrl(youtubeUrl) {
  const apiUrl = `https://prexzyapis.com/download/ytmp3?url=${encodeURIComponent(youtubeUrl)}&format=mp3`;
  const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
  if (res?.data?.success && (res?.data?.downloadURL || res?.data?.downloadUrl)) {
    return {
      download: res.data.downloadURL || res.data.downloadUrl,
      title: res.data.title
    };
  }
  throw new Error("Prexzy API returned no download URL");
}

async function getCliptoDownloadUrl(youtubeUrl) {
  const apiUrl = `https://apis.emmyhenztech.xyz/api/clipto?url=${encodeURIComponent(youtubeUrl)}`;
  const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
  const resObj = res?.data?.result || res?.data;
  const audioUrl = resObj?.audio || resObj?.mp3 || resObj?.url || resObj?.link || resObj?.downloadUrl;
  if (audioUrl) {
    return {
      download: audioUrl,
      title: resObj?.title
    };
  }
  throw new Error("Clipto API returned no download URL");
}

async function getSsvidDownloadUrl(youtubeUrl) {
  const apiUrl = `https://apis.emmyhenztech.xyz/api/ssvid?url=${encodeURIComponent(youtubeUrl)}`;
  const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
  const resObj = res?.data?.result || res?.data;
  const audioUrl = resObj?.audio || resObj?.mp3 || resObj?.url || resObj?.link;
  if (audioUrl) {
    return {
      download: audioUrl,
      title: resObj?.title
    };
  }
  throw new Error("Ssvid API returned no download URL");
}

async function getYupraDownloadUrl(youtubeUrl) {
  const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
  const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
  if (res?.data?.success && res?.data?.data?.download_url) {
    return {
      download: res.data.data.download_url,
      title: res.data.data.title
    };
  }
  throw new Error("Yupra API returned no download URL");
}

async function getOkatsuDownloadUrl(youtubeUrl) {
  const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
  const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
  if (res?.data?.dl) {
    return {
      download: res.data.dl,
      title: res.data.title
    };
  }
  throw new Error("Okatsu API returned no download URL");
}

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
  description: "Search and download YouTube MP3 audio (.mp3 <song_name_or_url>)",
  usage: ".mp3 <song_name_or_url>",
  async execute({ sock, message, args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply("Please enter a song name or YouTube link.\nExample: .mp3 Drake - Hotline Bling");
      return;
    }

    const textInput = args.join(" ").trim();

    try {
      let video;
      if (textInput.includes("youtube.com") || textInput.includes("youtu.be")) {
        video = { url: textInput, title: "YouTube Audio", timestamp: "N/A" };
      } else {
        const search = await yts(textInput);
        if (!search || !search.videos.length) {
          await reply("No results found for your search.");
          return;
        }
        video = search.videos[0];
      }

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

      const providers = [
        () => getPrexzyDownloadUrl(video.url),
        () => getCliptoDownloadUrl(video.url),
        () => getSsvidDownloadUrl(video.url),
        () => getYupraDownloadUrl(video.url),
        () => getOkatsuDownloadUrl(video.url)
      ];

      let audioData = null;
      let rawBuffer = null;
      let downloadSuccess = false;

      for (const getDownload of providers) {
        try {
          audioData = await getDownload();
          const downloadUrl = audioData.download;
          if (!downloadUrl) continue;

          const res = await axios.get(downloadUrl, {
            responseType: "arraybuffer",
            timeout: 90000,
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            }
          });

          const testBuf = Buffer.from(res.data);
          const sample = testBuf.slice(0, 64).toString("utf8").toLowerCase();
          if (sample.includes("<!doctype") || sample.includes("<html")) {
            continue;
          }

          if (testBuf && testBuf.length > 5000) {
            rawBuffer = testBuf;
            downloadSuccess = true;
            break;
          }
        } catch {}
      }

      if (!downloadSuccess || !rawBuffer) {
        throw new Error("Unable to download audio from provider servers. Please try again later.");
      }

      let mp3Buffer;
      try {
        mp3Buffer = await toMp3(rawBuffer, "mp3");
      } catch {
        mp3Buffer = rawBuffer;
      }

      const safeTitle = sanitizeFileName(audioData?.title || video.title);

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
      console.error("[Song/MP3] Download error:", err);
      await reply(`❌ Failed to download song: ${err.message || String(err)}`);
    }
  }
};
