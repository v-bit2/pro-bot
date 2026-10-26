export const command = {
  name: "gcname",
  aliases: ["setgcname", "groupname"],
  category: "ADMIN",
  description: "Update group name/subject (.gcname <new_name>)",
  usage: ".gcname <text>",
  groupOnly: true,
  adminOnly: true,
  botAdminRequired: true,
  async execute({ sock, args, remoteJid, reply }) {
    if (args.length < 1) {
      await reply("Usage: .gcname <new_group_name>\nExample: .gcname VOLTRA Squad");
      return;
    }

    const newSubject = args.join(" ").trim();

    if (typeof sock.groupUpdateSubject !== "function") {
      await reply("The installed Baileys library does not support group subject update.");
      return;
    }

    try {
      await sock.groupUpdateSubject(remoteJid, newSubject);
      await reply("Group name updated successfully ✓");
    } catch (err) {
      console.error("[gcname Error]:", err.message);
      await reply(`Failed to update group name: ${err.message || err}`);
    }
  }
};
