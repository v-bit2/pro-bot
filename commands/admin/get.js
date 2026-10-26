export const command = {
  name: "get",
  aliases: ["gclink", "invitelink", "linkgc"],
  category: "ADMIN",
  description: "Get group invite link (.get)",
  usage: ".get",
  groupOnly: true,
  adminOnly: true,
  botAdminRequired: true,
  async execute({ sock, remoteJid, reply }) {
    if (typeof sock.groupInviteCode !== "function") {
      await reply("The installed Baileys library does not support groupInviteCode.");
      return;
    }

    try {
      const code = await sock.groupInviteCode(remoteJid);
      if (!code) {
        await reply("Failed to retrieve group invite code.");
        return;
      }
      const inviteUrl = `https://chat.whatsapp.com/${code}`;
      await reply(`Group Invite Link:\n${inviteUrl}`);
    } catch (err) {
      console.error("[get Error]:", err.message);
      await reply(`Failed to get group invite link: ${err.message || err}`);
    }
  }
};
