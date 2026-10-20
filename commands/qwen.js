export const command = {
  name: "qwen",
  aliases: ["askqwen"],
  category: "UTILITY",
  description: "Chat with Qwen AI (.qwen <prompt>)",
  usage: ".qwen <prompt>",
  async execute({ args, reply }) {
    if (args.length === 0) {
      await reply("Please provide a prompt for Qwen AI.\n\nExample: .qwen Write a poem about thunderstorms");
      return;
    }

    const prompt = args.join(" ").trim();

    try {
      const res = await fetch(`https://prexzyapis.com/ai/qwen?prompt=${encodeURIComponent(prompt)}`);
      const data = await res.json();
      const responseText = data?.result || data?.response || data?.message || data?.data || (typeof data === "string" ? data : null);

      if (responseText) {
        await reply(String(responseText).trim());
      } else {
        await reply("Could not get a response from Qwen AI. Please try again later.");
      }
    } catch (err) {
      console.error("[Qwen Error]:", err.message);
      await reply(`Failed to query Qwen AI: ${err.message || err}`);
    }
  }
};
