import { formatBox, formatError } from "../lib/format.js";

export const command = {
  name: "memesearch",
  aliases: ["smeme"],
  category: "FUN",
  description: "Search for a meme by subreddit topic keyword",
  usage: ".memesearch <subreddit>",
  async execute({ sock, message, args, reply, remoteJid }) {
    const sub = args.length > 0 ? args[0].replace(/[^a-zA-Z0-9_]/g, "") : "dankmemes";

    try {
      const res = await fetch(`https://meme-api.com/gimme/${encodeURIComponent(sub)}`);
      if (res.ok) {
        const data = await res.json();
        await sock.sendMessage(remoteJid, {
          image: { url: data.url },
          caption: formatBox("MEME SEARCH 🎭", `${data.title}\nSubreddit: r/${data.subreddit}`)
        }, { quoted: message });
        return;
      }
      await reply(formatError(`Subreddit '${sub}' not found or has no image memes.`));
    } catch (err) {
      await reply(formatError("Failed to search meme."));
    }
  }
};
