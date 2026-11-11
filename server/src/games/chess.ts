import { asInt, asRecord, InvalidMoveError, type GameEngine, type MoveResult } from './engine.js';

export type ChessColor = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export interface ChessPiece {
  color: ChessColor;
  type: PieceType;
}

export interface ChessLegalMove {
  from: [number, number];
  to: [number, number];
  isPromotion?: boolean;
  isCastling?: 'K' | 'Q';
  isEnPassant?: boolean;
}

export interface ChessState {
  board: (ChessPiece | null)[][]; // [row 0..7][col 0..7], row 0 is Black back rank (rank 8)
  turn: ChessColor;
  castling: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };
  enPassant: [number, number] | null;
  halfmoveClock: number;
  fullmoveNumber: number;
  inCheck: boolean;
  legalMoves: ChessLegalMove[];
  capturedByWhite: PieceType[];
  capturedByBlack: PieceType[];
  moveHistory: string[];
  lastMove: { from: [number, number]; to: [number, number] } | null;
  positionCounts: Record<string, number>;
  scores: [number, number]; // captured material points
}

const PIECE_VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const FILES = 'abcdefgh';

function cloneBoard(board: (ChessPiece | null)[][]): (ChessPiece | null)[][] {
  return board.map((r) => r.map((p) => (p ? { ...p } : null)));
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function isSquareAttacked(
  board: (ChessPiece | null)[][],
  targetR: number,
  targetC: number,
  byColor: ChessColor
): boolean {
  // Pawns
  const pawnDir = byColor === 'w' ? 1 : -1;
  for (const dc of [-1, 1]) {
    const pr = targetR + pawnDir;
    const pc = targetC + dc;
    if (inBounds(pr, pc)) {
      const p = board[pr][pc];
      if (p && p.color === byColor && p.type === 'p') return true;
    }
  }
  // Knights
  for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
    const nr = targetR + dr;
    const nc = targetC + dc;
    if (inBounds(nr, nc)) {
      const p = board[nr][nc];
      if (p && p.color === byColor && p.type === 'n') return true;
    }
  }
  // King
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const kr = targetR + dr;
      const kc = targetC + dc;
      if (inBounds(kr, kc)) {
        const p = board[kr][kc];
        if (p && p.color === byColor && p.type === 'k') return true;
      }
    }
  }
  // Straight rays (Rook / Queen)
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    let r = targetR + dr;
    let c = targetC + dc;
    while (inBounds(r, c)) {
      const p = board[r][c];
      if (p) {
        if (p.color === byColor && (p.type === 'r' || p.type === 'q')) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }
  // Diagonal rays (Bishop / Queen)
  for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    let r = targetR + dr;
    let c = targetC + dc;
    while (inBounds(r, c)) {
      const p = board[r][c];
      if (p) {
        if (p.color === byColor && (p.type === 'b' || p.type === 'q')) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }
  return false;
}

function findKing(board: (ChessPiece | null)[][], color: ChessColor): [number, number] | null {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === color && p.type === 'k') return [r, c];
    }
  }
  return null;
}

function isKingInCheck(board: (ChessPiece | null)[][], color: ChessColor): boolean {
  const kPos = findKing(board, color);
  if (!kPos) return false;
  return isSquareAttacked(board, kPos[0], kPos[1], color === 'w' ? 'b' : 'w');
}

function applyRawMove(
  board: (ChessPiece | null)[][],
  move: ChessLegalMove,
  promo: PieceType = 'q'
): (ChessPiece | null)[][] {
  const next = cloneBoard(board);
  const [fr, fc] = move.from;
  const [tr, tc] = move.to;
  const piece = next[fr][fc]!;
  next[fr][fc] = null;

  if (move.isEnPassant) {
    next[fr][tc] = null;
  }
  if (move.isCastling === 'K') {
    next[fr][5] = next[fr][7];
    next[fr][7] = null;
  } else if (move.isCastling === 'Q') {
    next[fr][3] = next[fr][0];
    next[fr][0] = null;
  }

  next[tr][tc] = move.isPromotion ? { color: piece.color, type: promo } : piece;
  return next;
}

