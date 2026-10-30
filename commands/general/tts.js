import { generateSpeechOgg } from "../../lib/tts.js";
import { formatError } from "../../lib/format.js";

export const command = {
  name: "tts",
  aliases: ["speech"],
  category: "GENERAL",
  description: "Convert text to audio speech voice note",
  usage: ".tts <text>",
  async execute({ sock, message, args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply(formatError("Please specify text to convert to speech."));
      return;
    }

    const textToSpeak = args.join(" ");

    try {
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
    } catch (err) {
      await reply(formatError(`Failed to convert text to speech: ${err.message}`));
    }
  }
};
