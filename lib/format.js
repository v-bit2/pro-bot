export function formatResponse(title, content) {
  const cleanTitle = (title || "VOLTRA MINI").toUpperCase();
  return `☆ ${cleanTitle} ☆\n\n${content}\n\n━━━━━━━━━━━━━━━━━━\n> *VOLTRA MD* 😊`;
}

export function formatBox(title, content) {
  return formatResponse(title, content);
}

export function splitBox(title, content) {
  const text = typeof content === "string" ? content : (typeof title === "string" ? title : String(title || ""));
  return [text];
}

export function formatFullMenu(options = {}) {
  const { commandsByCategory = {}, totalCommands = 0, prefix = "." } = options;
  const categoryEmojis = {
    GENERAL: "⚡",
    ADMIN: "🛠️",
    OWNER: "👑",
    MEDIA: "🎨",
    GROUP: "👥",
    DOWNLOADER: "📥",
    TEXTMAKER: "✨",
    CHANNEL: "📢",
    FUN: "🎮",
    SYSTEM: "🖥️"
  };

  let body = `✦ *Prefix:* ${prefix}\n✦ *Total Commands:* ${totalCommands}\n\n`;

  for (const [cat, cmds] of Object.entries(commandsByCategory)) {
    const emoji = categoryEmojis[cat.toUpperCase()] || "✦";
    body += `${emoji} *${cat.toUpperCase()}*\n`;
    body += cmds.map(c => `  • ${prefix}${c.name}`).join("\n");
    body += "\n\n";
  }

  return formatResponse("VOLTRA MENU", body.trim());
}

export function formatSuccess(message, title = "VOLTRA SUCCESS") {
  return formatResponse(
    title,
    `✦ *Status:* Success ✅\n\n${message}`
  );
}

export function formatError(message, title = "VOLTRA ERROR") {
  return formatResponse(
    title,
    `✦ *Status:* Failed ❌\n\n${message || "Something went wrong. Please try again."}`
  );
}

export function formatInfo(message, title = "VOLTRA INFO") {
  return formatResponse(
    title,
    `✦ *Status:* Information\n\n${message}`
  );
}

export function formatGroupOnly(commandName = "Command") {
  return formatError(
    `The *${commandName}* command can only be used inside a WhatsApp group.`,
    "GROUP ONLY"
  );
}

export function formatOwnerOnly(commandName = "Command") {
  return formatError(
    `The *${commandName}* command is restricted to the bot owner.`,
    "OWNER RESTRICTED"
  );
}

export function formatAdminOnly(commandName = "Command") {
  return formatError(
    `You must be a group administrator to use *${commandName}*.`,
    "ADMIN RESTRICTED"
  );
}

export function formatBotAdminRequired(commandName = "Command") {
  return formatError(
    `Voltra Mini requires admin permissions in this group to run *${commandName}*.`,
    "BOT ADMIN REQUIRED"
  );
}
