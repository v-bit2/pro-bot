import { formatError } from "../lib/format.js";

export const command = {
  name: "tts",
  aliases: ["say", "speech"],
  category: "GENERAL",
  description: "Convert text to audio speech voice note",
  usage: ".tts <text>",
  async execute({ sock, message, args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply(formatError("Please specify text to convert to speech."));
      return;
    }

    const textStr = args.join(" ");
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&q=${encodeURIComponent(textStr)}&tl=en`;

    try {
      await sock.sendMessage(remoteJid, {
        audio: { url: ttsUrl },
        mimetype: "audio/mp4",
        ptt: true
      }, { quoted: message });
    } catch (err) {
      await reply(formatError(`Failed to convert text to speech: ${err.message}`));
    }
  }
};
