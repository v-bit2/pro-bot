import { formatSuccess, formatError } from "../lib/format.js";

export const command = {
  name: "mute",
  aliases: ["closegroup"],
  category: "ADMIN",
  description: "Mute the group so only administrators can send messages",
  usage: ".mute",
  groupOnly: true,
  adminOnly: true,
  botAdminRequired: true,
  async execute({ sock, reply, remoteJid }) {
    try {
      await sock.groupSettingUpdate(remoteJid, "announcement");
      await reply(formatSuccess("Group muted. Only administrators can send messages now."));
    } catch (err) {
      await reply(formatError(`Failed to mute group: ${err.message}`));
    }
  }
};
