import { getGame, createGame, deleteGame } from "../lib/tictactoe.js";
import { formatBox, formatError } from "../lib/format.js";

function getTargetJid(message, args) {
  const quoted = message.message?.extendedTextMessage?.contextInfo?.participant;
  if (quoted) return quoted;
  const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
  if (mentioned?.length) return mentioned[0];
  return null;
}

export const command = {
  name: "tictactoe",
  aliases: ["ttt"],
  category: "FUN",
  description: "Play an interactive Tic-Tac-Toe game with a group member (.ttt @user or .ttt <1-9>)",
  usage: ".ttt @user OR .ttt <1-9>",
  async execute({ message, args, reply, remoteJid, senderJid }) {
    let game = getGame(remoteJid);

    // If making a move 1-9
    if (args.length > 0 && /^[1-9]$/.test(args[0])) {
      if (!game) {
        await reply(formatError("No active Tic-Tac-Toe game in this chat. Start one with .ttt @user"));
        return;
      }

      const move = parseInt(args[0], 10);
      const success = game.makeMove(senderJid, move);

      if (!success) {
        await reply(formatError("Invalid move or not your turn. Choose an empty position 1-9."));
        return;
      }

      const boardStr = game.renderBoard();

      if (game.winner) {
        deleteGame(remoteJid);
        await reply(formatBox("TIC-TAC-TOE WINNER! 🏆", `${boardStr}\n\n🎉 Winner: @${game.winner.split("@")[0]}`), { mentions: [game.winner] });
        return;
      }

      if (game.isDraw) {
        deleteGame(remoteJid);
        await reply(formatBox("TIC-TAC-TOE DRAW! 🤝", `${boardStr}\n\nGame ended in a draw!`));
        return;
      }

      const nextTurnUser = game.currentTurn.split("@")[0];
      await reply(formatBox("TIC-TAC-TOE", `${boardStr}\n\nTurn: @${nextTurnUser} (${game.currentTurn === game.playerX ? "❌" : "⭕"})\nMake move with .ttt <1-9>`), { mentions: [game.currentTurn] });
      return;
    }

    // Start a new game
    const target = getTargetJid(message, args);
    if (!target) {
      await reply(formatError("To start a game, mention an opponent: .ttt @user"));
      return;
    }

    if (target === senderJid) {
      await reply(formatError("You cannot play Tic-Tac-Toe against yourself. Mention a friend!"));
      return;
    }

    game = createGame(remoteJid, senderJid, target);
    const boardStr = game.renderBoard();

    await reply(formatBox("TIC-TAC-TOE STARTED!", `Player ❌: @${senderJid.split("@")[0]}\nPlayer ⭕: @${target.split("@")[0]}\n\n${boardStr}\n\nTurn: @${senderJid.split("@")[0]} (❌)\nMake move with .ttt <1-9>`), { mentions: [senderJid, target] });
  }
};
