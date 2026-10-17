import { formatSuccess, formatError } from "../lib/format.js";
import { parseChannelInviteCode } from "./jid.js";

/**
 * Parse WhatsApp Channel poll URL:
 * e.g. https://whatsapp.com/channel/CHANNEL_INVITE_CODE/POLL_ID
 */
function parsePollUrl(urlStr) {
  if (!urlStr || typeof urlStr !== "string") return null;

  const match = urlStr.trim().match(/whatsapp\.com\/channel\/([a-zA-Z0-9_-]+)(?:\/([0-9]+))?/i);
  if (!match) return null;

  const channelCodeOrJid = match[1];
  const pollId = match[2];

  return {
    inviteCode: parseChannelInviteCode(channelCodeOrJid) || channelCodeOrJid,
    pollId: pollId || null
  };
}

export const command = {
  name: "pollvt",
  aliases: ["channelpollvote", "pollvote", "vote"],
  category: "CHANNEL",
  description: "Vote in a WhatsApp Channel poll across active sessions",
  usage: ".pollvt <channel_poll_url> <option_text_or_number>",
  async execute({ sock, message, args, reply, sessionManager }) {
    if (args.length < 1) {
      await reply(formatError("Usage: .pollvt <channel_poll_url> <option_text_or_number>\nExample: .pollvt https://whatsapp.com/channel/0029Vb8VyAoADTOGFnpU2d2a/130 Option 1"));
      return;
    }

    const urlInput = args[0].trim();
    const optionInput = args.slice(1).join(" ").trim();

    const parsed = parsePollUrl(urlInput);
    if (!parsed || !parsed.pollId) {
      await reply(formatError("Invalid channel poll URL. Please provide a full WhatsApp Channel poll link containing message ID."));
      return;
    }

    if (!optionInput) {
      await reply(formatError("Please specify the poll option name or option number to vote for."));
      return;
    }

    // Collect all active connected sockets
    let activeSockets = [];
    if (sessionManager && typeof sessionManager.getConnectedSessions === "function") {
      const sessions = sessionManager.getConnectedSessions();
      activeSockets = sessions.map(s => ({ id: s.id, sock: s.sock })).filter(s => s.sock);
    }

    if (activeSockets.length === 0) {
      activeSockets = [{ id: "current", sock }];
    }

    // Resolve channel invite code to actual numeric newsletter JID (e.g., 120363410898511633@newsletter)
    let numericNewsletterJid = null;
    const primarySock = activeSockets[0].sock;

    if (parsed.inviteCode.endsWith("@newsletter") && /^\d+@newsletter$/.test(parsed.inviteCode)) {
      numericNewsletterJid = parsed.inviteCode;
    } else if (typeof primarySock.newsletterMetadata === "function") {
      try {
        const meta = await primarySock.newsletterMetadata("invite", parsed.inviteCode);
        if (meta?.id) {
          numericNewsletterJid = meta.id.endsWith("@newsletter") ? meta.id : `${meta.id}@newsletter`;
        }
      } catch (err) {
        console.error("[PollVote] Failed to resolve channel metadata:", err.message);
      }
    }

    if (!numericNewsletterJid) {
      await reply(formatError(`Could not resolve channel metadata or numeric JID for invite code '${parsed.inviteCode}'.`));
      return;
    }

    let successCount = 0;

    for (const session of activeSockets) {
      try {
        let voteSuccess = false;

        if (typeof session.sock.newsletterPollVote === "function") {
          await session.sock.newsletterPollVote(numericNewsletterJid, parsed.pollId, optionInput);
          voteSuccess = true;
        } else {
          // Standard Baileys pollUpdate payload for numeric newsletter JID
          await session.sock.sendMessage(numericNewsletterJid, {
            pollUpdate: {
              pollCreationMessageKey: {
                remoteJid: numericNewsletterJid,
                fromMe: false,
                id: parsed.pollId
              },
              vote: {
                selectedOptions: [optionInput]
              }
            }
          });
          voteSuccess = true;
        }

        if (voteSuccess) {
          successCount++;
        }
      } catch (err) {
        console.error(`[ChannelPollVote] Session ${session.id} error on poll ${parsed.pollId}:`, err.message);
      }
    }

    if (successCount > 0) {
      await reply(formatSuccess(`${successCount} Poll Vote(s) Successfully Sent ✅️`));
    } else {
      await reply(formatError(
        `Channel Poll Vote Analysis:\n\n` +
        `✦ *Channel JID:* ${numericNewsletterJid}\n` +
        `✦ *Poll Msg ID:* ${parsed.pollId}\n` +
        `✦ *Option:* ${optionInput}\n\n` +
        `⚠️ *Protocol Status:* Installed Baileys v6.7.18 lacks native WebSocket Channel Poll voting frame handlers (sub-protocol 1203/channelPoll). WhatsApp Channel polls use server-side encrypted poll tokens that require channel socket subscriber privileges or a dedicated Channel Poll API extension.`
      ));
    }
  }
};
