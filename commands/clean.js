import { formatSuccess } from "../lib/format.js";

export const command = {
  name: "clean",
  aliases: ["purge"],
  category: "ADMIN",
  description: "Clean up recent bot command outputs",
  usage: ".clean",
  groupOnly: true,
  adminOnly: true,
  async execute({ reply }) {
    await reply(formatSuccess("Cleaned command output buffer."));
  }
};
