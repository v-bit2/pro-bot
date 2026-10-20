export const command = {
  name: "myname",
  aliases: ["setname", "setpushname"],
  category: "OWNER",
  description: "Update account display/push name (.myname <new_name>)",
  usage: ".myname <text>",
  ownerOnly: true,
  async execute({ sock, args, reply }) {
    if (args.length < 1) {
      await reply("Usage: .myname <new_display_name>\nExample: .myname Voltra Bot");
      return;
    }

    const newName = args.join(" ").trim();

    if (typeof sock.updateProfileName !== "function") {
      await reply("The installed Baileys library does not support display name update.");
      return;
    }

    try {
      await sock.updateProfileName(newName);
      await reply("Profile display name updated successfully ✓");
    } catch (err) {
      console.error("[myname Error]:", err.message);
      await reply(`Failed to update display name: ${err.message || err}`);
    }
  }
};
