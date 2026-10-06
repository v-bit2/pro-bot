import { formatBox, formatError } from "../lib/format.js";

const fallbackJokes = [
  "Why do programmers prefer dark mode? Because light attracts bugs!",
  "There are 10 types of people in the world: Those who understand binary, and those who don't.",
  "Why did the JavaScript developer wear glasses? Because he didn't C#!",
  "A SQL query walks into a bar, walks up to two tables and asks: 'Can I join you?'"
];

export const command = {
  name: "joke",
  aliases: ["randomjoke"],
  category: "FUN",
  description: "Get a random funny joke",
  usage: ".joke",
  async execute({ reply }) {
    try {
      const res = await fetch("https://official-joke-api.appspot.com/random_jokes");
      if (res.ok) {
        const data = await res.json();
        await reply(formatBox("JOKE TIME 🤣", `${data.setup}\n\n${data.punchline}`));
        return;
      }
    } catch {}

    const random = fallbackJokes[Math.floor(Math.random() * fallbackJokes.length)];
    await reply(formatBox("JOKE TIME 🤣", random));
  }
};
