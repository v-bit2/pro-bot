export const command = {
  name: "gemini",
  aliases: ["askgemini", "bard"],
  category: "UTILITY",
  description: "Chat with Gemini AI (.gemini <prompt>)",
  usage: ".gemini <prompt>",
  async execute({ args, reply }) {
    if (args.length === 0) {
      await reply("Please provide a prompt for Gemini AI.\n\nExample: .gemini What are the top 5 programming languages?");
      return;
    }

    const prompt = args.join(" ").trim();

    try {
      const res = await fetch(`https://prexzyapis.com/ai/gemini?prompt=${encodeURIComponent(prompt)}`);
      const data = await res.json();
      const responseText = data?.result || data?.response || data?.message || data?.data || (typeof data === "string" ? data : null);

      if (responseText) {
        await reply(String(responseText).trim());
      } else {
        await reply("Could not get a response from Gemini AI. Please try again later.");
      }
    } catch (err) {
      console.error("[Gemini Error]:", err.message);
      await reply(`Failed to query Gemini AI: ${err.message || err}`);
    }
  }
};
