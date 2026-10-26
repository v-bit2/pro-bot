export const command = {
  name: "deletess",
  aliases: ["removess", "unlinkss", "deletesession"],
  category: "OWNER",
  description: "Delete current WhatsApp session, unlink device and remove MongoDB files (.deletess)",
  usage: ".deletess",
  ownerOnly: true,
  async execute({ sock, reply, sessionManager }) {
    const userPhone = sock.user?.id ? sock.user.id.split(":")[0] : null;

    if (!userPhone) {
      await reply("Could not resolve current session ID.");
      return;
    }

    await reply("Unlinking session, logging out from WhatsApp and removing persistent files... Goodbye!");

    if (sessionManager) {
      try {
        await sessionManager.disconnect(userPhone);
      } catch (err) {
        console.error("[deletess Error]:", err.message);
      }
    }
  }
};
