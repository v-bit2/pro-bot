export function toMathBoldSans(str) {
  if (!str) return "";
  let out = "";
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // A-Z (0x41 - 0x5A) -> Math Bold Sans (0x1D5A0 - 0x1D5B9)
    if (code >= 65 && code <= 90) {
      out += String.fromCodePoint(0x1D5A0 + (code - 65));
    }
    // a-z (0x61 - 0x7A) -> Math Bold Sans (0x1D5BA - 0x1D5D3)
    else if (code >= 97 && code <= 122) {
      out += String.fromCodePoint(0x1D5BA + (code - 97));
    }
    // 0-9 (0x30 - 0x39) -> Math Bold Sans (0x1D7EC - 0x1D7F5)
    else if (code >= 48 && code <= 57) {
      out += String.fromCodePoint(0x1D7EC + (code - 48));
    } else {
      out += str[i];
    }
  }
  return out;
}

export function formatResponse(title, content) {
  const boldTitle = toMathBoldSans(title || "VOLTRA MD");
  return `◈ ${boldTitle}\n${content}\n⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n> ᴠᴏʟᴛʀᴀ ᴍᴅ`;
}

export function formatBox(title, content) {
  return formatResponse(title, content);
}

export function splitBox(title, content) {
  const text = typeof content === "string" ? content : (typeof title === "string" ? title : String(title || ""));
  return [text];
}

export function formatFullMenu(options = {}) {
  const { commandsByCategory = {}, prefix = "." } = options;

  let body = "";
  const categories = Object.entries(commandsByCategory);

  categories.forEach(([cat, cmds], index) => {
    const boldCat = toMathBoldSans(cat.toUpperCase());
    body += `◈ ${boldCat}\n`;

    cmds.forEach((cmd, cIdx) => {
      const isLast = cIdx === cmds.length - 1;
      const branch = isLast ? "└─" : "├─";
      body += `${branch} ${prefix}${cmd.name}\n`;
    });

    if (index < categories.length - 1) {
      body += "\n";
    }
  });

  return `${body.trim()}\n⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n> ᴠᴏʟᴛʀᴀ ᴍᴅ`;
}

export function formatSuccess(message) {
  return message;
}

export function formatError(message) {
  return message;
}

export function formatInfo(message) {
  return message;
}

export function formatGroupOnly(commandName = "Command") {
  return `The *${commandName}* command can only be used inside a WhatsApp group.`;
}

export function formatOwnerOnly(commandName = "Command") {
  return `The *${commandName}* command is restricted to the bot owner.`;
}

export function formatAdminOnly(commandName = "Command") {
  return `You must be a group administrator to use *${commandName}*.`;
}

export function formatBotAdminRequired(commandName = "Command") {
  return `Voltra Mini requires admin permissions in this group to run *${commandName}*.`;
}
