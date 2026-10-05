export const command = {
  name: "owner",
  description: "Show owner number",
  async execute({ sock, message }) {
    const owner = "263786624966";
    const jid = `${owner}@s.whatsapp.net`;
    await sock.sendMessage(
      message.key.remoteJid,
      {
        contacts: {
          displayName: "Voltra Mini Owner",
          contacts: [{
            vcard:
`BEGIN:VCARD
VERSION:3.0
FN:Voltra Mini Owner
TEL;type=CELL;type=VOICE;waid=${owner}:+${owner}
END:VCARD`
          }]
        }
      },
      { quoted: message }
    );
  }
};
