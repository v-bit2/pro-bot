import { jidNormalizedUser } from "@whiskeysockets/baileys";
import config from "../config.js";

export function cleanJid(jid) {
  if (!jid) return "";
  return jidNormalizedUser(jid);
}

export function extractPhoneNumber(jid) {
  if (!jid) return "";
  const cleaned = cleanJid(jid);
  return cleaned.split("@")[0].split(":")[0];
}

export function isGroup(jid) {
  return typeof jid === "string" && jid.endsWith("@g.us");
}

/**
 * Session Owner check:
 * Returns true if the sender is the authenticated WhatsApp user of THIS session.
 */
export function isSessionOwner(sock, message, customOwner = null) {
  if (!sock || !message) return false;

  const key = message.key || {};

  // If fromMe is true, it is sent by the authenticated account for this session socket
  if (key.fromMe) {
    return true;
  }

  // Get authenticated session user JID and phone number
  const sessionUserJid = cleanJid(sock.user?.id || sock.user?.jid);
  const sessionPhone = extractPhoneNumber(sessionUserJid);

  // Get sender JID and phone number
  const senderJid = cleanJid(key.participant || key.remoteJid);
  const senderPhone = extractPhoneNumber(senderJid);

  if (sessionPhone && senderPhone && sessionPhone === senderPhone) {
    return true;
  }

  // Fallback check against custom configured owner number
  const devNum = extractPhoneNumber(customOwner || config.owner);
  if (devNum && senderPhone && senderPhone === devNum) {
    return true;
  }

  return false;
}

/**
 * Developer-only check:
 * Returns true ONLY if the sender matches the global configured developer number.
 */
export function isDeveloper(senderJid, customDevNumber = null) {
  if (!senderJid) return false;

  const devNum = extractPhoneNumber(customDevNumber || config.owner);
  const senderPhone = extractPhoneNumber(senderJid);

  return Boolean(devNum && senderPhone && devNum === senderPhone);
}

export function isOwner(senderJid, customOwnerNumber = null) {
  return isDeveloper(senderJid, customOwnerNumber);
}

export async function getGroupPermissions(sock, groupJid, senderJid) {
  let isGroupAdmin = false;
  let isBotAdmin = false;
  let groupMeta = null;

  if (!isGroup(groupJid)) {
    return { isGroupAdmin: false, isBotAdmin: false, groupMeta: null };
  }

  try {
    groupMeta = await sock.groupMetadata(groupJid);
    const participants = groupMeta.participants || [];

    // Collect bot JIDs / phone numbers (including LID, user.id, user.jid)
    const botJidRaw = sock.user?.id || sock.user?.jid || "";
    const botLidRaw = sock.user?.lid || "";
    const botClean = cleanJid(botJidRaw);
    const botLidClean = cleanJid(botLidRaw);
    const botPhone = extractPhoneNumber(botJidRaw);

    // Collect sender JIDs / phone number
    const senderClean = cleanJid(senderJid);
    const senderPhone = extractPhoneNumber(senderJid);

    const isMatch = (p, targetCleanJid, targetLidClean, targetPhone) => {
      if (!p) return false;
      const pClean = cleanJid(p.id || p.jid);
      const pPhone = extractPhoneNumber(p.id || p.jid);

      if (targetCleanJid && pClean && pClean === targetCleanJid) return true;
      if (targetLidClean && pClean && pClean === targetLidClean) return true;
      if (targetPhone && pPhone && targetPhone === pPhone) return true;
      return false;
    };

    const senderParticipant = participants.find(p => isMatch(p, senderClean, null, senderPhone));
    if (senderParticipant?.admin === "admin" || senderParticipant?.admin === "superadmin") {
      isGroupAdmin = true;
    }

    const botParticipant = participants.find(p => isMatch(p, botClean, botLidClean, botPhone));
    if (botParticipant?.admin === "admin" || botParticipant?.admin === "superadmin") {
      isBotAdmin = true;
    }
  } catch (err) {
    // Group metadata fetch error
  }

  return { isGroupAdmin, isBotAdmin, groupMeta };
}
