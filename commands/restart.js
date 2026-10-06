import { formatSuccess } from "../lib/format.js";

export const command = {
  name: "restart",
  aliases: ["reboot"],
  category: "OWNER",
  description: "Safely restart the bot process",
  usage: ".restart",
  ownerOnly: true,
  async execute({ reply }) {
    await reply(formatSuccess("Restarting Voltra Mini process..."));
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
};
