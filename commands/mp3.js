import { formatError } from "../lib/format.js";

export const command = {
  name: "mp3",
  aliases: ["song", "music", "play"],
  category: "DOWNLOADER",
  description: "Search and download music/songs by title and artist",
  usage: ".mp3 <song_name_with_artist>",
  async execute({ sock, message, args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply(formatError("Please specify a song name and artist.\n\nExample: .mp3 Drake - Hotline Bling"));
      return;
    }

    const query = args.join(" ").trim();

    try {
      let targetUrl = query;
      let title = query;

      // 1. If query is not a direct URL, search via prexzyapis
      if (!/^https?:\/\//i.test(query)) {
        try {
          const searchRes = await fetch(`https://prexzyapis.com/search/youtube?q=${encodeURIComponent(query)}`);
          const searchData = await searchRes.json();
          const results = searchData.result || searchData.results || searchData.data || searchData;
          const first = Array.isArray(results) ? results[0] : results;
          if (first?.url || first?.link) {
            targetUrl = first.url || first.link;
            title = first.title || query;
          }
        } catch {}
      }

      // 2. Fetch MP3 audio download via prexzyapis
      let audioUrl = null;

      try {
        const res1 = await fetch(`https://prexzyapis.com/download/ytmp3?url=${encodeURIComponent(targetUrl)}`);
        const data1 = await res1.json();
        const resObj = data1.result || data1.data || data1;
        audioUrl = resObj?.downloadUrl || resObj?.url || resObj?.audio || resObj?.link;
        if (resObj?.title) title = resObj.title;
      } catch {}

      // Fallback 1: savetube
      if (!audioUrl) {
        try {
          const res2 = await fetch(`https://apis.emmyhenztech.xyz/api/savetube?url=${encodeURIComponent(targetUrl)}`);
          const data2 = await res2.json();
          const resObj2 = data2.result || data2;
          audioUrl = resObj2?.audio || resObj2?.mp3 || resObj2?.url || resObj2?.link;
        } catch {}
      }

      if (audioUrl) {
        await sock.sendMessage(
          remoteJid,
          {
            audio: { url: audioUrl },
            mimetype: "audio/mp4",
            fileName: `${title}.mp3`,
            caption: "Successfully Downloaded ✅️"
          },
          { quoted: message }
        );
      } else {
        await reply(formatError(`Could not retrieve audio download for '${query}'. Please try another search term.`));
      }
    } catch (err) {
      console.error("[Music Downloader Error]", err);
      await reply(formatError(`Failed to download music: ${err.message || err}`));
    }
  }
};
