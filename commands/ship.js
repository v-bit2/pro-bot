import { formatBox, formatError } from "../lib/format.js";

export const command = {
  name: "ship",
  category: "FUN",
  description: "Calculate love compatibility between two group members",
  usage: ".ship @user1 @user2",
  groupOnly: true,
  async execute({ message, reply }) {
    const mentions = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentions.length < 2) {
      await reply(formatError("Please mention two group members to ship: .ship @user1 @user2"));
      return;
    }

    const u1 = mentions[0].split("@")[0];
    const u2 = mentions[1].split("@")[0];
    const percentage = Math.floor(Math.random() * 101);

    await reply(formatBox("LOVE SHIP METER 💕", `@${u1} ❤️ @${u2}\n\nCompatibility Score: *${percentage}%*`), { mentions });
  }
};
