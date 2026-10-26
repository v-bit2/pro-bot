import { updateSettings, getSettings } from "../../lib/db.js";
import { formatSuccess } from "../../lib/format.js";

export const command = {
  name: "autotyping",
  aliases: ["autotype"],
  category: "OWNER",
  description: "Toggle automatic composing presence for bot responses",
  usage: ".autotyping",
  ownerOnly: true,
  async execute({ sock, message }) {
    const current = getSettings().autoTyping;
    const next = !current;
    updateSettings({ autoTyping: next });
    await sock.sendMessage(message.key.remoteJid, { text: next ? "autotyping Enabled ✅️" : "autotyping Disabled ❌️" }, { quoted: message });
  }
};
