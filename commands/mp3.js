import axios from "axios";
import yts from "yt-search";
import { toAudio } from "../lib/converter.js";

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

// EliteProTech API - Primary
async function getEliteProTechDownloadByUrl(youtubeUrl) {
  const apiUrl = `https://prexzyapis.com/download/ytmp3?url=${encodeURIComponent(youtubeUrl)}&format=mp3`;
  const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
  if (res?.data?.success && (res?.data?.downloadURL || res?.data?.downloadUrl)) {
    return {
      download: res.data.downloadURL || res.data.downloadUrl,
      title: res.data.title
    };
  }
  throw new Error("EliteProTech ytdown returned no download");
}

async function getCliptoDownloadByUrl(youtubeUrl) {
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
  throw new Error("Clipto returned no download");
}

async function getSsvidDownloadByUrl(youtubeUrl) {
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
  throw new Error("Ssvid returned no download");
}

async function getYupraDownloadByUrl(youtubeUrl) {
  const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
  const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
  if (res?.data?.success && res?.data?.data?.download_url) {
    return {
      download: res.data.data.download_url,
      title: res.data.data.title,
      thumbnail: res.data.data.thumbnail
    };
  }
  throw new Error("Yupra returned no download");
}

async function getOkatsuDownloadByUrl(youtubeUrl) {
  const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
  const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
  if (res?.data?.dl) {
    return {
      download: res.data.dl,
      title: res.data.title,
      thumbnail: res.data.thumb
    };
  }
  throw new Error("Okatsu ytmp3 returned no download");
}

export const command = {
  name: "mp3",
  aliases: ["song", "music", "play"],
  category: "DOWNLOADER",
  description: "Search and download YouTube MP3 songs (.mp3 <song_name_or_url>)",
  usage: ".mp3 <song_name_or_url>",
  async execute({ sock, message, args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply("Usage: .mp3 <song name or YouTube link>\nExample: .mp3 Drake - Hotline Bling");
      return;
    }

    const textInput = args.join(" ").trim();

    try {
      let video;
      if (textInput.includes("youtube.com") || textInput.includes("youtu.be")) {
        video = { url: textInput, title: "YouTube Video", timestamp: "0:00" };
      } else {
        const search = await yts(textInput);
        if (!search || !search.videos.length) {
          await reply("No results found.");
          return;
        }
        video = search.videos[0];
      }

      // Inform user with thumbnail & details
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

      // Try multiple APIs with fallback chain: EliteProTech -> Clipto -> Ssvid -> Yupra -> Okatsu
      let audioData = null;
      let rawBuffer = null;
      let downloadSuccess = false;

      const apiMethods = [
        { name: "EliteProTech", method: () => getEliteProTechDownloadByUrl(video.url) },
        { name: "Clipto", method: () => getCliptoDownloadByUrl(video.url) },
        { name: "Ssvid", method: () => getSsvidDownloadByUrl(video.url) },
        { name: "Yupra", method: () => getYupraDownloadByUrl(video.url) },
        { name: "Okatsu", method: () => getOkatsuDownloadByUrl(video.url) }
      ];

      for (const apiMethod of apiMethods) {
        try {
          audioData = await apiMethod.method();
          const audioUrl = audioData.download || audioData.dl || audioData.url;

          if (!audioUrl) continue;

          try {
            const audioResponse = await axios.get(audioUrl, {
              responseType: "arraybuffer",
              timeout: 90000,
              maxContentLength: Infinity,
              maxBodyLength: Infinity,
              decompress: true,
              validateStatus: s => s >= 200 && s < 400,
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "*/*",
                "Accept-Encoding": "identity"
              }
            });
            rawBuffer = Buffer.from(audioResponse.data);

            if (rawBuffer && rawBuffer.length > 5000) {
              downloadSuccess = true;
              break;
            }
          } catch (downloadErr) {
            try {
              const audioResponse = await axios.get(audioUrl, {
                responseType: "stream",
                timeout: 90000,
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                validateStatus: s => s >= 200 && s < 400,
                headers: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                  "Accept": "*/*",
                  "Accept-Encoding": "identity"
                }
              });
              const chunks = [];
              await new Promise((res, rej) => {
                audioResponse.data.on("data", c => chunks.push(c));
                audioResponse.data.on("end", res);
                audioResponse.data.on("error", rej);
              });
              rawBuffer = Buffer.concat(chunks);

              if (rawBuffer && rawBuffer.length > 5000) {
                downloadSuccess = true;
                break;
              }
            } catch {}
          }
        } catch {}
      }

      if (!downloadSuccess || !rawBuffer || rawBuffer.length === 0) {
        throw new Error("All download sources failed. The content may be unavailable or blocked.");
      }

      // Convert audio stream to WhatsApp playable OGG Opus voice note
      let opusBuffer;
      try {
        opusBuffer = await toAudio(rawBuffer, "mp3");
      } catch {
        opusBuffer = rawBuffer;
      }

      await sock.sendMessage(
        remoteJid,
        {
          audio: opusBuffer,
          mimetype: "audio/ogg; codecs=opus",
          ptt: false
        },
        { quoted: message }
      );
    } catch (err) {
      console.error("Song command error:", err);
      let errorMessage = "❌ Failed to download song.";
      if (err.message && err.message.includes("blocked")) {
        errorMessage = "❌ Download blocked. The content may be unavailable in your region.";
      } else if (err.message && err.message.includes("All download sources failed")) {
        errorMessage = "❌ All download sources failed. The content may be unavailable or blocked.";
      }
      await reply(errorMessage);
    }
  }
};
