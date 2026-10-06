import { formatBox } from "../lib/format.js";

const lines = [
  "Are you a magician? Because whenever I look at you, everyone else disappears! 😉",
  "Is your name Wi-Fi? Because I'm feeling a really strong connection! 📶",
  "Are you made of copper and tellurium? Because you're CuTe! 🧪",
  "Do you have a map? I just got lost in your eyes! 🗺️"
];

export const command = {
  name: "flirt",
  category: "FUN",
  description: "Get a cheesy pickup line to flirt with someone",
  usage: ".flirt",
  async execute({ reply }) {
    const line = lines[Math.floor(Math.random() * lines.length)];
    await reply(formatBox("FLIRT LINE 😉", line));
  }
};
