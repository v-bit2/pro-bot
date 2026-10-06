import { updateSettings, getSettings } from "../lib/db.js";
import { formatSuccess } from "../lib/format.js";

export const command = {
  name: "autotyping",
  aliases: ["autotype"],
  category: "OWNER",
  description: "Toggle automatic composing presence for bot responses",
  usage: ".autotyping",
  ownerOnly: true,
  async execute({ reply }) {
    const current = getSettings().autoTyping;
    const next = !current;
    updateSettings({ autoTyping: next });
    await reply(formatSuccess(`Auto typing presence is now *${next ? "ENABLED" : "DISABLED"}*`));
  }
};
