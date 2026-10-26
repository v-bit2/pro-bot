import { downloadMediaMessage } from "@whiskeysockets/baileys";

export const command = {
  name: "mypp",
  aliases: ["setpp", "setprofilepicture"],
  category: "OWNER",
  description: "Set account profile picture by replying to an image (.mypp)",
  usage: ".mypp (reply to image)",
  ownerOnly: true,
  async execute({ sock, message, reply }) {
    const q = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const mediaMsg = q?.imageMessage ? { message: q } : (message.message?.imageMessage ? message : null);

    if (!mediaMsg) {
      await reply("Please reply to an image or attach an image to set as your profile picture.");
      return;
    }

    if (typeof sock.updateProfilePicture !== "function") {
      await reply("The installed Baileys library does not support profile picture update.");
      return;
    }

    try {
      const buffer = await downloadMediaMessage(
        mediaMsg,
        "buffer",
        {},
        { logger: sock.logger, reuploadRequest: sock.updateMediaMessage }
      );

      const userJid = sock.user?.id ? sock.user.id.split(":")[0] + "@s.whatsapp.net" : null;
      if (!userJid) {
        await reply("Could not determine user JID for profile picture update.");
        return;
      }

      await sock.updateProfilePicture(userJid, buffer);
      await reply("Profile picture updated successfully ✓");
    } catch (err) {
      console.error("[mypp Error]:", err.message);
      await reply(`Failed to update profile picture: ${err.message || err}`);
    }
  }
};
