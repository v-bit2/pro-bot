import { formatBox } from "../lib/format.js";

const insults = [
  "You're like a cloud. When you disappear, it's a beautiful day!",
  "I'd agree with you, but then we'd both be wrong.",
  "You bring everyone so much joy... when you leave the room!",
  "I'm jealous of all the people that haven't met you!"
];

export const command = {
  name: "insult",
  category: "FUN",
  description: "Send a playful roast or insult",
  usage: ".insult",
  async execute({ reply }) {
    const roast = insults[Math.floor(Math.random() * insults.length)];
    await reply(formatBox("PLAYFUL ROAST 🔥", roast));
  }
};
