export const command = {
  name: "genimage",
  aliases: ["img", "image", "aiimg", "draw"],
  category: "UTILITY",
  description: "Generate AI artwork from prompt (.genimage <prompt>)",
  usage: ".genimage <prompt>",
  async execute({ sock, message, args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply("Please provide an image prompt.\n\nExample: .genimage Futuristic cybernetic city at sunset in cyberpunk style");
      return;
    }

    const prompt = args.join(" ").trim();
    await reply("⏳ *Generating AI image... Please wait.*");

    try {
      const res = await fetch(`https://prexzyapis.com/ai/aiappgen?prompt=${encodeURIComponent(prompt)}`);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const contentType = res.headers.get("content-type") || "";

      let imageUrl = null;
      if (contentType.includes("json")) {
        const data = await res.json();
        imageUrl = data?.result || data?.url || data?.image || data?.data;
      } else {
        // Direct image binary response from prexzyapis
        const imageBuffer = Buffer.from(await res.arrayBuffer());
        await sock.sendMessage(
          remoteJid,
          {
            image: imageBuffer,
            caption: "✅ *Generated successfully.*"
          },
          { quoted: message }
        );
        return;
      }

      if (imageUrl) {
        await sock.sendMessage(
          remoteJid,
          {
            image: { url: imageUrl },
            caption: "✅ *Generated successfully.*"
          },
          { quoted: message }
        );
      } else {
        await reply("Failed to generate AI image. Please try again with a different prompt.");
      }
    } catch (err) {
      console.error("[GenImage Error]:", err.message);
      await reply(`Failed to generate AI image: ${err.message || err}`);
    }
  }
};
