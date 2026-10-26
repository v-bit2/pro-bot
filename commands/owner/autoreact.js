import { updateSettings, getSettings } from "../../lib/db.js";
import { formatSuccess } from "../../lib/format.js";

export const command = {
  name: "autoreact",
  aliases: ["reactbot"],
  category: "OWNER",
  description: "Toggle automatic reaction on incoming commands",
  usage: ".autoreact",
  ownerOnly: true,
  async execute({ sock, message }) {
    const current = getSettings().autoReact;
    const next = !current;
    updateSettings({ autoReact: next });
    await sock.sendMessage(message.key.remoteJid, { text: next ? "autoreact Enabled ✅️" : "autoreact Disabled ❌️" }, { quoted: message });
  }
};
