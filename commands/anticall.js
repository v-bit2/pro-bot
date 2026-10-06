import { updateSettings, getSettings } from "../lib/db.js";
import { formatSuccess } from "../lib/format.js";

export const command = {
  name: "anticall",
  aliases: ["nocall"],
  category: "OWNER",
  description: "Toggle anti-call protection setting",
  usage: ".anticall",
  ownerOnly: true,
  async execute({ reply }) {
    const current = getSettings().antiCall;
    const next = !current;
    updateSettings({ antiCall: next });
    await reply(formatSuccess(`Anti-Call setting is now *${next ? "ENABLED" : "DISABLED"}*`));
  }
};
