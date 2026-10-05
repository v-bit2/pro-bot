export const command = {
  name: "alive",
  description: "Show bot status",
  async execute({ reply }) {
    await reply(
`⚡ *Voltra Mini*

Status: Online
Engine: Baileys
Mode: Mini MD Bot`
    );
  }
};
