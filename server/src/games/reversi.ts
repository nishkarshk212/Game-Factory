import { asInt, asRecord, InvalidMoveError, type GameEngine, type MoveResult } from './engine.js';

export interface ReversiState {
  board: (0 | 1 | null)[][]; // 8x8
  scores: [number, number];
  validMoves: [number, number][];
  lastMove: [number, number] | null;
  lastFlipped: [number, number][];
}

const SIZE = 8;
const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1]
];

function getFlipsForMove(board: (0 | 1 | null)[][], r: number, c: number, player: 0 | 1): [number, number][] {
  if (board[r][c] !== null) return [];
  const opp: 0 | 1 = player === 0 ? 1 : 0;
  const flips: [number, number][] = [];

  for (const [dr, dc] of DIRS) {
    const line: [number, number][] = [];
    let nr = r + dr;
    let nc = c + dc;
    while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === opp) {
      line.push([nr, nc]);
      nr += dr;
      nc += dc;
    }
    if (line.length > 0 && nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === player) {
      flips.push(...line);
    }
  }
  return flips;
}

function getAllValidMoves(board: (0 | 1 | null)[][], player: 0 | 1): [number, number][] {
  const moves: [number, number][] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (getFlipsForMove(board, r, c, player).length > 0) {
        moves.push([r, c]);
      }
    }
  }
  return moves;
}

function countScores(board: (0 | 1 | null)[][]): [number, number] {
  let s0 = 0;
  let s1 = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) s0++;
      else if (board[r][c] === 1) s1++;
    }
  }
  return [s0, s1];
}

export const reversiEngine: GameEngine<ReversiState> = {
  id: 'reversi',
  createInitialState(): ReversiState {
    const board: (0 | 1 | null)[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    board[3][3] = 1;
    board[3][4] = 0;
    board[4][3] = 0;
    board[4][4] = 1;
    return {
      board,
      scores: [2, 2],
      validMoves: getAllValidMoves(board, 0),
      lastMove: null,
      lastFlipped: []
    };
  },
  applyMove(state, playerIndex, currentTurnIndex, payload): MoveResult<ReversiState> {
    if (playerIndex !== currentTurnIndex) {
      throw new InvalidMoveError('Not your turn');
    }
    const data = asRecord(payload);
    const r = asInt(data.r, 'row', 0, SIZE - 1);
    const c = asInt(data.c, 'col', 0, SIZE - 1);

    const flips = getFlipsForMove(state.board, r, c, playerIndex);
    if (flips.length === 0) {
      throw new InvalidMoveError('Illegal Reversi move — must outflank opponent discs');
    }

    const nextBoard = state.board.map((row) => [...row]);
    nextBoard[r][c] = playerIndex;
    for (const [fr, fc] of flips) {
      nextBoard[fr][fc] = playerIndex;
    }

    const scores = countScores(nextBoard);
    const opp: 0 | 1 = playerIndex === 0 ? 1 : 0;
    const oppMoves = getAllValidMoves(nextBoard, opp);
    const selfMoves = getAllValidMoves(nextBoard, playerIndex);

    if (oppMoves.length === 0 && selfMoves.length === 0) {
      const winnerIndex = scores[0] > scores[1] ? 0 : scores[1] > scores[0] ? 1 : null;
      return {
        state: {
          board: nextBoard,
          scores,
          validMoves: [],
          lastMove: [r, c],
          lastFlipped: flips
        },
        nextTurnIndex: playerIndex,
        scores,
        finished: true,
        winnerIndex,
        isDraw: winnerIndex === null,
        eventText: 'No valid moves left — Game Over!'
      };
    }

    const nextTurnIndex = oppMoves.length > 0 ? opp : playerIndex;
    const validMoves = oppMoves.length > 0 ? oppMoves : selfMoves;

    return {
      state: {
        board: nextBoard,
        scores,
        validMoves,
        lastMove: [r, c],
        lastFlipped: flips
      },
      nextTurnIndex,
      scores,
      finished: false,
      winnerIndex: null,
      isDraw: false,
      eventText: oppMoves.length === 0 ? 'Opponent has no legal moves — turn skipped!' : undefined
    };
  },
  sanitizeForPlayer(state) {
    return state;
  }
};