function generateLegalMoves(
  board: (ChessPiece | null)[][],
  turn: ChessColor,
  castling: ChessState['castling'],
  enPassant: [number, number] | null
): ChessLegalMove[] {
  const pseudo: ChessLegalMove[] = [];
  const opp: ChessColor = turn === 'w' ? 'b' : 'w';

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.color !== turn) continue;

      if (p.type === 'p') {
        const dir = turn === 'w' ? -1 : 1;
        const startRow = turn === 'w' ? 6 : 1;
        const promoRow = turn === 'w' ? 0 : 7;
        const nr = r + dir;
        if (inBounds(nr, c) && !board[nr][c]) {
          pseudo.push({ from: [r, c], to: [nr, c], isPromotion: nr === promoRow });
          if (r === startRow && !board[r + dir * 2][c]) {
            pseudo.push({ from: [r, c], to: [r + dir * 2, c] });
          }
        }
        for (const dc of [-1, 1]) {
          const nc = c + dc;
          if (!inBounds(nr, nc)) continue;
          const target = board[nr][nc];
          if (target && target.color === opp) {
            pseudo.push({ from: [r, c], to: [nr, nc], isPromotion: nr === promoRow });
          } else if (enPassant && enPassant[0] === nr && enPassant[1] === nc) {
            pseudo.push({ from: [r, c], to: [nr, nc], isEnPassant: true });
          }
        }
      } else if (p.type === 'n') {
        for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
          const nr = r + dr;
          const nc = c + dc;
          if (!inBounds(nr, nc)) continue;
          if (!board[nr][nc] || board[nr][nc]!.color === opp) {
            pseudo.push({ from: [r, c], to: [nr, nc] });
          }
        }
      } else if (p.type === 'k') {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (!inBounds(nr, nc)) continue;
            if (!board[nr][nc] || board[nr][nc]!.color === opp) {
              pseudo.push({ from: [r, c], to: [nr, nc] });
            }
          }
        }
        // Castling
        const homeRow = turn === 'w' ? 7 : 0;
        if (r === homeRow && c === 4 && !isKingInCheck(board, turn)) {
          const canK = turn === 'w' ? castling.wK : castling.bK;
          const canQ = turn === 'w' ? castling.wQ : castling.bQ;
          if (
            canK &&
            !board[homeRow][5] &&
            !board[homeRow][6] &&
            board[homeRow][7]?.type === 'r' &&
            board[homeRow][7]?.color === turn &&
            !isSquareAttacked(board, homeRow, 5, opp) &&
            !isSquareAttacked(board, homeRow, 6, opp)
          ) {
            pseudo.push({ from: [homeRow, 4], to: [homeRow, 6], isCastling: 'K' });
          }
          if (
            canQ &&
            !board[homeRow][3] &&
            !board[homeRow][2] &&
            !board[homeRow][1] &&
            board[homeRow][0]?.type === 'r' &&
            board[homeRow][0]?.color === turn &&
            !isSquareAttacked(board, homeRow, 3, opp) &&
            !isSquareAttacked(board, homeRow, 2, opp)
          ) {
            pseudo.push({ from: [homeRow, 4], to: [homeRow, 2], isCastling: 'Q' });
          }
        }
      } else {
        const rays =
          p.type === 'b'
            ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
            : p.type === 'r'
              ? [[-1, 0], [1, 0], [0, -1], [0, 1]]
              : [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of rays) {
          let nr = r + dr;
          let nc = c + dc;
          while (inBounds(nr, nc)) {
            const target = board[nr][nc];
            if (!target) {
              pseudo.push({ from: [r, c], to: [nr, nc] });
            } else {
              if (target.color === opp) pseudo.push({ from: [r, c], to: [nr, nc] });
              break;
            }
            nr += dr;
            nc += dc;
          }
        }
      }
    }
  }

  return pseudo.filter((mv) => !isKingInCheck(applyRawMove(board, mv), turn));
}

function hasInsufficientMaterial(board: (ChessPiece | null)[][]): boolean {
  const pieces: { color: ChessColor; type: PieceType; sqColor: number }[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type !== 'k') {
        pieces.push({ color: p.color, type: p.type, sqColor: (r + c) % 2 });
      }
    }
  }
  if (pieces.length === 0) return true;
  if (pieces.length === 1 && (pieces[0].type === 'b' || pieces[0].type === 'n')) return true;
  if (
    pieces.length === 2 &&
    pieces[0].type === 'b' &&
    pieces[1].type === 'b' &&
    pieces[0].sqColor === pieces[1].sqColor
  ) {
    return true;
  }
  return false;
}

