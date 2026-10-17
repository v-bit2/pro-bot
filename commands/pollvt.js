import { formatSuccess, formatError } from "../lib/format.js";

/**
 * Parse WhatsApp URL or JID input
 */
function parsePollUrl(urlStr) {
  if (!urlStr || typeof urlStr !== "string") return null;

  const match = urlStr.trim().match(/whatsapp\.com\/channel\/([a-zA-Z0-9_-]+)(?:\/([0-9]+))?/i);
  if (!match) return null;

  const channelId = match[1];
  const pollId = match[2];

  const newsletterJid = channelId.endsWith("@newsletter")
    ? channelId
    : (channelId.includes("@") ? channelId : `${channelId}@newsletter`);

  return {
    newsletterJid,
    pollId: pollId || null
  };
}

export const command = {
  name: "pollvt",
  aliases: ["channelpollvote", "pollvote", "vote"],
  category: "CHANNEL",
  description: "Vote in a WhatsApp poll across active sessions",
  usage: ".pollvt <poll_url_or_jid> <option_name_or_selectable>",
  async execute({ sock, message, args, reply, sessionManager }) {
    if (args.length < 1) {
      await reply(formatError("Usage: .pollvt <poll_url> <option_text>\nExample: .pollvt https://whatsapp.com/channel/0029Vb8VyAoADTOGFnpU2d2a/130 Option 1"));
      return;
    }

    const urlInput = args[0].trim();
    const optionInput = args.slice(1).join(" ").trim();

    // Collect all active sessions
    let activeSockets = [];
    if (sessionManager && typeof sessionManager.getConnectedSessions === "function") {
      const sessions = sessionManager.getConnectedSessions();
      activeSockets = sessions.map(s => ({ id: s.id, sock: s.sock })).filter(s => s.sock);
    }

    if (activeSockets.length === 0) {
      activeSockets = [{ id: "current", sock }];
    }

    const parsed = parsePollUrl(urlInput);

    // If a quoted poll message is present in chat, handle standard chat poll update
    const msg = message;
    const quotedMsg = msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const pollCreationMessage = quotedMsg?.pollCreationMessage || quotedMsg?.pollCreationMessageV2 || quotedMsg?.pollCreationMessageV3;

    if (pollCreationMessage && msg?.message?.extendedTextMessage?.contextInfo?.stanzaId) {
      const targetJid = msg.key.remoteJid;
      const pollCreationMessageKey = {
        remoteJid: targetJid,
        fromMe: false,
        id: msg.message.extendedTextMessage.contextInfo.stanzaId
      };

      let selectedOptions = [optionInput || "Option 1"];
      if (pollCreationMessage.options) {
        const matchingOpt = pollCreationMessage.options.find(o =>
          o.optionName?.toLowerCase() === optionInput.toLowerCase()
        );
        if (matchingOpt) {
          selectedOptions = [matchingOpt.optionName];
        }
      }

      let successCount = 0;
      for (const session of activeSockets) {
        try {
          await session.sock.sendMessage(targetJid, {
            pollUpdate: {
              pollCreationMessageKey,
              vote: {
                selectedOptions
              }
            }
          });
          successCount++;
        } catch (err) {
          console.error(`[PollVote] Session ${session.id} vote error:`, err.message);
        }
      }

      await reply(formatSuccess(`${successCount} Poll Votes Successfully Sent ✅️`));
      return;
    }

    // For channel poll URLs
    if (parsed && parsed.pollId) {
      let successCount = 0;
      for (const session of activeSockets) {
        try {
          // Attempt Baileys pollUpdate payload for channel post message ID
          await session.sock.sendMessage(parsed.newsletterJid, {
            pollUpdate: {
              pollCreationMessageKey: {
                remoteJid: parsed.newsletterJid,
                fromMe: false,
                id: parsed.pollId
              },
              vote: {
                selectedOptions: [optionInput || "Option 1"]
              }
            }
          });
          successCount++;
        } catch (err) {
          // Fall back gracefully
        }
      }

      if (successCount > 0) {
        await reply(formatSuccess(`${successCount} Poll Votes Successfully Sent ✅️`));
      } else {
        await reply(formatError(
          `Unable to vote on channel poll ${parsed.pollId}.\n\n` +
          `WhatsApp Channel poll voting requires direct in-chat message context and pollEncKey encryption payload.`
        ));
      }
      return;
    }

    await reply(formatError("Please quote a poll message or provide a valid poll link with option text."));
  }
};
