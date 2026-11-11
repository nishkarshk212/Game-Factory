import { asInt, asRecord, InvalidMoveError, type GameEngine, type MoveResult } from './engine.js';

export interface ConnectFourState {
  rows: number;
  cols: number;
  board: (0 | 1 | null)[][]; // [row][col], row 0 is top
  lastMove: { row: number; col: number } | null;
  winCells: [number, number][] | null;
}

const ROWS = 6;
const COLS = 7;

export function findConnectFourWin(
  board: (0 | 1 | null)[][],
  rows: number,
  cols: number
): { winner: 0 | 1; cells: [number, number][] } | null {
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1]
  ];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = board[r][c];
      if (p === null) continue;
      for (const [dr, dc] of dirs) {
        const line: [number, number][] = [[r, c]];
        for (let step = 1; step < 4; step++) {
          const nr = r + dr * step;
          const nc = c + dc * step;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || board[nr][nc] !== p) break;
          line.push([nr, nc]);
        }
        if (line.length === 4) return { winner: p, cells: line };
      }
    }
  }
  return null;
}

export const connectFourEngine: GameEngine<ConnectFourState> = {
  id: 'connect_four',
  createInitialState(): ConnectFourState {
    return {
      rows: ROWS,
      cols: COLS,
      board: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
      lastMove: null,
      winCells: null
    };
  },
  applyMove(state, playerIndex, currentTurnIndex, payload): MoveResult<ConnectFourState> {
    if (playerIndex !== currentTurnIndex) {
      throw new InvalidMoveError('Not your turn');
    }
    const data = asRecord(payload);
    const col = asInt(data.col, 'column', 0, COLS - 1);

    let targetRow = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (state.board[r][col] === null) {
        targetRow = r;
        break;
      }
    }
    if (targetRow === -1) {
      throw new InvalidMoveError('Column is full');
    }

    const nextBoard = state.board.map((row) => [...row]);
    nextBoard[targetRow][col] = playerIndex;

    const win = findConnectFourWin(nextBoard, ROWS, COLS);
    if (win) {
      const scores: [number, number] = win.winner === 0 ? [1, 0] : [0, 1];
      return {
        state: {
          ...state,
          board: nextBoard,
          lastMove: { row: targetRow, col },
          winCells: win.cells
        },
        nextTurnIndex: playerIndex,
        scores,
        finished: true,
        winnerIndex: win.winner,
        isDraw: false,
        eventText: 'Four connected!'
      };
    }

    const isFull = nextBoard[0].every((c) => c !== null);
    return {
      state: {
        ...state,
        board: nextBoard,
        lastMove: { row: targetRow, col },
        winCells: null
      },
      nextTurnIndex: playerIndex === 0 ? 1 : 0,
      scores: [0, 0],
      finished: isFull,
      winnerIndex: null,
      isDraw: isFull,
      eventText: isFull ? 'Board full — Draw!' : undefined
    };
  },
  sanitizeForPlayer(state) {
    return state;
  }
};

