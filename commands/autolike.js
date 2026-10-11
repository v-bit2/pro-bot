import { addChannelReactionConfig } from "../lib/channel-manager.js";
import { formatSuccess, formatError } from "../lib/format.js";

export const command = {
  name: "autolike",
  aliases: ["channeautolike", "addautolike"],
  category: "OWNER",
  description: "Enable automatic reactions for a specified WhatsApp newsletter channel JID",
  usage: ".autolike <120363012345678901@newsletter>",
  ownerOnly: true,
  async execute({ args, reply }) {
    if (args.length === 0) {
      await reply(formatError("Please specify a channel JID ending in @newsletter, e.g. .autolike 120363012345678901@newsletter"));
      return;
    }

    const jid = args[0].trim();
    if (!jid.endsWith("@newsletter")) {
      await reply(formatError("Invalid channel JID. Channel JIDs must end with @newsletter"));
      return;
    }

    const success = addChannelReactionConfig(jid);
    if (success) {
      await reply(formatSuccess(`Enabled automatic channel reactions for *${jid}*`));
    } else {
      await reply(formatError(`Failed to enable autolike for *${jid}*`));
    }
  }
};
