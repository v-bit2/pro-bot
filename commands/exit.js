export const command = {
  name: "exit",
  aliases: ["leave", "leavegc"],
  category: "ADMIN",
  description: "Bot leaves the current group chat (.exit)",
  usage: ".exit",
  groupOnly: true,
  adminOnly: true,
  async execute({ sock, remoteJid, reply }) {
    await reply("Goodbye! Voltra Mini is leaving this group...");

    if (typeof sock.groupLeave !== "function") {
      await reply("The installed Baileys library does not support groupLeave.");
      return;
    }

    try {
      await sock.groupLeave(remoteJid);
    } catch (err) {
      console.error("[exit Error]:", err.message);
      await reply(`Failed to leave group: ${err.message || err}`);
    }
  }
};
