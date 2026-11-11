import { asInt, asRecord, InvalidMoveError, type GameEngine, type MoveResult } from './engine.js';

export interface CheckersPiece {
  player: 0 | 1; // 0 moves UP (-1 row), 1 moves DOWN (+1 row)
  king: boolean;
}

export interface CheckersLegalMove {
  from: [number, number];
  to: [number, number];
  captured: [number, number] | null;
}

export interface CheckersState {
  board: (CheckersPiece | null)[][]; // 8x8
  mustContinueFrom: [number, number] | null;
  legalMoves: CheckersLegalMove[];
  scores: [number, number]; // captured opponent pieces count
  noProgressMoves: number;
  lastMove: { from: [number, number]; to: [number, number] } | null;
}

const SIZE = 8;

function getPieceCaptures(
  board: (CheckersPiece | null)[][],
  r: number,
  c: number,
  piece: CheckersPiece
): CheckersLegalMove[] {
  const dirs = piece.king
    ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
    : piece.player === 0
      ? [[-1, -1], [-1, 1]]
      : [[1, -1], [1, 1]];

  const captures: CheckersLegalMove[] = [];
  for (const [dr, dc] of dirs) {
    const mr = r + dr;
    const mc = c + dc;
    const lr = r + dr * 2;
    const lc = c + dc * 2;
    if (lr < 0 || lr >= SIZE || lc < 0 || lc >= SIZE) continue;
    const mid = board[mr][mc];
    if (mid && mid.player !== piece.player && board[lr][lc] === null) {
      captures.push({ from: [r, c], to: [lr, lc], captured: [mr, mc] });
    }
  }
  return captures;
}

function getPieceSteps(
  board: (CheckersPiece | null)[][],
  r: number,
  c: number,
  piece: CheckersPiece
): CheckersLegalMove[] {
  const dirs = piece.king
    ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
    : piece.player === 0
      ? [[-1, -1], [-1, 1]]
      : [[1, -1], [1, 1]];

  const steps: CheckersLegalMove[] = [];
  for (const [dr, dc] of dirs) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
    if (board[nr][nc] === null) {
      steps.push({ from: [r, c], to: [nr, nc], captured: null });
    }
  }
  return steps;
}

export function computeCheckersLegalMoves(
  board: (CheckersPiece | null)[][],
  player: 0 | 1,
  mustContinueFrom: [number, number] | null
): CheckersLegalMove[] {
  if (mustContinueFrom) {
    const [r, c] = mustContinueFrom;
    const p = board[r][c];
    if (!p || p.player !== player) return [];
    return getPieceCaptures(board, r, c, p);
  }

  const allCaptures: CheckersLegalMove[] = [];
  const allSteps: CheckersLegalMove[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = board[r][c];
      if (!p || p.player !== player) continue;
      allCaptures.push(...getPieceCaptures(board, r, c, p));
      allSteps.push(...getPieceSteps(board, r, c, p));
    }
  }
  // Mandatory capture rule
  return allCaptures.length > 0 ? allCaptures : allSteps;
}

