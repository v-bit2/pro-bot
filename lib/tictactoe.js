/**
 * Interactive Tic-Tac-Toe state engine.
 */

const games = new Map(); // chatId -> Game state

const EMOJI_NUMS = {
  "1": "1️⃣", "2": "2️⃣", "3": "3️⃣",
  "4": "4️⃣", "5": "5️⃣", "6": "6️⃣",
  "7": "7️⃣", "8": "8️⃣", "9": "9️⃣"
};

export class TicTacToe {
  constructor(playerX, playerO) {
    this.playerX = playerX; // JID
    this.playerO = playerO; // JID
    this.board = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
    this.currentTurn = playerX;
    this.winner = null;
    this.isDraw = false;
  }

  renderBoard() {
    const b = this.board.map(cell => {
      if (cell === "X") return "❌";
      if (cell === "O") return "⭕";
      return EMOJI_NUMS[cell] || cell;
    });

    return `${b[0]} ${b[1]} ${b[2]}
${b[3]} ${b[4]} ${b[5]}
${b[6]} ${b[7]} ${b[8]}`;
  }

  makeMove(player, position) {
    if (this.winner || this.isDraw) return false;
    if (player !== this.currentTurn) return false;

    const idx = position - 1;
    if (idx < 0 || idx > 8) return false;
    if (this.board[idx] === "X" || this.board[idx] === "O") return false;

    const symbol = player === this.playerX ? "X" : "O";
    this.board[idx] = symbol;

    if (this.checkWin(symbol)) {
      this.winner = player;
    } else if (this.board.every(cell => cell === "X" || cell === "O")) {
      this.isDraw = true;
    } else {
      this.currentTurn = player === this.playerX ? this.playerO : this.playerX;
    }

    return true;
  }

  checkWin(symbol) {
    const wins = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    return wins.some(w => w.every(i => this.board[i] === symbol));
  }
}

export function getGame(chatId) {
  return games.get(chatId);
}

export function createGame(chatId, playerX, playerO) {
  const game = new TicTacToe(playerX, playerO);
  games.set(chatId, game);
  return game;
}

export function deleteGame(chatId) {
  games.delete(chatId);
}
