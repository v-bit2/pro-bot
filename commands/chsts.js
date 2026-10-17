import fs from "node:fs";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { parseChannelInviteCode } from "./jid.js";

export const command = {
  name: "chsts",
  aliases: ["channelstatus", "postchannelstatus"],
  category: "CHANNEL",
  description: "Post a status update to a WhatsApp Channel (.chsts <channel_url_or_jid> [caption])",
  usage: ".chsts <channel_url_or_jid> [caption]",
  async execute({ sock, message, args, reply, sessionManager }) {
    if (args.length < 1) {
      await reply("Usage: .chsts <channel_url_or_jid> [caption_text]\nExample: .chsts https://whatsapp.com/channel/0029Vb8VyAoADTOGFnpU2d2a Thank you for 10k followers!");
      return;
    }

    const input = args[0].trim();
    const textCaption = args.slice(1).join(" ").trim();
    const inviteCode = parseChannelInviteCode(input) || input;

    let targetJid = inviteCode;
    if (!targetJid.endsWith("@newsletter")) {
      if (typeof sock.newsletterMetadata === "function") {
        try {
          const meta = await sock.newsletterMetadata("invite", inviteCode);
          if (meta?.id) {
            targetJid = meta.id.endsWith("@newsletter") ? meta.id : `${meta.id}@newsletter`;
          }
        } catch (e) {
          targetJid = `${inviteCode}@newsletter`;
        }
      } else {
        targetJid = `${inviteCode}@newsletter`;
      }
    }

    // Check if quoted message contains media
    const q = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const mediaMsg = q?.imageMessage ? q : (message.message?.imageMessage ? message : null);

    let payload = {};
    if (mediaMsg) {
      try {
        const buffer = await downloadMediaMessage(
          mediaMsg,
          "buffer",
          {},
          { logger: sock.logger, reuploadRequest: sock.updateMediaMessage }
        );
        payload = {
          image: buffer,
          caption: textCaption
        };
      } catch (err) {
        await reply(`Failed to download media for channel status: ${err.message}`);
        return;
      }
    } else {
      if (!textCaption) {
        await reply("Please provide text or attach/reply to an image for the channel status.");
        return;
      }
      payload = { text: textCaption };
    }

    let activeSockets = [];
    if (sessionManager && typeof sessionManager.getConnectedSessions === "function") {
      const sessions = sessionManager.getConnectedSessions();
      activeSockets = sessions.map(s => ({ id: s.id, sock: s.sock })).filter(s => s.sock);
    }

    if (activeSockets.length === 0) {
      activeSockets = [{ id: "current", sock }];
    }

    let successCount = 0;

    for (const session of activeSockets) {
      try {
        if (typeof session.sock.sendNewsletterStatus === "function") {
          await session.sock.sendNewsletterStatus(targetJid, payload);
          successCount++;
        } else {
          // Fallback message send
          await session.sock.sendMessage(targetJid, payload);
          successCount++;
        }
      } catch (err) {
        console.error(`[ChannelStatus] Session ${session.id} error:`, err.message);
      }
    }

    if (successCount > 0) {
      await reply(`Channel Status Successfully Posted to ${targetJid} ✅️`);
    } else {
      await reply(`Failed to post channel status to ${targetJid}.`);
    }
  }
};
