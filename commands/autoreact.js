import { updateSettings, getSettings } from "../lib/db.js";
import { formatSuccess } from "../lib/format.js";

export const command = {
  name: "autoreact",
  aliases: ["reactbot"],
  category: "OWNER",
  description: "Toggle automatic reaction on incoming commands",
  usage: ".autoreact",
  ownerOnly: true,
  async execute({ reply }) {
    const current = getSettings().autoReact;
    const next = !current;
    updateSettings({ autoReact: next });
    await reply(formatSuccess(`Auto reaction is now *${next ? "ENABLED" : "DISABLED"}*`));
  }
};