export const checkersEngine: GameEngine<CheckersState> = {
  id: 'checkers',
  createInitialState(): CheckersState {
    const board: (CheckersPiece | null)[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < SIZE; c++) {
        if ((r + c) % 2 === 1) board[r][c] = { player: 1, king: false };
      }
    }
    for (let r = 5; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if ((r + c) % 2 === 1) board[r][c] = { player: 0, king: false };
      }
    }
    return {
      board,
      mustContinueFrom: null,
      legalMoves: computeCheckersLegalMoves(board, 0, null),
      scores: [0, 0],
      noProgressMoves: 0,
      lastMove: null
    };
  },
  applyMove(state, playerIndex, currentTurnIndex, payload): MoveResult<CheckersState> {
    if (playerIndex !== currentTurnIndex) {
      throw new InvalidMoveError('Not your turn');
    }
    const data = asRecord(payload);
    if (!Array.isArray(data.from) || !Array.isArray(data.to)) {
      throw new InvalidMoveError('Invalid from/to coordinates');
    }
    const fr = asInt(data.from[0], 'from row', 0, 7);
    const fc = asInt(data.from[1], 'from col', 0, 7);
    const tr = asInt(data.to[0], 'to row', 0, 7);
    const tc = asInt(data.to[1], 'to col', 0, 7);

    const legal = computeCheckersLegalMoves(state.board, playerIndex, state.mustContinueFrom);
    const chosen = legal.find(
      (m) => m.from[0] === fr && m.from[1] === fc && m.to[0] === tr && m.to[1] === tc
    );
    if (!chosen) {
      throw new InvalidMoveError('Illegal checkers move (captures are mandatory when available)');
    }

    const nextBoard = state.board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
    const movingPiece = { ...nextBoard[fr][fc]! };
    nextBoard[fr][fc] = null;

    const scores: [number, number] = [...state.scores] as [number, number];
    if (chosen.captured) {
      nextBoard[chosen.captured[0]][chosen.captured[1]] = null;
      scores[playerIndex] += 1;
    }

    let justCrowned = false;
    if (!movingPiece.king && ((movingPiece.player === 0 && tr === 0) || (movingPiece.player === 1 && tr === 7))) {
      movingPiece.king = true;
      justCrowned = true;
    }
    nextBoard[tr][tc] = movingPiece;

    const nextProgress = chosen.captured || !movingPiece.king ? 0 : state.noProgressMoves + 1;

    // Multi-jump check (ends if just crowned per standard American Checkers)
    if (chosen.captured && !justCrowned) {
      const followUps = getPieceCaptures(nextBoard, tr, tc, movingPiece);
      if (followUps.length > 0) {
        return {
          state: {
            board: nextBoard,
            mustContinueFrom: [tr, tc],
            legalMoves: followUps,
            scores,
            noProgressMoves: nextProgress,
            lastMove: { from: [fr, fc], to: [tr, tc] }
          },
          nextTurnIndex: playerIndex,
          scores,
          finished: false,
          winnerIndex: null,
          isDraw: false,
          eventText: 'Multi-jump available! Continue capturing.'
        };
      }
    }

    const opp: 0 | 1 = playerIndex === 0 ? 1 : 0;
    const oppMoves = computeCheckersLegalMoves(nextBoard, opp, null);

    if (oppMoves.length === 0) {
      return {
        state: {
          board: nextBoard,
          mustContinueFrom: null,
          legalMoves: [],
          scores,
          noProgressMoves: nextProgress,
          lastMove: { from: [fr, fc], to: [tr, tc] }
        },
        nextTurnIndex: playerIndex,
        scores,
        finished: true,
        winnerIndex: playerIndex,
        isDraw: false,
        eventText: 'Opponent has no remaining moves — Victory!'
      };
    }

    if (nextProgress >= 80) {
      return {
        state: {
          board: nextBoard,
          mustContinueFrom: null,
          legalMoves: [],
          scores,
          noProgressMoves: nextProgress,
          lastMove: { from: [fr, fc], to: [tr, tc] }
        },
        nextTurnIndex: opp,
        scores,
        finished: true,
        winnerIndex: null,
        isDraw: true,
        eventText: '40-move draw reached!'
      };
    }

    return {
      state: {
        board: nextBoard,
        mustContinueFrom: null,
        legalMoves: oppMoves,
        scores,
        noProgressMoves: nextProgress,
        lastMove: { from: [fr, fc], to: [tr, tc] }
      },
      nextTurnIndex: opp,
      scores,
      finished: false,
      winnerIndex: null,
      isDraw: false,
      eventText: justCrowned ? 'Piece crowned as King!' : undefined
    };
  },
  sanitizeForPlayer(state) {
    return state;
  }
};

