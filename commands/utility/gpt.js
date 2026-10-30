import { formatError } from "../../lib/format.js";

export const command = {
  name: "gpt",
  aliases: ["gpt5", "askgpt", "ai"],
  category: "UTILITY",
  description: "Chat with GPT AI (.gpt <prompt>)",
  usage: ".gpt <prompt>",
  async execute({ args, reply }) {
    if (args.length === 0) {
      await reply("Please provide a prompt for GPT AI.\n\nExample: .gpt Explain quantum computing in simple terms");
      return;
    }

    const prompt = args.join(" ").trim();

    try {
      const res = await fetch(`https://prexzyapis.com/ai/askgpt5?prompt=${encodeURIComponent(prompt)}`);
      const data = await res.json();
      const responseText = data?.result || data?.response || data?.message || data?.data || (typeof data === "string" ? data : null);

      if (responseText) {
        await reply(String(responseText).trim());
      } else {
        await reply("Could not get a response from GPT AI. Please try again later.");
      }
    } catch (err) {
      console.error("[GPT Error]:", err.message);
      await reply(`Failed to query GPT AI: ${err.message || err}`);
    }
  }
};
