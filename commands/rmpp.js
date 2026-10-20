export const command = {
  name: "rmpp",
  aliases: ["removepp", "deletepp"],
  category: "OWNER",
  description: "Remove account profile picture (.rmpp)",
  usage: ".rmpp",
  ownerOnly: true,
  async execute({ sock, reply }) {
    if (typeof sock.removeProfilePicture !== "function") {
      await reply("The installed Baileys library does not support profile picture removal.");
      return;
    }

    try {
      const userJid = sock.user?.id ? sock.user.id.split(":")[0] + "@s.whatsapp.net" : null;
      if (!userJid) {
        await reply("Could not determine user JID for profile picture removal.");
        return;
      }

      await sock.removeProfilePicture(userJid);
      await reply("Profile picture removed successfully ✓");
    } catch (err) {
      console.error("[rmpp Error]:", err.message);
      await reply(`Failed to remove profile picture: ${err.message || err}`);
    }
  }
};
