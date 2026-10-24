import { playSearchDownload, ryuuYoutube, downloadBuffer } from "../lib/ryuuYt.js";
import { sendAudioSafe } from "../lib/sendAudioSafe.js";

export const command = {
  name: "mp3",
  aliases: ["song", "music", "play", "ply", "playy", "pl"],
  category: "DOWNLOADER",
  description: "Downloads songs from YouTube and sends audio (.mp3 <song_name_or_url>)",
  usage: ".mp3 <song_name_or_url>",
  async execute({ sock, message, args, reply, remoteJid }) {
    await sock.sendMessage(remoteJid, { react: { text: "⌛", key: message.key } }).catch(() => {});
    const fmt = (msg) => `╭─❏ 「 PLAY」\n│ ${msg}\n╰───────────────\n> VOLTRA MD`;

    try {
      const query = (args.join(" ") || "").trim();
      if (!query) {
        await sock.sendMessage(remoteJid, { react: { text: "❌", key: message.key } }).catch(() => {});
        return reply(fmt("Give a song name OR a YouTube link.\n│ Example: .play harlem shake"));
      }

      const isYoutubeLink = /(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/)/i.test(query);
      let media;
      if (isYoutubeLink) {
        media = await ryuuYoutube(query, "mp3");
      } else {
        media = await playSearchDownload(query);
      }

      const buf = await downloadBuffer(media.link);
      const title = (media.title || query || "audio").slice(0, 80);
      const meta = [media.channel, media.duration].filter(Boolean).join(" · ");
      const caption = `╭─❏ 「 PLAY」\n│ 🎵 ${title}${meta ? `\n│ ${meta}` : ""}\n╰───────────────\n> VOLTRA MD`;

      await sendAudioSafe(sock, remoteJid, buf, {
        title,
        quoted: message,
        caption
      });

      await sock.sendMessage(remoteJid, { react: { text: "✅", key: message.key } }).catch(() => {});
    } catch (error) {
      console.error("play error:", error);
      await sock.sendMessage(remoteJid, { react: { text: "❌", key: message.key } }).catch(() => {});
      await reply(fmt(`Play failed: ${error.message || error}`));
    }
  }
};
