import { jidNormalizedUser } from "@whiskeysockets/baileys";
import config from "../config.js";

export function cleanJid(jid) {
  if (!jid) return "";
  return jidNormalizedUser(jid);
}

export function isGroup(jid) {
  return typeof jid === "string" && jid.endsWith("@g.us");
}

export function isOwner(senderJid, customOwnerNumber = null) {
  if (!senderJid) return false;
  const cleaned = cleanJid(senderJid);
  const ownerNum = customOwnerNumber || config.owner;
  return cleaned.includes(ownerNum);
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
    const botJid = cleanJid(sock.user?.id);
    const userJid = cleanJid(senderJid);

    const senderParticipant = participants.find(p => cleanJid(p.id) === userJid);
    if (senderParticipant?.admin === "admin" || senderParticipant?.admin === "superadmin") {
      isGroupAdmin = true;
    }

    const botParticipant = participants.find(p => cleanJid(p.id) === botJid);
    if (botParticipant?.admin === "admin" || botParticipant?.admin === "superadmin") {
      isBotAdmin = true;
    }
  } catch (err) {
    // Group metadata fetch error or not admin
  }

  return { isGroupAdmin, isBotAdmin, groupMeta };
}
