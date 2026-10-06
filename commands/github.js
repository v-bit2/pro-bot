import { formatBox, formatError } from "../lib/format.js";

export const command = {
  name: "github",
  aliases: ["gh", "gituser"],
  category: "GENERAL",
  description: "Search GitHub user profile and repository statistics",
  usage: ".github <username>",
  async execute({ sock, message, args, reply, remoteJid }) {
    if (args.length === 0) {
      await reply(formatError("Please specify a GitHub username, e.g. .github octocat"));
      return;
    }

    const username = args[0].trim();

    try {
      const response = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
        headers: { "User-Agent": "Voltra-Mini-Bot" }
      });

      if (!response.ok) {
        await reply(formatError(`GitHub user '${username}' not found.`));
        return;
      }

      const data = await response.json();
      const content = `Username    : ${data.login}
Name        : ${data.name || "N/A"}
Bio         : ${data.bio || "No bio"}
Public Repos: ${data.public_repos}
Followers   : ${data.followers}
Following   : ${data.following}
Company     : ${data.company || "N/A"}
Location    : ${data.location || "N/A"}
URL         : ${data.html_url}`;

      if (data.avatar_url) {
        await sock.sendMessage(remoteJid, {
          image: { url: data.avatar_url },
          caption: formatBox("GITHUB PROFILE", content)
        }, { quoted: message });
      } else {
        await reply(formatBox("GITHUB PROFILE", content));
      }
    } catch (err) {
      await reply(formatError(`Failed to fetch GitHub data: ${err.message}`));
    }
  }
};
