import { asInt, asRecord, InvalidMoveError, type GameEngine, type MoveResult } from './engine.js';

export interface TicTacToeState {
  board: (0 | 1 | null)[]; // stores playerIndex who placed mark
  round: number;
  roundStarter: 0 | 1;
  roundWins: [number, number];
  draws: number;
  lastWinLine: number[] | null;
  lastRoundWinner: 0 | 1 | 'draw' | null;
}

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

function checkBoardWin(board: (0 | 1 | null)[]): { winner: 0 | 1; line: number[] } | null {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] !== null && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a]!, line };
    }
  }
  return null;
}

export const ticTacToeEngine: GameEngine<TicTacToeState> = {
  id: 'tic_tac_toe',
  createInitialState(): TicTacToeState {
    return {
      board: Array(9).fill(null),
      round: 1,
      roundStarter: 0,
      roundWins: [0, 0],
      draws: 0,
      lastWinLine: null,
      lastRoundWinner: null
    };
  },
  applyMove(state, playerIndex, currentTurnIndex, payload): MoveResult<TicTacToeState> {
    if (playerIndex !== currentTurnIndex) {
      throw new InvalidMoveError('Not your turn');
    }
    const data = asRecord(payload);
    const cell = asInt(data.cell, 'cell', 0, 8);
    if (state.board[cell] !== null) {
      throw new InvalidMoveError('Cell is already occupied');
    }

    const nextBoard = [...state.board];
    nextBoard[cell] = playerIndex;

    const win = checkBoardWin(nextBoard);
    const full = nextBoard.every((c) => c !== null);

    if (win) {
      const nextWins: [number, number] = [...state.roundWins] as [number, number];
      nextWins[win.winner] += 1;
      const matchWon = nextWins[win.winner] >= 2;
      if (matchWon) {
        return {
          state: {
            ...state,
            board: nextBoard,
            roundWins: nextWins,
            lastWinLine: win.line,
            lastRoundWinner: win.winner
          },
          nextTurnIndex: playerIndex,
          scores: nextWins,
          finished: true,
          winnerIndex: win.winner,
          isDraw: false,
          eventText: `Round ${state.round} & Match won!`
        };
      }
      const nextStarter: 0 | 1 = state.roundStarter === 0 ? 1 : 0;
      return {
        state: {
          board: Array(9).fill(null),
          round: state.round + 1,
          roundStarter: nextStarter,
          roundWins: nextWins,
          draws: state.draws,
          lastWinLine: win.line,
          lastRoundWinner: win.winner
        },
        nextTurnIndex: nextStarter,
        scores: nextWins,
        finished: false,
        winnerIndex: null,
        isDraw: false,
        eventText: `Round ${state.round} won! Next round started.`
      };
    }

    if (full) {
      const nextDraws = state.draws + 1;
      const totalRoundsPlayed = state.round;
      if (totalRoundsPlayed >= 5) {
        const w =
          state.roundWins[0] > state.roundWins[1]
            ? 0
            : state.roundWins[1] > state.roundWins[0]
              ? 1
              : null;
        return {
          state: {
            ...state,
            board: nextBoard,
            draws: nextDraws,
            lastWinLine: null,
            lastRoundWinner: 'draw'
          },
          nextTurnIndex: playerIndex,
          scores: state.roundWins,
          finished: true,
          winnerIndex: w,
          isDraw: w === null,
          eventText: w === null ? 'Match ended in a draw after 5 rounds!' : 'Match decided on round score!'
        };
      }
      const nextStarter: 0 | 1 = state.roundStarter === 0 ? 1 : 0;
      return {
        state: {
          board: Array(9).fill(null),
          round: state.round + 1,
          roundStarter: nextStarter,
          roundWins: state.roundWins,
          draws: nextDraws,
          lastWinLine: null,
          lastRoundWinner: 'draw'
        },
        nextTurnIndex: nextStarter,
        scores: state.roundWins,
        finished: false,
        winnerIndex: null,
        isDraw: false,
        eventText: `Round ${state.round} tied! Starting round ${state.round + 1}.`
      };
    }

    return {
      state: {
        ...state,
        board: nextBoard,
        lastWinLine: null,
        lastRoundWinner: null
      },
      nextTurnIndex: playerIndex === 0 ? 1 : 0,
      scores: state.roundWins,
      finished: false,
      winnerIndex: null,
      isDraw: false
    };
  },
  sanitizeForPlayer(state) {
    return state;
  }
};

