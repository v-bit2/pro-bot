import { getSettings } from "./db.js";

const MAX_MSG_LENGTH = 3500;

/**
 * Format content inside a clean Voltra Mini box structure:
 * ┏▣ ◈ TITLE ◈
 * ┃
 * ┃ line 1
 * ┃ line 2
 * ┗▣
 */
export function formatBox(title, content) {
  const rawText = String(content || "").trim();

  // If text is already formatted as a Voltra box, return as is
  if (rawText.startsWith("┏▣") && rawText.endsWith("┗▣")) {
    return rawText;
  }

  const header = String(title || getSettings().botName || "VOLTRA MINI").toUpperCase();
  const lines = rawText.split("\n");

  const formattedLines = lines.map(line => {
    if (line.startsWith("┃") || line.startsWith("┏") || line.startsWith("┗")) return line;
    return line ? `┃ ${line}` : "┃";
  });

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
  return formatBox(header, `❌ ${message}`);
}

export function formatInfo(message, title) {
  const header = title || getSettings().botName || "VOLTRA MINI";
  return formatBox(header, `ℹ️ ${message}`);
}

/**
 * Split long text if it exceeds MAX_MSG_LENGTH while preserving box formatting.
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
 * Build the full menu or single category menu cleanly from categoriesMap.
 * Returns an array of formatted message string chunks if menu exceeds MAX_MSG_LENGTH.
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

    let catContent = `Category: *${targetCat}*\nTotal: ${cmds.length} commands\n`;
    for (const cmd of cmds) {
      catContent += `\n➤ ${prefix}${cmd.name}`;
      if (cmd.description) catContent += `\n  ${cmd.description}`;
    }

    return [formatBox(`${targetCat} COMMANDS`, catContent.trim())];
  }

  // Full Menu rendering
  const headerBox = formatBox(botName, `👋 Hello @${username}\nPrefix : ${prefix}\nCommands : ${totalCommandsCount}`);

  const categoryBoxes = [];
  for (const [catName, cmds] of Object.entries(categoriesMap)) {
    if (!cmds || cmds.length === 0) continue;
    let catContent = "";
    for (const cmd of cmds) {
      catContent += `\n➤ ${prefix}${cmd.name}`;
    }
    categoryBoxes.push(formatBox(catName.toUpperCase(), catContent.trim()));
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
