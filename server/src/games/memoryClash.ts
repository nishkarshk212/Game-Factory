import crypto from 'node:crypto';
import { asInt, asRecord, InvalidMoveError, type GameEngine, type MoveResult } from './engine.js';

export interface MemoryCard {
  index: number;
  symbol: string;
  matchedBy: 0 | 1 | null;
}

export interface MemoryClashState {
  cards: MemoryCard[];
  revealedIndices: number[]; // currently flipped in active turn (0, 1, or 2 cards during reveal)
  lastReveal: { indices: [number, number]; symbols: [string, string]; matched: boolean; player: 0 | 1 } | null;
  scores: [number, number];
}

const SYMBOLS = ['⚡', '🚀', '💎', '🔥', '🎯', '👑', '🛸', '🕹️', '⚔️', '🌌', '🎲', '🏆'];

export const memoryClashEngine: GameEngine<MemoryClashState> = {
  id: 'memory_clash',
  createInitialState(): MemoryClashState {
    const pool = [...SYMBOLS, ...SYMBOLS];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return {
      cards: pool.map((symbol, index) => ({ index, symbol, matchedBy: null })),
      revealedIndices: [],
      lastReveal: null,
      scores: [0, 0]
    };
  },
  applyMove(state, playerIndex, currentTurnIndex, payload): MoveResult<MemoryClashState> {
    if (playerIndex !== currentTurnIndex) {
      throw new InvalidMoveError('Not your turn');
    }
    const data = asRecord(payload);
    const cardIndex = asInt(data.index, 'card index', 0, state.cards.length - 1);
    const card = state.cards[cardIndex];
    if (card.matchedBy !== null) {
      throw new InvalidMoveError('Card is already matched');
    }

    // If 1 card is already flipped this turn, flip second; otherwise start fresh pair
    const currentlyOpen = state.revealedIndices.length === 1 ? [...state.revealedIndices] : [];
    if (currentlyOpen.includes(cardIndex)) {
      throw new InvalidMoveError('Cannot flip the same card twice');
    }

    if (currentlyOpen.length === 0) {
      return {
        state: {
          ...state,
          revealedIndices: [cardIndex],
          lastReveal: null
        },
        nextTurnIndex: playerIndex,
        scores: state.scores,
        finished: false,
        winnerIndex: null,
        isDraw: false
      };
    }

    const firstIdx = currentlyOpen[0];
    const firstCard = state.cards[firstIdx];
    const isMatch = firstCard.symbol === card.symbol;

    const nextCards = state.cards.map((c, idx) =>
      isMatch && (idx === firstIdx || idx === cardIndex) ? { ...c, matchedBy: playerIndex } : c
    );
    const nextScores: [number, number] = [...state.scores] as [number, number];
    if (isMatch) {
      nextScores[playerIndex] += 1;
    }

    const totalMatched = nextScores[0] + nextScores[1];
    const finished = totalMatched === SYMBOLS.length;
    const winnerIndex = finished
      ? nextScores[0] > nextScores[1]
        ? 0
        : nextScores[1] > nextScores[0]
          ? 1
          : null
      : null;

    return {
      state: {
        cards: nextCards,
        revealedIndices: [],
        lastReveal: {
          indices: [firstIdx, cardIndex],
          symbols: [firstCard.symbol, card.symbol],
          matched: isMatch,
          player: playerIndex
        },
        scores: nextScores
      },
      nextTurnIndex: isMatch && !finished ? playerIndex : playerIndex === 0 ? 1 : 0,
      scores: nextScores,
      finished,
      winnerIndex,
      isDraw: finished && winnerIndex === null,
      eventText: isMatch ? `Pair matched (${card.symbol}) — bonus turn!` : 'Mismatch — turn passes'
    };
  },
  sanitizeForPlayer(state) {
    return {
      scores: state.scores,
      revealedIndices: state.revealedIndices,
      lastReveal: state.lastReveal,
      cards: state.cards.map((c) => {
        const visible = c.matchedBy !== null || state.revealedIndices.includes(c.index);
        return {
          index: c.index,
          matchedBy: c.matchedBy,
          symbol: visible ? c.symbol : null
        };
      })
    };
  }
};

