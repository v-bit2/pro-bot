import { getSettings } from "./db.js";

const MAX_MSG_LENGTH = 3500;
const SEPARATOR = "━━━━━━━━━━━━━━━━━━";

/**
 * Format content using the standard Voltra Mini visual style:
 * ☆ TITLE ☆
 * ━━━━━━━━━━━━━━━━━━
 * content
 * ━━━━━━━━━━━━━━━━━━
 */
export function formatBox(title, content) {
  const rawText = String(content || "").trim();
  const header = String(title || getSettings().botName || "VOLTRA MINI").toUpperCase();

  // If text is already wrapped with standard header & separator, return as is
  if (rawText.startsWith("☆") && rawText.includes(SEPARATOR)) {
    return rawText;
  }

  const lines = rawText.split("\n");
  const formattedLines = lines.map(line => {
    const trimmed = line.trim();
    // If line is empty, return empty line
    if (!trimmed) return "";
    // If line already starts with bullet/bullet point/emoji/header/separator, preserve it
    if (
      trimmed.startsWith("✦") ||
      trimmed.startsWith("☆") ||
      trimmed.startsWith("━") ||
      trimmed.startsWith("➤") ||
      trimmed.startsWith("•") ||
      trimmed.startsWith("📌")
    ) {
      return line;
    }
    // Default list item prefix
    return `✦ ${line}`;
  });

  return `☆ ${header} ☆
${SEPARATOR}
${formattedLines.join("\n")}
${SEPARATOR}`;
}

export function formatResponse(body, category = "VOLTRA MINI") {
  return formatBox(category, body);
}

export function formatSuccess(message, title) {
  const header = title || getSettings().botName || "VOLTRA SUCCESS";
  return formatBox(header, `✦ 🎉 *Status:* Success\n✦ 📝 *Details:* ${message}`);
}

export function formatError(message, title) {
  const header = title || "COMMAND ERROR";
  return formatBox(header, `✦ ❌ *Status:* Failed\n✦ 📝 *Details:* ${message}`);
}

export function formatInfo(message, title) {
  const header = title || getSettings().botName || "VOLTRA INFO";
  return formatBox(header, `✦ ℹ️ ${message}`);
}

/**
 * Split long text if it exceeds MAX_MSG_LENGTH while preserving formatting.
 */
export function splitBox(title, content, maxLen = MAX_MSG_LENGTH) {
  const rawText = String(content || "").trim();
  if (rawText.length <= maxLen) {
    return [formatBox(title, rawText)];
  }

  const lines = rawText.split("\n");
  const chunks = [];
  let currentLines = [];
  let currentLen = 0;

  for (const line of lines) {
    if (currentLen + line.length > maxLen - 100) {
      chunks.push(formatBox(`${title} (PART ${chunks.length + 1})`, currentLines.join("\n")));
      currentLines = [];
      currentLen = 0;
    }
    currentLines.push(line);
    currentLen += line.length + 5;
  }

  if (currentLines.length > 0) {
    chunks.push(formatBox(`${title} (PART ${chunks.length + 1})`, currentLines.join("\n")));
  }

  return chunks;
}

/**
 * Build full menu or single category menu using standard ☆ TITLE ☆ / ━━━━━━━━━━━━━━━━━━ / ✦ design.
 */
export function formatFullMenu(categoriesMap, prefix, categoryFilter = null, username = "User", totalCommandsCount = 0) {
  const botName = getSettings().botName || "VOLTRA MINI";

  // If filtering for a specific category
  if (categoryFilter) {
    const targetCat = categoryFilter.toUpperCase();
    const cmds = categoriesMap[targetCat];

    if (!cmds || cmds.length === 0) {
      return [formatError(`Category '${categoryFilter}' not found. Available: ${Object.keys(categoriesMap).join(", ").toLowerCase()}`)];
    }

    let catContent = `✦ 📂 Category: *${targetCat}*\n✦ 📋 Total: ${cmds.length} commands\n`;
    for (const cmd of cmds) {
      catContent += `\n✦ ${prefix}${cmd.name}`;
      if (cmd.description) catContent += ` — ${cmd.description}`;
    }

    return [formatBox(`${targetCat} COMMANDS`, catContent.trim())];
  }

  // Full Menu rendering
  const headerBox = `☆ ${botName.toUpperCase()} ☆
${SEPARATOR}
✦ 👋 Hello *@${username}*
✦ ⚡ Prefix: *${prefix}*
✦ 📋 Commands: *${totalCommandsCount}*
${SEPARATOR}`;

  const categoryBoxes = [];
  for (const [catName, cmds] of Object.entries(categoriesMap)) {
    if (!cmds || cmds.length === 0) continue;
    let catContent = "";
    for (const cmd of cmds) {
      catContent += `\n✦ ${prefix}${cmd.name}`;
    }
    categoryBoxes.push(`☆ 🎨 ${catName.toUpperCase()} ☆
${SEPARATOR}${catContent}
${SEPARATOR}`);
  }

  const messageChunks = [];
  let currentChunk = [headerBox];
  let currentLength = headerBox.length;

  for (const box of categoryBoxes) {
    if (currentLength + box.length + 20 > MAX_MSG_LENGTH) {
      messageChunks.push(currentChunk.join("\n\n"));
      currentChunk = [box];
      currentLength = box.length;
    } else {
      currentChunk.push(box);
      currentLength += box.length + 2;
    }
  }

  if (currentChunk.length > 0) {
    messageChunks.push(currentChunk.join("\n\n"));
  }

  return messageChunks;
}
