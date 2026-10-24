import { getSessionSettings } from "../lib/db.js";

export const command = {
  name: "password",
  aliases: ["pswd", "pin", "sessionpin"],
  category: "OWNER",
  description: "View or retrieve your unique 8-digit session PIN password for REST API settings management (.password)",
  usage: ".password",
  ownerOnly: true,
  async execute({ sock, message }) {
    const targetSessionId = sock.sessionId || (sock.user?.id ? sock.user.id.split(":")[0] : "session");
    const sessionCfg = getSessionSettings(targetSessionId);

    const pinCode = sessionCfg.pin;
    await sock.sendMessage(message.key.remoteJid, {
      text: pinCode
    }, { quoted: message });
  }
};
