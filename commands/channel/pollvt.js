import crypto from "node:crypto";
import { parseChannelInviteCode } from "./jid.js";

const sha256 = (s) => crypto.createHash("sha256").update(s).digest();

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
  description: "Vote in a WhatsApp Channel poll",
  usage: ".pollvt <channel_poll_url> [option_text_or_number]",
  async execute({ sock, message, args, reply, sessionManager }) {
    if (args.length < 1) {
      await reply("Usage: .pollvt <channel_poll_url> [option_text_or_number]\nExample: .pollvt https://whatsapp.com/channel/0029Vb8VyAoADTOGFnpU2d2a/130 1");
      return;
    }

    const urlInput = args[0].trim();
    const optionInput = args.slice(1).join(" ").trim();

    const parsed = parsePollUrl(urlInput);
    if (!parsed || !parsed.pollId) {
      await reply("Invalid channel poll URL. Please provide a full WhatsApp Channel poll link containing message ID.");
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

    const primarySock = activeSockets[0].sock;
    let numericNewsletterJid = null;

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
      await reply(`Could not resolve channel metadata or numeric JID for invite code '${parsed.inviteCode}'.`);
      return;
    }

    // Method 2: No option specified -> Fetch available poll options
    if (!optionInput) {
      try {
        let fetchedMsg = null;
        if (typeof primarySock.getNewsletterMessage === "function") {
          fetchedMsg = await primarySock.getNewsletterMessage(numericNewsletterJid, parsed.pollId);
        }

        const pollCreation = fetchedMsg?.message?.pollCreationMessage ||
          fetchedMsg?.message?.pollCreationMessageV2 ||
          fetchedMsg?.message?.pollCreationMessageV3;

        if (pollCreation && pollCreation.options) {
          const pollTitle = pollCreation.name || "Channel Poll";
          let optsText = `📊 *${pollTitle}*\n\nAvailable Options:\n`;
          pollCreation.options.forEach((opt, idx) => {
            optsText += `${idx + 1}. ${opt.optionName}\n`;
          });
          optsText += `\nTo vote, reply or run:\n.pollvt ${urlInput} <option_number_or_name>`;
          await reply(optsText);
          return;
        }
      } catch (e) {
        // Fall through if message query is not supported
      }

      await reply(
        `📊 *Channel Poll Voting*\n\n` +
        `Channel JID: ${numericNewsletterJid}\n` +
        `Poll Msg ID: ${parsed.pollId}\n\n` +
        `Please specify the option to vote for:\n` +
        `.pollvt ${urlInput} Option 1`
      );
      return;
    }

    // Method 1: Option specified -> Execute vote broadcasting across active sessions
    let selectedOptionName = optionInput;
    if (/^\d+$/.test(optionInput)) {
      try {
        if (typeof primarySock.getNewsletterMessage === "function") {
          const fetchedMsg = await primarySock.getNewsletterMessage(numericNewsletterJid, parsed.pollId);
          const pollCreation = fetchedMsg?.message?.pollCreationMessage ||
            fetchedMsg?.message?.pollCreationMessageV2 ||
            fetchedMsg?.message?.pollCreationMessageV3;

          const optIndex = parseInt(optionInput, 10) - 1;
          if (pollCreation?.options?.[optIndex]) {
            selectedOptionName = pollCreation.options[optIndex].optionName;
          }
        }
      } catch {}
    }

    let successCount = 0;

    for (const session of activeSockets) {
      try {
        let voteSuccess = false;

        if (typeof session.sock.newsletterSendPollVote === "function") {
          await session.sock.newsletterSendPollVote(numericNewsletterJid, parsed.pollId, selectedOptionName);
          voteSuccess = true;
        } else if (typeof session.sock.newsletterPollVote === "function") {
          await session.sock.newsletterPollVote(numericNewsletterJid, parsed.pollId, selectedOptionName, sha256(selectedOptionName));
          voteSuccess = true;
        } else {
          try {
            await session.sock.sendMessage(numericNewsletterJid, {
              pollUpdate: {
                pollCreationMessageKey: {
                  remoteJid: numericNewsletterJid,
                  fromMe: false,
                  id: parsed.pollId
                },
                vote: {
                  selectedOptions: [selectedOptionName]
                }
              }
            });
            voteSuccess = true;
          } catch {}
        }

        if (voteSuccess) {
          successCount++;
        }
      } catch (err) {
        console.error(`[ChannelPollVote] Session ${session.id} error on poll ${parsed.pollId}:`, err.message);
      }
    }

    if (successCount > 0) {
      await reply("successfully sent votes");
    } else {
      await reply(
        `Unable to deliver channel poll vote to ${numericNewsletterJid}.\n\n` +
        `Option: ${selectedOptionName}\nPoll ID: ${parsed.pollId}`
      );
    }
  }
};
