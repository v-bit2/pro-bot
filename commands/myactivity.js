import { getUserActivity } from "../lib/db.js";
import { formatBox } from "../lib/format.js";

export const command = {
  name: "myactivity",
  aliases: ["activity", "stats"],
  category: "GENERAL",
  description: "Display user bot interaction metrics and top used commands",
  usage: ".myactivity",
  async execute({ senderJid, reply }) {
    const act = getUserActivity(senderJid);
    const sortedCmds = Object.entries(act.commands || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    let topText = sortedCmds.length > 0
      ? sortedCmds.map(([cmd, cnt]) => `• .${cmd}: ${cnt} time(s)`).join("\n")
      : "No command history yet.";

    const firstDate = new Date(act.firstSeen).toLocaleDateString();
    const lastDate = new Date(act.lastSeen).toLocaleTimeString();

    const content = `User        : @${senderJid.split("@")[0]}
Total Usage : ${act.total} command(s)
First Active: ${firstDate}
Last Active : ${lastDate}

Top Commands Used:
${topText}`;

    await reply(formatBox("USER ACTIVITY", content));
  }
};
