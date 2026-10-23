import axios from "axios";
import yts from "yt-search";

const YT_REGEX = /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

function pickUrl(d) {
  const r = d?.result ?? d?.data ?? d;
  const candidates = [
    r?.download_url, r?.downloadUrl, r?.download, r?.url, r?.link, r?.mp3, r?.audio,
    r?.result?.download_url, r?.result?.url,
    d?.download_url, d?.downloadUrl, d?.download, d?.url, d?.link,
  ];
  return candidates.find((c) => typeof c === "string" && /^https?:\/\//.test(c));
}

function pickTitle(d) {
  const r = d?.result ?? d?.data ?? d;
  return r?.title || r?.filename || r?.fileName || d?.title || d?.filename;
}

const makeProvider = (name, buildUrl) => async (link) => {
  const { data } = await axios.get(buildUrl(encodeURIComponent(link)), { timeout: 20000 });
  const url = pickUrl(data);
  if (!url) {
    console.log(`[${name}] unexpected response:`, JSON.stringify(data).slice(0, 500));
    throw new Error(`${name}: no download url`);
  }
  return { url, title: pickTitle(data) };
};

const providers = [
  makeProvider("prexzy", (u) => `https://prexzyapis.com/download/ytmp3?url=${u}`),
  makeProvider("emmyhenz", (u) => `https://apis.emmyhenztech.xyz/api/ytmp3-mobi?youtubeUrl=${u}`),
  makeProvider("rebix", (u) => `https://api-rebix.zone.id/api/yta?url=${u}`),
];

export const command = {
  name: "mp3",
  aliases: ["song", "music", "play"],
  category: "DOWNLOADER",
  description: "Search and download YouTube MP3 songs (.mp3 <song_name_or_url>)",
  usage: ".mp3 <song_name_or_url>",
  async execute({ sock, message, args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply("Give me a song name or YouTube link.\nExample: .mp3 Drake - Hotline Bling");
      return;
    }

    const query = args.join(" ").trim();

    try {
      let video;
      const match = query.match(YT_REGEX);
      if (match) {
        video = await yts({ videoId: match[1] });
      } else {
        const res = await yts(query);
        video = res.videos?.[0];
      }

      if (!video) {
        await reply("No results found.");
        return;
      }

      if (video.thumbnail) {
        await sock.sendMessage(
          remoteJid,
          {
            image: { url: video.thumbnail },
            caption: `*${video.title}*\n${video.author?.name || ""}  •  ${video.timestamp || ""}\n\n_Downloading audio..._`
          },
          { quoted: message }
        );
      } else {
        await reply(`🎵 Downloading: *${video.title}*`);
      }

      let result;
      for (const getAudio of providers) {
        try {
          result = await getAudio(video.url);
          if (result?.url) break;
        } catch (e) {
          console.log("Provider failed, trying next:", e.message);
        }
      }

      if (!result?.url) {
        await reply("Download failed. Try again later.");
        return;
      }

      let buffer;
      try {
        const res = await axios.get(result.url, { responseType: "arraybuffer", timeout: 120000 });
        buffer = res.data;
      } catch (e) {
        console.log("Audio fetch failed:", e.message);
        await reply("Could not fetch the audio file.");
        return;
      }

      const safeName = (result.title || video.title).replace(/[\\/:*?"<>|]/g, "");

      await sock.sendMessage(
        remoteJid,
        {
          audio: Buffer.from(buffer),
          mimetype: "audio/mpeg",
          fileName: `${safeName}.mp3`
        },
        { quoted: message }
      );
    } catch (err) {
      console.error("Song command error:", err);
      await reply("❌ Failed to download song: " + (err.message || String(err)));
    }
  }
};
