import { formatBox, formatError } from "../lib/format.js";

export const command = {
  name: "meme",
  aliases: ["randommeme"],
  category: "FUN",
  description: "Get a trending meme from Reddit",
  usage: ".meme",
  async execute({ sock, message, reply, remoteJid }) {
    try {
      const res = await fetch("https://meme-api.com/gimme");
      if (res.ok) {
        const data = await res.json();
        await sock.sendMessage(remoteJid, {
          image: { url: data.url },
          caption: formatBox("MEME 🎭", `${data.title}\nSubreddit: r/${data.subreddit}`)
        }, { quoted: message });
        return;
      }
    } catch (err) {
      await reply(formatError("Failed to fetch meme. Please try again."));
    }
  }
};
