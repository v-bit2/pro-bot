export const command = {
  name: "gcdesc",
  aliases: ["setgcdesc", "groupdesc"],
  category: "ADMIN",
  description: "Update group description (.gcdesc <new_description_text>)",
  usage: ".gcdesc <text>",
  groupOnly: true,
  adminOnly: true,
  botAdminRequired: true,
  async execute({ sock, args, remoteJid, reply }) {
    if (args.length < 1) {
      await reply("Usage: .gcdesc <new_group_description>\nExample: .gcdesc Welcome to Voltra Group!");
      return;
    }

    const newDesc = args.join(" ").trim();

    if (typeof sock.groupUpdateDescription !== "function") {
      await reply("The installed Baileys library does not support group description update.");
      return;
    }

    try {
      await sock.groupUpdateDescription(remoteJid, newDesc);
      await reply("Group description updated successfully ✓");
    } catch (err) {
      console.error("[gcdesc Error]:", err.message);
      await reply(`Failed to update group description: ${err.message || err}`);
    }
  }
};
