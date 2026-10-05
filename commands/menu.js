export const command = {
  name: "menu",
  description: "Show available commands",
  async execute({ reply, prefix }) {
    await reply(
`╭━━━〔 ⚡ VOLTRA MINI 〕━━━╮
┃
┃  ${prefix}menu
┃  ${prefix}ping
┃  ${prefix}alive
┃  ${prefix}owner
┃
┃  More commands can be added
┃  as separate modules later.
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯`
    );
  }
};
