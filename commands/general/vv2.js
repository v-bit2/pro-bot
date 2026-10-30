import { downloadContentFromMessage } from '@whiskeysockets/baileys';

function getSenderDmJid(msg, extra) {
  let jid = extra?.senderJid || extra?.sender || msg.key.participant || msg.key.remoteJid || '';
  if (msg.key.fromMe && sockUserJid(extra)) {
    jid = sockUserJid(extra);
  }
  if (!jid || jid.endsWith('@g.us')) {
    jid = msg.key.participant || msg.key.remoteJid || '';
  }
  if (jid.endsWith('@g.us') || jid.endsWith('@broadcast')) {
    return null;
  }
  return String(jid).replace(/:\d+@/, '@');
}

function sockUserJid(extra) {
  return extra?.sock?.user?.id ? extra.sock.user.id.replace(/:\d+@/, '@') : null;
}

export const command = {
  name: 'vv2',
  category: 'general',
  description: 'Reveal a view-once message into your DM',
  usage: '.vv2 (reply to view-once message)',

  async execute(sock, msg, args, extra) {
    const chatId = msg.key.remoteJid;
    const fail = (text) => sock.sendMessage(chatId, { text }, { quoted: msg });

    try {
      const ctx = msg.message?.extendedTextMessage?.contextInfo
        || msg.message?.imageMessage?.contextInfo
        || msg.message?.videoMessage?.contextInfo
        || msg.message?.audioMessage?.contextInfo
        || msg.message?.buttonsResponseMessage?.contextInfo
        || msg.message?.listResponseMessage?.contextInfo;

      if (!ctx?.quotedMessage || !ctx?.stanzaId) {
        return fail('🗑️ Reply to a *view-once* message.\nIt will be sent to your DM.');
      }

      const quotedMsg = ctx.quotedMessage;
      const hasViewOnce =
        !!quotedMsg.viewOnceMessageV2 ||
        !!quotedMsg.viewOnceMessageV2Extension ||
        !!quotedMsg.viewOnceMessage ||
        !!quotedMsg.viewOnce ||
        !!quotedMsg?.imageMessage?.viewOnce ||
        !!quotedMsg?.videoMessage?.viewOnce ||
        !!quotedMsg?.audioMessage?.viewOnce;

      if (!hasViewOnce) {
        return fail('❌ This is not a view-once message!');
      }

      let actualMsg = null;
      let mtype = null;

      if (quotedMsg.viewOnceMessageV2Extension?.message) {
        actualMsg = quotedMsg.viewOnceMessageV2Extension.message;
        mtype = Object.keys(actualMsg)[0];
      } else if (quotedMsg.viewOnceMessageV2?.message) {
        actualMsg = quotedMsg.viewOnceMessageV2.message;
        mtype = Object.keys(actualMsg)[0];
      } else if (quotedMsg.viewOnceMessage?.message) {
        actualMsg = quotedMsg.viewOnceMessage.message;
        mtype = Object.keys(actualMsg)[0];
      } else if (quotedMsg.imageMessage?.viewOnce) {
        actualMsg = { imageMessage: quotedMsg.imageMessage };
        mtype = 'imageMessage';
      } else if (quotedMsg.videoMessage?.viewOnce) {
        actualMsg = { videoMessage: quotedMsg.videoMessage };
        mtype = 'videoMessage';
      } else if (quotedMsg.audioMessage?.viewOnce) {
        actualMsg = { audioMessage: quotedMsg.audioMessage };
        mtype = 'audioMessage';
      }

      if (!actualMsg || !mtype) {
        return fail('❌ Unsupported view-once message type.');
      }

      let dest = getSenderDmJid(msg, extra);
      if (!dest) {
        return fail('❌ Could not determine your DM address.');
      }

      const downloadType =
        mtype === 'imageMessage' ? 'image' : mtype === 'videoMessage' ? 'video' : 'audio';

      const mediaStream = await downloadContentFromMessage(actualMsg[mtype], downloadType);
      let buffer = Buffer.from([]);
      for await (const chunk of mediaStream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      const caption = actualMsg[mtype]?.caption || '';
      const payload = /video/.test(mtype)
        ? { video: buffer, caption, mimetype: 'video/mp4' }
        : /image/.test(mtype)
          ? { image: buffer, caption, mimetype: 'image/jpeg' }
          : { audio: buffer, ptt: true, mimetype: 'audio/ogg; codecs=opus' };

      await sock.sendMessage(dest, payload);

      if (dest !== chatId) {
        await sock.sendMessage(chatId, { text: '✅ Sent to your DM.' }, { quoted: msg });
      }
    } catch (error) {
      console.error('Error in vv2 command:', error);
      await fail('❌ Error processing view-once message: ' + (error.message || 'Unknown error'));
    }
  }
};
