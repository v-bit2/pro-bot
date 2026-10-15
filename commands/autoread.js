import { updateSettings, getSettings } from "../lib/db.js";
import { formatSuccess } from "../lib/format.js";

export const command = {
  name: "autoread",
  aliases: ["readstatus"],
  category: "OWNER",
  description: "Toggle automatic read receipt mark for incoming messages",
  usage: ".autoread",
  ownerOnly: true,
  async execute({ sock, message }) {
    const current = getSettings().autoRead;
    const next = !current;
    updateSettings({ autoRead: next });
    await sock.sendMessage(message.key.remoteJid, { text: next ? "autoread Enabled ✅️" : "autoread Disabled ❌️" }, { quoted: message });
  }
};
