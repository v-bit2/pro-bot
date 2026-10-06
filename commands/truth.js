import { formatBox } from "../lib/format.js";

const truths = [
  "What is the most embarrassing thing you've ever done?",
  "What is a secret you've never told anyone in this group?",
  "Who was your first crush?",
  "What is your biggest fear?"
];

export const command = {
  name: "truth",
  category: "FUN",
  description: "Get a random truth question",
  usage: ".truth",
  async execute({ reply }) {
    const truth = truths[Math.floor(Math.random() * truths.length)];
    await reply(formatBox("TRUTH QUESTION ❓", truth));
  }
};
