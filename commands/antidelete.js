import { updateSettings, getSettings } from "../lib/db.js";
import { formatSuccess } from "../lib/format.js";

export const command = {
  name: "antidelete",
  aliases: ["nodelete"],
  category: "OWNER",
  description: "Toggle anti-delete protection setting",
  usage: ".antidelete",
  ownerOnly: true,
  async execute({ reply }) {
    const current = getSettings().antiDelete;
    const next = !current;
    updateSettings({ antiDelete: next });
    await reply(formatSuccess(`Anti-Delete setting is now *${next ? "ENABLED" : "DISABLED"}*`));
  }
};
