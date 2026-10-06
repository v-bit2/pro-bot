import { formatBox } from "../lib/format.js";

function getTargetJid(message) {
  const quoted = message.message?.extendedTextMessage?.contextInfo?.participant;
  if (quoted) return quoted;
  const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
  if (mentioned?.length) return mentioned[0];
  return message.key?.participant || message.key.remoteJid;
}

export const command = {
  name: "gayrate",
  category: "FUN",
  description: "Calculate gay meter percentage for mentioned or quoted user",
  usage: ".gayrate [@user]",
  async execute({ message, reply }) {
    const target = getTargetJid(message);
    const rate = Math.floor(Math.random() * 101);
    const user = target.split("@")[0];

    await reply(formatBox("GAY RATE METER 🏳️‍🌈", `@${user} is *${rate}%* gay!`), { mentions: [target] });
  }
};
