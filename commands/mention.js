import { formatResponse, formatError } from "../lib/format.js";

export const command = {
  name: "mention",
  aliases: ["notify", "announcement"],
  category: "GROUP",
  description: "Mention group participants with a message",
  usage: ".mention <text>",
  groupOnly: true,
  adminOnly: true,
  async execute({ sock, message, args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply(formatError("Please provide a message to send to group participants."));
      return;
    }

    const groupMeta = await sock.groupMetadata(remoteJid);
    const participants = groupMeta.participants || [];
    const mentions = participants.map(p => p.id);
    const content = args.join(" ");

    const text = formatResponse(`📢 Announcement:\n\n${content}`, "GROUP");
    await sock.sendMessage(remoteJid, { text, mentions }, { quoted: message });
  }
};
