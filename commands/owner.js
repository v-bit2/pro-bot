export const command = {
  name: "owner",
  aliases: ["creator", "developer"],
  category: "GENERAL",
  description: "Display owner contact information",
  usage: ".owner",
  async execute({ sock, message, config }) {
    const ownerNumber = config.owner;
    await sock.sendMessage(
      message.key.remoteJid,
      {
        contacts: {
          displayName: `${config.name} Owner`,
          contacts: [{
            vcard: `BEGIN:VCARD
VERSION:3.0
FN:${config.name} Owner
TEL;type=CELL;type=VOICE;waid=${ownerNumber}:+${ownerNumber}
END:VCARD`
          }]
        }
      },
      { quoted: message }
    );
  }
};
