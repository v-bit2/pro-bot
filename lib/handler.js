import { jidNormalizedUser } from "@whiskeysockets/baileys";
import { loadCommands, getCommand, getCommandsByCategory, getAllCommands } from "./command-loader.js";
import { sendBotResponse } from "./response.js";
import { formatResponse, formatError, formatBox } from "./format.js";
import { initDb, getSettings, getGroupSettings, addWarning, recordActivity } from "./db.js";
import { isGroup, isOwner, getGroupPermissions, cleanJid } from "./permissions.js";

const sentMsgIds = new Set();

function getText(message) {
  const m = message.message;
  if (!m) return "";

  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ""
  ).trim();
}

/**
 * Main Baileys message event handler.
 */
export async function handleMessage(sock, message, config) {
  if (!message?.message) return;

  const msgId = message.key?.id;

  // 1. Loop protection: ignore messages sent by bot itself
  if (msgId && sentMsgIds.has(msgId)) {
    return;
  }

  await initDb();
  const settings = getSettings();
  const prefix = settings.prefix || config.prefix || ".";
  const remoteJid = message.key.remoteJid;
  const inGroup = isGroup(remoteJid);
  const botUserJid = cleanJid(sock.user?.id);
  const senderJid = cleanJid(message.key.participant || remoteJid);
  const senderIsOwner = isOwner(senderJid, config.owner) || (botUserJid && senderJid === botUserJid);

  // 2. Mode enforcement ('public' | 'self' | 'private')
  if (settings.mode === "self" && !senderIsOwner) {
    return;
  }
  if (settings.mode === "private" && inGroup && !senderIsOwner) {
    return;
  }

  // 3. Auto-read status / messages if enabled
  if (settings.autoRead) {
    try {
      await sock.readMessages([message.key]);
    } catch {}
  }

  const text = getText(message);

  // 4. Group moderation checks (Anti-link, etc.)
  if (inGroup && !senderIsOwner && text) {
    const groupCfg = getGroupSettings(remoteJid);
    const linkRegex = /(https?:\/\/[^\s]+|chat\.whatsapp\.com\/[^\s]+)/i;

    if (groupCfg.antilink && groupCfg.antilink !== "off" && linkRegex.test(text)) {
      const { isGroupAdmin, isBotAdmin } = await getGroupPermissions(sock, remoteJid, senderJid);
      if (!isGroupAdmin) {
        // Delete message if bot is admin
        if (isBotAdmin) {
          try { await sock.sendMessage(remoteJid, { delete: message.key }); } catch {}
        }

        if (groupCfg.antilink === "warn") {
          const warnCount = addWarning(remoteJid, senderJid);
          await sendBotResponse(sock, remoteJid, {
            content: `⚠️ Links are not allowed in this group.\nWarning issued to @${senderJid.split("@")[0]} (${warnCount}/3)`,
            mentions: [senderJid],
            quoted: message,
            sentMsgIds
          });
          if (warnCount >= 3 && isBotAdmin) {
            try { await sock.groupParticipantsUpdate(remoteJid, [senderJid], "remove"); } catch {}
          }
        } else if (groupCfg.antilink === "kick" && isBotAdmin) {
          try { await sock.groupParticipantsUpdate(remoteJid, [senderJid], "remove"); } catch {}
        }
      }
    }
  }

  // Check prefix
  if (!text.startsWith(prefix)) return;

  const parts = text.slice(prefix.length).trim().split(/\s+/);
  const commandName = (parts.shift() || "").toLowerCase();
  if (!commandName) return;

  await loadCommands();
  const command = getCommand(commandName);
  if (!command) return;

  // 5. Auto-react if enabled
  if (settings.autoReact) {
    try {
      await sock.sendMessage(remoteJid, { react: { text: "⚡", key: message.key } });
    } catch {}
  }

  // Record user activity
  recordActivity(senderJid, command.name);

  // Measure latency
  const msgTimestamp = message.messageTimestamp ? Number(message.messageTimestamp) * 1000 : Date.now();
  const receiveLatency = Math.max(0, Date.now() - msgTimestamp);
  const startTime = performance.now();

  // Helper send methods
  const reply = async (content, options = {}) => {
    return sendBotResponse(sock, remoteJid, {
      content: typeof content === "string" ? content : content?.text || "",
      quoted: message,
      sentMsgIds,
      ...options
    });
  };

  const sendBox = async (title, content, options = {}) => {
    return sendBotResponse(sock, remoteJid, {
      title,
      content,
      quoted: message,
      sentMsgIds,
      ...options
    });
  };

  // Permission & context checks
  if (command.groupOnly && !inGroup) {
    await reply(formatBox("VOLTRA GROUP", "This command can only be used inside a WhatsApp group."));
    return;
  }

  if (command.ownerOnly && !senderIsOwner) {
    await reply(formatError("This command is restricted to the bot owner.", "ACCESS DENIED"));
    return;
  }

  let isGroupAdmin = false;
  let isBotAdmin = false;
  let groupMeta = null;

  if (inGroup) {
    const perms = await getGroupPermissions(sock, remoteJid, senderJid);
    isGroupAdmin = perms.isGroupAdmin;
    isBotAdmin = perms.isBotAdmin;
    groupMeta = perms.groupMeta;

    if (command.adminOnly && !isGroupAdmin && !senderIsOwner) {
      await reply(formatError("This command requires group administrator privileges.", "ADMIN REQUIRED"));
      return;
    }

    if (command.botAdminRequired && !isBotAdmin) {
      await reply(formatError("Voltra Mini needs to be a group admin to execute this action.", "BOT ADMIN REQUIRED"));
      return;
    }
  }

  const ctx = {
    sock,
    message,
    args: parts,
    text,
    prefix,
    command: commandName,
    reply,
    sendBox,
    isGroup: inGroup,
    isOwner: senderIsOwner,
    isGroupAdmin,
    isBotAdmin,
    groupMeta,
    remoteJid,
    senderJid,
    receiveLatency,
    config,
    settings,
    getCommandsByCategory,
    getAllCommands
  };

  try {
    await command.execute(ctx);
    const endTime = performance.now();
    const execTime = Math.round(endTime - startTime);
    console.log(`[Voltra] Executed .${commandName} in ${execTime}ms (Latency: ${receiveLatency}ms)`);
  } catch (error) {
    console.error(`[Voltra] Error executing .${commandName}:`, error);
    await reply(formatError(error.message || "An unexpected error occurred while executing the command."));
  }
}
