import { formatSuccess, formatError } from "../lib/format.js";

export const command = {
  name: "broadcast",
  aliases: ["bc"],
  category: "OWNER",
  description: "Broadcast an announcement message to all joined groups",
  usage: ".broadcast <message>",
  ownerOnly: true,
  async execute({ sock, args, reply }) {
    if (args.length === 0) {
      await reply(formatError("Please enter text to broadcast."));
      return;
    }

    const bcText = args.join(" ");

    try {
      const chats = await sock.groupFetchAllParticipating();
      const groupJids = Object.keys(chats);

      let successCount = 0;
      for (const jid of groupJids) {
        try {
          await sock.sendMessage(jid, { text: `📢 *VOLTRA BROADCAST*\n\n${bcText}` });
          successCount++;
        } catch {}
      }

      await reply(formatSuccess(`Broadcast sent to ${successCount} group(s)!`));
    } catch (err) {
      await reply(formatError(`Broadcast failed: ${err.message}`));
    }
  }
};
