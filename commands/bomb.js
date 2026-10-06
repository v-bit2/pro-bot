import { formatBox } from "../lib/format.js";

export const command = {
  name: "bomb",
  category: "FUN",
  description: "Plant a fun countdown bomb in the chat",
  usage: ".bomb",
  async execute({ reply }) {
    await reply(formatBox("BOMB PLANTED 💣", "3... 2... 1... 💥 BOOM!"));
  }
};