function positionHash(
  board: (ChessPiece | null)[][],
  turn: ChessColor,
  castling: ChessState['castling'],
  enPassant: [number, number] | null
): string {
  const b = board
    .map((r) => r.map((p) => (p ? `${p.color}${p.type}` : '.')).join(''))
    .join('/');
  return `${b}|${turn}|${Number(castling.wK)}${Number(castling.wQ)}${Number(castling.bK)}${Number(castling.bQ)}|${enPassant ? `${enPassant[0]},${enPassant[1]}` : '-'}`;
}

function createInitialBoard(): (ChessPiece | null)[][] {
  const back: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  const board: (ChessPiece | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let c = 0; c < 8; c++) {
    board[0][c] = { color: 'b', type: back[c] };
    board[1][c] = { color: 'b', type: 'p' };
    board[6][c] = { color: 'w', type: 'p' };
    board[7][c] = { color: 'w', type: back[c] };
  }
  return board;
}

function toAlgebraic(
  piece: ChessPiece,
  move: ChessLegalMove,
  captured: boolean,
  promo: PieceType | undefined,
  inCheck: boolean,
  isMate: boolean
): string {
  if (move.isCastling === 'K') return `O-O${isMate ? '#' : inCheck ? '+' : ''}`;
  if (move.isCastling === 'Q') return `O-O-O${isMate ? '#' : inCheck ? '+' : ''}`;
  const sq = `${FILES[move.to[1]]}${8 - move.to[0]}`;
  const pPrefix = piece.type === 'p' ? (captured ? FILES[move.from[1]] : '') : piece.type.toUpperCase();
  const cap = captured ? 'x' : '';
  const prom = move.isPromotion ? `=${(promo || 'q').toUpperCase()}` : '';
  return `${pPrefix}${cap}${sq}${prom}${isMate ? '#' : inCheck ? '+' : ''}`;
}

