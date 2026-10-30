import { removeChannelReactionConfig } from "../../lib/channel-manager.js";

export const command = {
  name: "stoplike",
  aliases: ["stopreactch"],
  category: "channel",
  description: "Remove automatic channel reaction config",
  usage: ".stoplike <channel_url_or_jid>",

  async execute(sock, msg, args, extra) {
    const chatId = msg.key.remoteJid;
    if (!args.length) {
      return sock.sendMessage(chatId, { text: "⚠️ Usage: .stoplike <channel_url_or_jid>" }, { quoted: msg });
    }

    const removed = removeChannelReactionConfig(args[0]);
    if (removed) {
      await sock.sendMessage(chatId, { text: "✅ Removed auto-reaction configuration." }, { quoted: msg });
    } else {
      await sock.sendMessage(chatId, { text: "⚠️ No auto-reaction configuration found." }, { quoted: msg });
    }
  }
};
