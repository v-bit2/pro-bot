import { formatBox } from "../lib/format.js";

const dares = [
  "Send a voice note singing your favorite song for 15 seconds!",
  "Change your profile picture to an anime avatar for 2 hours!",
  "Type your next message using only emojis!",
  "Text your crush or best friend 'I have a confession to make...'"
];

export const command = {
  name: "dare",
  category: "FUN",
  description: "Get a random fun dare challenge",
  usage: ".dare",
  async execute({ reply }) {
    const dare = dares[Math.floor(Math.random() * dares.length)];
    await reply(formatBox("DARE CHALLENGE 🎯", dare));
  }
};
