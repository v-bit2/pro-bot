import { getSettings } from "./db.js";

const MAX_MSG_LENGTH = 3500;

/**
 * Format content inside the Voltra Mini box structure:
 * ┏▣ ◈ *HEADER* ◈
 * ┃
 * ┃ line 1
 * ┃ line 2
 * ┗▣
 */
export function formatBox(title, content) {
  const header = String(title || getSettings().botName || "VOLTRA MINI").toUpperCase();
  const rawText = String(content || "").trim();
  const lines = rawText.split("\n");

  const formattedLines = lines.map(line => line ? `┃ ${line}` : "┃");

  return `┏▣ ◈ *${header}* ◈
┃
${formattedLines.join("\n")}
┃
┗▣`;
}

export function formatResponse(body, category = "GENERAL") {
  return formatBox(category, body);
}

export function formatSuccess(message, title) {
  const header = title || getSettings().botName || "VOLTRA MINI";
  return formatBox(header, `✅ ${message}`);
}

export function formatError(message, title) {
  const header = title || getSettings().botName || "VOLTRA MINI";
  return formatBox(header, `⚠️ ${message}`);
}

export function formatInfo(message, title) {
  const header = title || getSettings().botName || "VOLTRA MINI";
  return formatBox(header, `ℹ️ ${message}`);
}

/**
 * Split long text if it exceeds MAX_MSG_LENGTH while preserving box formatting.
 */
export function splitBox(title, content, maxLen = MAX_MSG_LENGTH) {
  const full = formatBox(title, content);
  if (full.length <= maxLen) return [full];

  const lines = String(content || "").trim().split("\n");
  const chunks = [];
  let currentLines = [];
  let currentLen = 0;

  for (const line of lines) {
    if (currentLen + line.length > maxLen - 100) {
      chunks.push(formatBox(`${title} (Part ${chunks.length + 1})`, currentLines.join("\n")));
      currentLines = [];
      currentLen = 0;
    }
    currentLines.push(line);
    currentLen += line.length + 5;
  }

  if (currentLines.length > 0) {
    chunks.push(formatBox(`${title} (Part ${chunks.length + 1})`, currentLines.join("\n")));
  }

  return chunks;
}

/**
 * Formats dynamic command menu with optional category filter.
 */
export function formatMenu(categoriesMap, prefix, categoryFilter = null, username = "User") {
  const botName = getSettings().botName || "VOLTRA MINI";

  if (!categoryFilter) {
    let content = `👋 Hello @${username}\nPrefix : ${prefix}\n\nUse *${prefix}menu <category>* for specific category commands.\n\n*CATEGORIES:*`;

    for (const [catName, cmds] of Object.entries(categoriesMap)) {
      if (!cmds || cmds.length === 0) continue;
      content += `\n➤ ${prefix}menu ${catName.toLowerCase()} (${cmds.length} commands)`;
    }

    return formatBox(botName, content);
  }

  const targetCat = categoryFilter.toUpperCase();
  const cmds = categoriesMap[targetCat];

  if (!cmds || cmds.length === 0) {
    return formatError(`Category '${categoryFilter}' not found. Available categories: ${Object.keys(categoriesMap).join(", ").toLowerCase()}`);
  }

  let content = `Category: *${targetCat}*\nTotal: ${cmds.length} commands\n`;
  for (const cmd of cmds) {
    const aliasStr = cmd.aliases?.length ? ` (${cmd.aliases.map(a => prefix + a).join(", ")})` : "";
    content += `\n➤ ${prefix}${cmd.name}${aliasStr}\n  ${cmd.description || ""}`;
  }

  return formatBox(`${targetCat} COMMANDS`, content.trim());
}
