import { asInt, asRecord, InvalidMoveError, type GameEngine, type MoveResult } from './engine.js';
import { findConnectFourWin } from './connectFour.js';

export interface FourInARowState {
  rows: number;
  cols: number;
  board: (0 | 1 | null)[][]; // 7 rows x 8 cols
  lastAction: { action: 'drop' | 'pop'; row: number; col: number; player: 0 | 1 } | null;
  winCells: [number, number][] | null;
  popCount: [number, number];
}

const ROWS = 7;
const COLS = 8;

function findPlayerWins(board: (0 | 1 | null)[][], targetPlayer: 0 | 1): [number, number][] | null {
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1]
  ];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] !== targetPlayer) continue;
      for (const [dr, dc] of dirs) {
        const line: [number, number][] = [[r, c]];
        for (let step = 1; step < 4; step++) {
          const nr = r + dr * step;
          const nc = c + dc * step;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc] !== targetPlayer) break;
          line.push([nr, nc]);
        }
        if (line.length === 4) return line;
      }
    }
  }
  return null;
}

export const fourInARowEngine: GameEngine<FourInARowState> = {
  id: 'four_in_a_row',
  createInitialState(): FourInARowState {
    return {
      rows: ROWS,
      cols: COLS,
      board: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
      lastAction: null,
      winCells: null,
      popCount: [0, 0]
    };
  },
  applyMove(state, playerIndex, currentTurnIndex, payload): MoveResult<FourInARowState> {
    if (playerIndex !== currentTurnIndex) {
      throw new InvalidMoveError('Not your turn');
    }
    const data = asRecord(payload);
    const action = data.action === 'pop' ? 'pop' : 'drop';
    const col = asInt(data.col, 'column', 0, COLS - 1);
    const nextBoard = state.board.map((row) => [...row]);
    const popCount: [number, number] = [...state.popCount] as [number, number];
    let actionRow = 0;

    if (action === 'drop') {
      let targetRow = -1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (nextBoard[r][col] === null) {
          targetRow = r;
          break;
        }
      }
      if (targetRow === -1) throw new InvalidMoveError('Column is full');
      nextBoard[targetRow][col] = playerIndex;
      actionRow = targetRow;
    } else {
      if (nextBoard[ROWS - 1][col] !== playerIndex) {
        throw new InvalidMoveError('You can only pop out your own disc from the bottom row');
      }
      for (let r = ROWS - 1; r > 0; r--) {
        nextBoard[r][col] = nextBoard[r - 1][col];
      }
      nextBoard[0][col] = null;
      actionRow = ROWS - 1;
      popCount[playerIndex] += 1;
    }

    const oppIndex: 0 | 1 = playerIndex === 0 ? 1 : 0;
    const oppWin = findPlayerWins(nextBoard, oppIndex);
    const selfWin = findPlayerWins(nextBoard, playerIndex);

    // If pop-out gives opponent 4-in-a-row (even if both get 4), opponent wins per Pop-Out rules
    if (oppWin) {
      const scores: [number, number] = oppIndex === 0 ? [1, 0] : [0, 1];
      return {
        state: {
          ...state,
          board: nextBoard,
          lastAction: { action, row: actionRow, col, player: playerIndex },
          winCells: oppWin,
          popCount
        },
        nextTurnIndex: playerIndex,
        scores,
        finished: true,
        winnerIndex: oppIndex,
        isDraw: false,
        eventText: 'Four in a Row achieved!'
      };
    }

    if (selfWin) {
      const scores: [number, number] = playerIndex === 0 ? [1, 0] : [0, 1];
      return {
        state: {
          ...state,
          board: nextBoard,
          lastAction: { action, row: actionRow, col, player: playerIndex },
          winCells: selfWin,
          popCount
        },
        nextTurnIndex: playerIndex,
        scores,
        finished: true,
        winnerIndex: playerIndex,
        isDraw: false,
        eventText: 'Four in a Row achieved!'
      };
    }

    const isFull = nextBoard[0].every((c) => c !== null) &&
      !nextBoard[ROWS - 1].some((c) => c === oppIndex); // draw only if next player can neither drop nor pop

    const winCheck = findConnectFourWin(nextBoard, ROWS, COLS);
    return {
      state: {
        ...state,
        board: nextBoard,
        lastAction: { action, row: actionRow, col, player: playerIndex },
        winCells: winCheck?.cells ?? null,
        popCount
      },
      nextTurnIndex: oppIndex,
      scores: [0, 0],
      finished: isFull,
      winnerIndex: null,
      isDraw: isFull,
      eventText: action === 'pop' ? `Popped column ${col + 1}!` : undefined
    };
  },
  sanitizeForPlayer(state) {
    return state;
  }
};

