import { generateSpeechOgg } from "../lib/tts.js";
import { formatError } from "../lib/format.js";

export const command = {
  name: "say",
  aliases: ["speak"],
  category: "GENERAL",
  description: "Convert text into a playable WhatsApp audio voice note",
  usage: ".say <text>",
  async execute({ sock, message, args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply(formatError("Please specify text to speak.\n\nExample: .say Hello World"));
      return;
    }

    const textToSpeak = args.join(" ");

    try {
      console.log("[TTS] Generating speech voice note...");
      const oggBuffer = await generateSpeechOgg(textToSpeak);

      await sock.sendMessage(
        remoteJid,
        {
          audio: oggBuffer,
          mimetype: "audio/ogg; codecs=opus",
          ptt: true
        },
        { quoted: message }
      );
      console.log("[TTS] Speech voice note sent successfully");
    } catch (err) {
      console.error("[TTS Error]", err);
      await reply(formatError(`Failed to generate speech voice note: ${err.message}`));
    }
  }
};
