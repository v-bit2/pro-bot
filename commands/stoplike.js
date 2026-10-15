import { removeChannelReactionConfig } from "../lib/channel-manager.js";
import { formatSuccess, formatError } from "../lib/format.js";

export const command = {
  name: "stoplike",
  aliases: ["stopautolike", "removeautolike"],
  category: "OWNER",
  description: "Disable automatic reactions for a specified WhatsApp newsletter channel JID",
  usage: ".stoplike <120363012345678901@newsletter>",
  ownerOnly: true,
  async execute({ sock, message, args, reply }) {
    if (args.length === 0) {
      await reply(formatError("Please specify a channel JID ending in @newsletter, e.g. .stoplike 120363012345678901@newsletter"));
      return;
    }

    const jid = args[0].trim();
    if (!jid.endsWith("@newsletter")) {
      await reply(formatError("Invalid channel JID. Channel JIDs must end with @newsletter"));
      return;
    }

    removeChannelReactionConfig(jid);
    await sock.sendMessage(message.key.remoteJid, { text: "Autolike Disabled ❌️" }, { quoted: message });
  }
};
