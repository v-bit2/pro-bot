export const command = {
  name: "mydesc",
  aliases: ["setbio", "setdesc", "mybio"],
  category: "OWNER",
  description: "Update account profile description/about text (.mydesc <new_bio_text>)",
  usage: ".mydesc <text>",
  ownerOnly: true,
  async execute({ sock, args, reply }) {
    if (args.length < 1) {
      await reply("Usage: .mydesc <new_bio_text>\nExample: .mydesc VOLTRA MD Bot Owner");
      return;
    }

    const newBio = args.join(" ").trim();

    if (typeof sock.updateProfileStatus !== "function") {
      await reply("The installed Baileys library does not support profile bio update.");
      return;
    }

    try {
      await sock.updateProfileStatus(newBio);
      await reply("Profile description updated successfully ✓");
    } catch (err) {
      console.error("[mydesc Error]:", err.message);
      await reply(`Failed to update profile description: ${err.message || err}`);
    }
  }
};
