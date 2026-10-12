import { formatResponse, formatError } from "../lib/format.js";

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
      // Query music search service
      const res = await fetch(`https://api.vkrdown.com/v1/youtube?url=${encodeURIComponent(query)}`);
      const data = await res.json().catch(() => ({}));

      const item = data?.data || data;
      const audioUrl = item?.audio || item?.mp3 || item?.downloadUrl || item?.url;
      const title = item?.title || query;

      if (audioUrl) {
        await sock.sendMessage(
          remoteJid,
          {
            audio: { url: audioUrl },
            mimetype: "audio/mp4",
            fileName: `${title}.mp3`,
            caption: formatResponse(`🎵 *Music Download*\n\n✦ *Title:* ${title}`, "MUSIC")
          },
          { quoted: message }
        );
      } else {
        // Fallback: search YouTube MP3
        const res2 = await fetch(`https://api.vkrdown.com/v1/ytmp3?query=${encodeURIComponent(query)}`);
        const data2 = await res2.json().catch(() => ({}));
        const audioUrl2 = data2?.url || data2?.download;

        if (audioUrl2) {
          await sock.sendMessage(
            remoteJid,
            {
              audio: { url: audioUrl2 },
              mimetype: "audio/mp4",
              fileName: `${query}.mp3`
            },
            { quoted: message }
          );
          return;
        }

        await reply(formatError(`Could not find audio for '${query}'. Please try a more specific search.`));
      }
    } catch (err) {
      console.error("[Music Downloader Error]", err);
      await reply(formatError(`Failed to download music: ${err.message || err}`));
    }
  }
};
