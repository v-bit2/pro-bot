import { formatBox } from "../lib/format.js";

const compliments = [
  "You're a ray of sunshine on a cloudy day!",
  "Your smile is infectious!",
  "You're smarter than Google!",
  "You bring out the best in everyone around you!"
];

export const command = {
  name: "compliment",
  category: "FUN",
  description: "Send a sweet compliment to yourself or a friend",
  usage: ".compliment [@user]",
  async execute({ reply }) {
    const comp = compliments[Math.floor(Math.random() * compliments.length)];
    await reply(formatBox("COMPLIMENT 💖", comp));
  }
};
