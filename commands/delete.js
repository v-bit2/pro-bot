import { formatError } from "../lib/format.js";

export const command = {
  name: "delete",
  aliases: ["del"],
  category: "ADMIN",
  description: "Delete a quoted message in the group",
  usage: ".delete (reply to message)",
  groupOnly: true,
  adminOnly: true,
  botAdminRequired: true,
  async execute({ sock, message, reply, remoteJid }) {
    const quoted = message.message?.extendedTextMessage?.contextInfo;
    if (!quoted?.stanzaId) {
      await reply(formatError("Please reply to the message you want to delete."));
      return;
    }

    try {
      await sock.sendMessage(remoteJid, {
        delete: {
          remoteJid,
          fromMe: quoted.participant === sock.user?.id?.split(":")[0] + "@s.whatsapp.net",
          id: quoted.stanzaId,
          participant: quoted.participant
        }
      });
    } catch (err) {
      await reply(formatError(`Failed to delete message: ${err.message}`));
    }
  }
};
