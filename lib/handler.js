import { jidNormalizedUser } from "@whiskeysockets/baileys";
import { loadCommands, getCommand, getCommandsByCategory, getAllCommands } from "./command-loader.js";
import { sendBotResponse } from "./response.js";
import { formatResponse, formatError, formatBox } from "./format.js";
import { initDb, getSettings, getGroupSettings, addWarning, recordActivity } from "./db.js";
import { isGroup, isSessionOwner, isDeveloper, getGroupPermissions, cleanJid } from "./permissions.js";

const sentMsgIds = new Set();

export function unwrapMessage(msg) {
  let m = msg?.message;
  if (!m) return null;

  if (m.ephemeralMessage) m = m.ephemeralMessage.message;
  if (m.viewOnceMessage) m = m.viewOnceMessage.message;
  if (m.viewOnceMessageV2) m = m.viewOnceMessageV2.message;
  if (m.viewOnceMessageV2Extension) m = m.viewOnceMessageV2Extension.message;
  if (m.documentWithCaptionMessage) m = m.documentWithCaptionMessage.message;

  return m;
}

function getText(message) {
  const m = unwrapMessage(message);
  if (!m) return "";

  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    m.audioMessage?.caption ||
    ""
  ).trim();
}

const LINK_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+|chat\.whatsapp\.com\/[^\s]+|wa\.me\/[^\s]+|t\.me\/[^\s]+|\b[a-zA-Z0-9.-]+\.(com|org|net|io|co|app|me|info|site|xyz|online|dev|link|tech|store)\b[^\s]*)/i;

/**
 * Main Baileys message event handler.
 */