export const chessEngine: GameEngine<ChessState> = {
  id: 'chess',
  createInitialState(): ChessState {
    const board = createInitialBoard();
    const castling = { wK: true, wQ: true, bK: true, bQ: true };
    const hash = positionHash(board, 'w', castling, null);
    return {
      board,
      turn: 'w',
      castling,
      enPassant: null,
      halfmoveClock: 0,
      fullmoveNumber: 1,
      inCheck: false,
      legalMoves: generateLegalMoves(board, 'w', castling, null),
      capturedByWhite: [],
      capturedByBlack: [],
      moveHistory: [],
      lastMove: null,
      positionCounts: { [hash]: 1 },
      scores: [0, 0]
    };
  },
  applyMove(state, playerIndex, currentTurnIndex, payload): MoveResult<ChessState> {
    if (playerIndex !== currentTurnIndex) {
      throw new InvalidMoveError('Not your turn');
    }
    const expectedColor: ChessColor = playerIndex === 0 ? 'w' : 'b';
    if (state.turn !== expectedColor) {
      throw new InvalidMoveError('Turn color mismatch');
    }

    const data = asRecord(payload);
    if (!Array.isArray(data.from) || !Array.isArray(data.to)) {
      throw new InvalidMoveError('Invalid chess coordinates');
    }
    const fr = asInt(data.from[0], 'from row', 0, 7);
    const fc = asInt(data.from[1], 'from col', 0, 7);
    const tr = asInt(data.to[0], 'to row', 0, 7);
    const tc = asInt(data.to[1], 'to col', 0, 7);

    const legal = generateLegalMoves(state.board, state.turn, state.castling, state.enPassant);
    const chosen = legal.find(
      (m) => m.from[0] === fr && m.from[1] === fc && m.to[0] === tr && m.to[1] === tc
    );
    if (!chosen) {
      throw new InvalidMoveError('Illegal chess move');
    }

    let promo: PieceType = 'q';
    if (chosen.isPromotion && data.promotion) {
      if (data.promotion === 'q' || data.promotion === 'r' || data.promotion === 'b' || data.promotion === 'n') {
        promo = data.promotion;
      } else {
        throw new InvalidMoveError('Invalid promotion piece');
      }
    }

    const movingPiece = state.board[fr][fc]!;
    const targetPiece = state.board[tr][tc];
    const capturedPiece: ChessPiece | null = chosen.isEnPassant
      ? state.board[fr][tc]
      : targetPiece;

    const nextBoard = applyRawMove(state.board, chosen, promo);
    const nextTurn: ChessColor = state.turn === 'w' ? 'b' : 'w';
    const nextTurnIndex: 0 | 1 = nextTurn === 'w' ? 0 : 1;

    // Update castling rights
    const nextCastling = { ...state.castling };
    if (movingPiece.type === 'k') {
      if (movingPiece.color === 'w') {
        nextCastling.wK = false;
        nextCastling.wQ = false;
      } else {
        nextCastling.bK = false;
        nextCastling.bQ = false;
      }
    }
    if (movingPiece.type === 'r') {
      if (fr === 7 && fc === 0) nextCastling.wQ = false;
      if (fr === 7 && fc === 7) nextCastling.wK = false;
      if (fr === 0 && fc === 0) nextCastling.bQ = false;
      if (fr === 0 && fc === 7) nextCastling.bK = false;
    }
    if (tr === 7 && tc === 0) nextCastling.wQ = false;
    if (tr === 7 && tc === 7) nextCastling.wK = false;
    if (tr === 0 && tc === 0) nextCastling.bQ = false;
    if (tr === 0 && tc === 7) nextCastling.bK = false;

    let nextEnPassant: [number, number] | null = null;
    if (movingPiece.type === 'p' && Math.abs(tr - fr) === 2) {
      nextEnPassant = [(fr + tr) / 2, fc];
    }

    const capturedByWhite = [...state.capturedByWhite];
    const capturedByBlack = [...state.capturedByBlack];
    if (capturedPiece) {
      if (state.turn === 'w') capturedByWhite.push(capturedPiece.type);
      else capturedByBlack.push(capturedPiece.type);
    }

    const nextHalfmove =
      movingPiece.type === 'p' || capturedPiece ? 0 : state.halfmoveClock + 1;
    const nextFullmove = state.turn === 'b' ? state.fullmoveNumber + 1 : state.fullmoveNumber;

    const oppLegal = generateLegalMoves(nextBoard, nextTurn, nextCastling, nextEnPassant);
    const oppInCheck = isKingInCheck(nextBoard, nextTurn);

    const hash = positionHash(nextBoard, nextTurn, nextCastling, nextEnPassant);
    const nextCounts = { ...state.positionCounts, [hash]: (state.positionCounts[hash] || 0) + 1 };

    const isCheckmate = oppLegal.length === 0 && oppInCheck;
    const isStalemate = oppLegal.length === 0 && !oppInCheck;
    const isFiftyMove = nextHalfmove >= 100;
    const isThreefold = nextCounts[hash] >= 3;
    const isInsufficient = hasInsufficientMaterial(nextBoard);
    const isDraw = !isCheckmate && (isStalemate || isFiftyMove || isThreefold || isInsufficient);
    const finished = isCheckmate || isDraw;

    const scores: [number, number] = [
      capturedByWhite.reduce((s, t) => s + PIECE_VALUE[t], 0),
      capturedByBlack.reduce((s, t) => s + PIECE_VALUE[t], 0)
    ];

    const san = toAlgebraic(
      movingPiece,
      chosen,
      Boolean(capturedPiece),
      chosen.isPromotion ? promo : undefined,
      oppInCheck,
      isCheckmate
    );

    const eventText = isCheckmate
      ? `Checkmate (${san})!`
      : isStalemate
        ? 'Stalemate — Draw!'
        : isThreefold
          ? 'Threefold repetition — Draw!'
          : isInsufficient
            ? 'Insufficient material — Draw!'
            : isFiftyMove
              ? '50-move rule — Draw!'
              : oppInCheck
                ? `Check! (${san})`
                : undefined;

    return {
      state: {
        board: nextBoard,
        turn: nextTurn,
        castling: nextCastling,
        enPassant: nextEnPassant,
        halfmoveClock: nextHalfmove,
        fullmoveNumber: nextFullmove,
        inCheck: oppInCheck,
        legalMoves: finished ? [] : oppLegal,
        capturedByWhite,
        capturedByBlack,
        moveHistory: [...state.moveHistory, san],
        lastMove: { from: [fr, fc], to: [tr, tc] },
        positionCounts: nextCounts,
        scores
      },
      nextTurnIndex,
      scores,
      finished,
      winnerIndex: isCheckmate ? playerIndex : null,
      isDraw,
      eventText
    };
  },
  sanitizeForPlayer(state) {
    // Strip heavy positionCounts map to keep socket payloads compact
    return {
      ...state,
      positionCounts: undefined
    };
  }
};

