import { generateTextmakerImage } from "../../lib/textmaker.js";

function createTextmakerCommand(name, effectKey, description) {
  return {
    command: {
      name,
      category: "TEXTMAKER",
      description: `Generate ${description} text logo effect (.${name} <text>)`,
      usage: `.${name} <text>`,
      async execute({ sock, message, args, reply, remoteJid }) {
        if (args.length < 1) {
          await reply(`Usage: .${name} <text>\nExample: .${name} Voltra`);
          return;
        }

        const textInput = args.join(" ").trim();
        await reply("⏳ *Generating effect... Please wait.*");

        try {
          const imageBuffer = await generateTextmakerImage(effectKey, textInput);

          await sock.sendMessage(remoteJid, {
            image: imageBuffer,
            caption: "✅ *Generated successfully.*"
          }, { quoted: message });
        } catch (err) {
          console.error(`[Textmaker] Error in .${name}:`, err);
          await reply(`Failed to generate logo effect: ${err.message || err}`);
        }
      }
    }
  };
}

export const { command } = createTextmakerCommand("neon", "neon", "Neon Light");
