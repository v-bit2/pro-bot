export const command = {
  name: "rvk",
  aliases: ["revoke", "revokelink", "resetlink"],
  category: "ADMIN",
  description: "Revoke and reset group invite link (.rvk)",
  usage: ".rvk",
  groupOnly: true,
  adminOnly: true,
  botAdminRequired: true,
  async execute({ sock, remoteJid, reply }) {
    if (typeof sock.groupRevokeInvite !== "function") {
      await reply("The installed Baileys library does not support groupRevokeInvite.");
      return;
    }

    try {
      const newCode = await sock.groupRevokeInvite(remoteJid);
      const newInviteUrl = `https://chat.whatsapp.com/${newCode}`;
      await reply(`Group invite link revoked ✓\nNew Link:\n${newInviteUrl}`);
    } catch (err) {
      console.error("[rvk Error]:", err.message);
      await reply(`Failed to revoke group invite link: ${err.message || err}`);
    }
  }
};
