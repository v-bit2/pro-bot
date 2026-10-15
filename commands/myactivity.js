import { getUserActivity } from "../lib/db.js";
import { sendBotResponse } from "../lib/response.js";
import { formatBox } from "../lib/format.js";

export const command = {
  name: "myactivity",
  aliases: ["activity", "stats"],
  category: "GENERAL",
  description: "Display user bot interaction metrics and top used commands",
  usage: ".myactivity",
  async execute({ sock, message, remoteJid, senderJid }) {
    const act = getUserActivity(senderJid);
    const sortedCmds = Object.entries(act.commands || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    let topText = sortedCmds.length > 0
      ? sortedCmds.map(([cmd, cnt]) => `✦ .${cmd} : ${cnt}`).join("\n")
      : "✦ No command history yet.";

    const pushName = message.pushName || "User";
    const phone = senderJid.split("@")[0];

    const content = `✦ User: @${pushName} (@${phone})
✦ Total Usage: ${act.total}

✦ Top 5 Last Used Commands:
${topText}`;

    await sendBotResponse(sock, remoteJid, {
      title: "USER ACTIVITY",
      content,
      image: true,
      quoted: message,
      mentions: [senderJid],
      forwarded: true
    });
  }
};
