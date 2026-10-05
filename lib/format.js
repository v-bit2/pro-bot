/**
 * Voltra Mini centralized response formatting utilities.
 */

const HEADERS = {
  GENERAL: "⚡ VOLTRA MINI",
  UTILITY: "🛠️ VOLTRA UTILITY",
  SYSTEM: "🖥️ VOLTRA SYSTEM",
  GROUP: "👥 VOLTRA GROUP",
  MEDIA: "🎨 VOLTRA MEDIA",
  OWNER: "👑 VOLTRA OWNER",
  FUN: "🎮 VOLTRA FUN",
  ERROR: "⚠️ VOLTRA ERROR",
  SUCCESS: "✅ VOLTRA MINI",
  INFO: "ℹ️ VOLTRA INFO"
};

/**
 * Format a box response with header and body content.
 */
export function formatResponse(body, category = "GENERAL") {
  const header = HEADERS[category?.toUpperCase()] || HEADERS.GENERAL;
  const lines = String(body).split("\n");

  const formattedBody = lines.map(line => line ? `│ ${line}` : "│").join("\n");

  return `╭─〔 ${header} 〕
│
${formattedBody}
│
╰────────────────`;
}

/**
 * Format an error message cleanly for WhatsApp output.
 */
export function formatError(message, title = "Error") {
  return formatResponse(`${title}: ${message}\n\nPlease try again or check command syntax.`, "ERROR");
}

/**
 * Format a success message cleanly for WhatsApp output.
 */
export function formatSuccess(message) {
  return formatResponse(message, "SUCCESS");
}

/**
 * Format an info message cleanly for WhatsApp output.
 */
export function formatInfo(message) {
  return formatResponse(message, "INFO");
}

/**
 * Format dynamic command menu.
 */
export function formatMenu(categoriesMap, prefix, botName = "Voltra Mini") {
  let body = `Welcome to *${botName}*\nPrefix: \`${prefix}\`\n`;

  for (const [category, cmds] of Object.entries(categoriesMap)) {
    if (!cmds || cmds.length === 0) continue;
    body += `\n*${category.toUpperCase()}*\n`;
    for (const cmd of cmds) {
      const aliasStr = cmd.aliases && cmd.aliases.length > 0 ? ` (${cmd.aliases.map(a => prefix + a).join(", ")})` : "";
      body += `• \`${prefix}${cmd.name}\`${aliasStr} - ${cmd.description || "No description"}\n`;
    }
  }

  body += `\nTip: Use \`${prefix}help <command>\` for detailed usage.`;

  return formatResponse(body.trim(), "GENERAL");
}
