import { getSessionSettings } from "../lib/db.js";

export const command = {
  name: "password",
  aliases: ["pswd", "pin", "sessionpin"],
  category: "OWNER",
  description: "View or retrieve your unique 8-digit session PIN password for REST API settings management (.password)",
  usage: ".password",
  ownerOnly: true,
  async execute({ sock, reply }) {
    const userPhone = sock.user?.id ? sock.user.id.split(":")[0] : "session";
    const sessionCfg = getSessionSettings(userPhone);

    const pinCode = sessionCfg.pin;
    await reply(`🔐 Session Settings Password: \`${pinCode}\`\n\nUse this 8-digit PIN to manage your session settings via the REST API.`);
  }
};