export async function handleMessage(sock, message, config, sessionManager = null) {
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
  const senderJid = cleanJid(message.key.participant || remoteJid);

  // Separate session owner check vs global developer check
  const senderIsSessionOwner = isSessionOwner(sock, message, config.owner);
  const senderIsDeveloper = isDeveloper(senderJid, config.owner);

  // 2. Mode enforcement ('public' | 'self' | 'private')
  // In 'self' or 'private' mode, no one except session owner or developer can command the bot anywhere
  if ((settings.mode === "self" || settings.mode === "private") && !senderIsSessionOwner && !senderIsDeveloper) {
    return;
  }

  // 3. Auto-read status / messages if enabled
  if (settings.autoRead) {
    try {
      await sock.readMessages([message.key]);
    } catch {}
  }

  const text = getText(message);

  // 4. Group moderation checks (Anti-link, Anti-file, Anti-sticker, Anti-video, Anti-audio)
  if (inGroup && !senderIsSessionOwner && !senderIsDeveloper) {
    const groupCfg = getGroupSettings(remoteJid);
    const hasAntiRule =
      (groupCfg.antilink && groupCfg.antilink !== "off") ||
      Boolean(groupCfg.antifile) ||
      Boolean(groupCfg.antisticker) ||
      Boolean(groupCfg.antivideo) ||
      Boolean(groupCfg.antiaudio);

    if (hasAntiRule) {
      const { isGroupAdmin, isBotAdmin } = await getGroupPermissions(sock, remoteJid, senderJid);

      if (!isGroupAdmin) {
        const unwrapped = unwrapMessage(message) || {};
        let triggeredRule = null;
        let ruleTypeLabel = "";

        if (groupCfg.antilink && groupCfg.antilink !== "off" && LINK_REGEX.test(text)) {
          triggeredRule = "antilink";
          ruleTypeLabel = "Link";
        } else if (groupCfg.antifile && (unwrapped.documentMessage || unwrapped.documentWithCaptionMessage)) {
          triggeredRule = "antifile";
          ruleTypeLabel = "Document/File";
        } else if (groupCfg.antisticker && unwrapped.stickerMessage) {
          triggeredRule = "antisticker";
          ruleTypeLabel = "Sticker";
        } else if (groupCfg.antivideo && (unwrapped.videoMessage || unwrapped.ptvMessage)) {
          triggeredRule = "antivideo";
          ruleTypeLabel = "Video";
        } else if (groupCfg.antiaudio && unwrapped.audioMessage) {
          triggeredRule = "antiaudio";
          ruleTypeLabel = "Audio/Voice Note";
        }

        if (triggeredRule) {
          if (!isBotAdmin) {
            await sendBotResponse(sock, remoteJid, {
              content: formatError(
                `⚠️ Anti-${ruleTypeLabel} protection triggered by @${senderJid.split("@")[0]}, but Voltra Mini cannot delete it because the bot is not a group admin!`,
                "BOT ADMIN REQUIRED"
              ),
              mentions: [senderJid],
              sentMsgIds
            });
            return;
          }

          // Delete offending message
          try {
            await sock.sendMessage(remoteJid, { delete: message.key });
          } catch (err) {
            console.error("[Voltra] Error deleting message for anti-rule:", err.message);
          }

          if (triggeredRule === "antilink") {
            if (groupCfg.antilink === "warn") {
              const warnCount = addWarning(remoteJid, senderJid);
              await sendBotResponse(sock, remoteJid, {
                content: formatError(
                  `⚠️ Links are not allowed in this group.\nWarning issued to @${senderJid.split("@")[0]} (${warnCount}/3)`,
                  "ANTI-LINK WARN"
                ),
                mentions: [senderJid],
                sentMsgIds
              });
              if (warnCount >= 3) {
                try {
                  await sock.groupParticipantsUpdate(remoteJid, [senderJid], "remove");
                } catch {}
              }
            } else if (groupCfg.antilink === "kick") {
              try {
                await sock.groupParticipantsUpdate(remoteJid, [senderJid], "remove");
              } catch {}
              await sendBotResponse(sock, remoteJid, {
                content: formatError(
                  `🚫 Removed @${senderJid.split("@")[0]} for posting a link (Anti-Link Kick Mode).`,
                  "ANTI-LINK KICK"
                ),
                mentions: [senderJid],
                sentMsgIds
              });
            } else {
              await sendBotResponse(sock, remoteJid, {
                content: formatError(
                  `⚠️ Deleted message from @${senderJid.split("@")[0]} because links are not allowed in this group.`,
                  "ANTI-LINK PROTECTION"
                ),
                mentions: [senderJid],
                sentMsgIds
              });
            }
          } else {
            await sendBotResponse(sock, remoteJid, {
              content: formatError(
                `⚠️ Deleted ${ruleTypeLabel} from @${senderJid.split("@")[0]} (Anti-${ruleTypeLabel} is enabled in this group).`,
                "GROUP PROTECTION"
              ),
              mentions: [senderJid],
              sentMsgIds
            });
          }

          // Stop processing further commands for this violating message
          return;
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

  // 5. Contextual Command Reaction
  const COMMAND_EMOJIS = {
    menu: "📝", help: "📝", commands: "📝",
    ping: "🏓", alive: "⚡", runtime: "⏳", uptime: "⏳",
    owner: "👑", about: "ℹ️", system: "🖥️",
    sticker: "🖼️", s: "🖼️",
    jid: "📢", cjid: "📢", channeljid: "📢",
    chreact: "🔥", chreat: "🔥", pollvt: "📊",
    kick: "🚫", remove: "🚫", promote: "⬆️", demote: "⬇️",
    tagall: "📢", hidetag: "📢", admins: "👥", groupinfo: "ℹ️",
    say: "🗣️", tts: "🗣️", viewonce: "👁️", vv: "👁️",
    ttt: "🎮", tictactoe: "🎮",
    tk: "📥", tiktok: "📥", ig: "📥", instagram: "📥",
    fb: "📥", facebook: "📥", x: "📥", twitter: "📥",
    yt: "📥", youtube: "📥", mp3: "🎵", song: "🎵"
  };

  const CATEGORY_EMOJIS = {
    GENERAL: "⚡", UTILITY: "🛠️", MEDIA: "🎨", GROUP: "👥",
    OWNER: "👑", SYSTEM: "🖥️", FUN: "🎮", CHANNEL: "📢",
    TEXTMAKER: "✏️", ADMIN: "🛡️", DOWNLOADER: "📥"
  };

  const reactEmoji =
    COMMAND_EMOJIS[command.name] ||
    COMMAND_EMOJIS[commandName] ||
    CATEGORY_EMOJIS[command.category?.toUpperCase()] ||
    "⚡";

  try {
    await sock.sendMessage(remoteJid, { react: { text: reactEmoji, key: message.key } });
  } catch (err) {
    // Ignore reaction error if restricted
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
      ...(typeof content === "object" ? content : {}),
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

  // Developer-only check (.setmenuimage, .setprefix, .setbotname, .restart)
  if (command.devOnly && !senderIsDeveloper) {
    await reply(formatError("This command is restricted to the bot developer.", "DEVELOPER REQUIRED"));
    return;
  }

  // Session-owner check (.anticall, .antidelete, .autoreact, .autoread, .autotyping, .block, .broadcast, .mode, .unblock)
  if (command.ownerOnly && !senderIsSessionOwner && !senderIsDeveloper) {
    await reply(formatError("This command is restricted to the session owner.", "SESSION OWNER REQUIRED"));
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

    if (command.adminOnly && !isGroupAdmin && !senderIsSessionOwner && !senderIsDeveloper) {
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
    isOwner: senderIsSessionOwner || senderIsDeveloper,
    isSessionOwner: senderIsSessionOwner,
    isDeveloper: senderIsDeveloper,
    isGroupAdmin,
    isBotAdmin,
    groupMeta,
    remoteJid,
    senderJid,
    receiveLatency,
    config,
    settings,
    sessionManager,
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
