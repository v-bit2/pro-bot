import { formatSuccess, formatError } from "../lib/format.js";

export const command = {
  name: "unmute",
  aliases: ["opengroup"],
  category: "ADMIN",
  description: "Unmute the group so all participants can send messages",
  usage: ".unmute",
  groupOnly: true,
  adminOnly: true,
  botAdminRequired: true,
  async execute({ sock, reply, remoteJid }) {
    try {
      await sock.groupSettingUpdate(remoteJid, "not_announcement");
      await reply(formatSuccess("Group unmuted. All members can send messages now."));
    } catch (err) {
      await reply(formatError(`Failed to unmute group: ${err.message}`));
    }
  }
};
