import { addChannelReactionConfig } from "../../lib/channel-manager.js";

export const command = {
  name: "autolike",
  aliases: ["autoreactch"],
  category: "channel",
  description: "Configure automatic reactions on a channel post",
  usage: ".autolike <channel_url> <emojis>",

  async execute(sock, msg, args, extra) {
    const chatId = msg.key.remoteJid;
    if (args.length < 2) {
      return sock.sendMessage(chatId, { text: "⚠️ Usage: .autolike <channel_url> <emojis>" }, { quoted: msg });
    }

    const [channelUrl, ...emojiParts] = args;
    const emojis = emojiParts.join(" ").split(/[\s,]+/).filter(Boolean);

    try {
      const config = addChannelReactionConfig(channelUrl, emojis);
      await sock.sendMessage(chatId, {
        text: `✅ *Auto-Reaction Configured*\n\nChannel: ${config.jid}\nEmojis: ${config.emojis.join(" ")}`
      }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(chatId, { text: `❌ ${err.message}` }, { quoted: msg });
    }
  }
};
