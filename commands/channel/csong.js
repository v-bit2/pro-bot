import yts from "yt-search";

export const pendingChannelSongs = new Map(); // key: `${senderJid}_${remoteJid}` -> { newsletterJid, videoUrl, title, duration, thumbnail }

export const command = {
  name: "csong",
  aliases: ["channelsong", "chsong"],
  category: "CHANNEL",
  description: "Send a YouTube song to a WhatsApp channel with two-step confirmation (.csong <channel_url> <song_query>)",
  usage: ".csong <channel_url> <song_query>",
  async execute({ sock, message, args, reply, remoteJid, senderJid }) {
    if (args.length < 2) {
      await reply("Usage: .csong <channel_url> <song_name_or_youtube_url>\nExample: .csong https://whatsapp.com/channel/0029VaXXXX Drake Hotline Bling");
      return;
    }

    const channelInput = args[0].trim();
    const songQuery = args.slice(1).join(" ").trim();

    // Parse channel invite code / URL
    const match = channelInput.match(/whatsapp\.com\/channel\/([a-zA-Z0-9_-]+)/i);
    let inviteCode = match ? match[1] : channelInput;

    let newsletterJid = inviteCode;
    if (!newsletterJid.endsWith("@newsletter") && typeof sock.newsletterMetadata === "function") {
      try {
        const meta = await sock.newsletterMetadata("invite", inviteCode);
        if (meta?.id) {
          newsletterJid = meta.id.endsWith("@newsletter") ? meta.id : `${meta.id}@newsletter`;
        } else {
          newsletterJid = `${inviteCode}@newsletter`;
        }
      } catch {
        newsletterJid = `${inviteCode}@newsletter`;
      }
    }

    // Resolve YouTube video metadata
    let video;
    if (/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)/i.test(songQuery)) {
      const matchUrl = songQuery.match(/(?:watch\?v=|embed\/|v\/|shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (matchUrl && matchUrl[1]) {
        try {
          video = await yts({ videoId: matchUrl[1] });
        } catch {
          video = { url: songQuery, title: "YouTube Video", timestamp: "N/A" };
        }
      } else {
        video = { url: songQuery, title: "YouTube Video", timestamp: "N/A" };
      }
    } else {
      const search = await yts(songQuery);
      video = search?.videos?.[0];
    }

    if (!video || !video.url) {
      await reply("No YouTube song result found.");
      return;
    }

    const pendingKey = `${senderJid}_${remoteJid}`;
    pendingChannelSongs.set(pendingKey, {
      newsletterJid,
      videoUrl: video.url,
      title: video.title,
      duration: video.timestamp || "N/A",
      thumbnail: video.thumbnail || ""
    });

    const captionText =
      `🎵 *CHANNEL SONG CONFIRMATION*\n\n` +
      `📌 *Title:* ${video.title}\n` +
      `⏱ *Duration:* ${video.timestamp || "N/A"}\n` +
      `📢 *Target Channel:* ${newsletterJid}\n\n` +
      `Reply with:\n` +
      `*1* ➔ Confirm & send song to channel\n` +
      `*2* ➔ Cancel request`;

    if (video.thumbnail) {
      await sock.sendMessage(
        remoteJid,
        {
          image: { url: video.thumbnail },
          caption: captionText
        },
        { quoted: message }
      );
    } else {
      await reply(captionText);
    }
  }
};
