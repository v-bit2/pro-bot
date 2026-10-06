import { formatBox, formatError } from "../lib/format.js";

export const command = {
  name: "grouplink",
  aliases: ["linkgroup", "glink"],
  category: "ADMIN",
  description: "Get the invite link for the current group",
  usage: ".grouplink",
  groupOnly: true,
  adminOnly: true,
  botAdminRequired: true,
  async execute({ sock, reply, remoteJid }) {
    try {
      const code = await sock.groupInviteCode(remoteJid);
      const link = `https://chat.whatsapp.com/${code}`;
      await reply(formatBox("GROUP INVITE LINK", `Invite Link:\n${link}`));
    } catch (err) {
      await reply(formatError(`Failed to fetch invite code: ${err.message}`));
    }
  }
};
