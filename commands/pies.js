import { formatBox } from "../lib/format.js";

const pieTypes = ["Apple Pie 🥧", "Cherry Pie 🥧", "Pumpkin Pie 🥧", "Blueberry Pie 🥧"];

export const command = {
  name: "pies",
  category: "FUN",
  description: "Serve a delicious slice of pie",
  usage: ".pies",
  async execute({ reply }) {
    const pie = pieTypes[Math.floor(Math.random() * pieTypes.length)];
    await reply(formatBox("DELICIOUS PIE 🥧", `Here is a fresh slice of ${pie}`));
  }
};
