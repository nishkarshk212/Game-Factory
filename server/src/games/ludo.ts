import crypto from 'node:crypto';
import { asInt, asRecord, InvalidMoveError, type GameEngine, type MoveResult } from './engine.js';

export interface LudoState {
  // Each player has 4 tokens. Progress:
  // -1 = home yard, 0..50 = main loop steps from player's start square, 51..55 = home column, 56 = home goal
  tokens: [number[], number[]];
  phase: 'roll' | 'move';
  diceValue: number | null;
  consecutiveSixes: number;
  legalTokenIndices: number[];
  scores: [number, number]; // tokens finished + progress indicator
  lastEvent: string | null;
}

const START_OFFSETS: [number, number] = [0, 26];
const SAFE_GLOBAL_CELLS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

export function toGlobalTrackIndex(player: 0 | 1, step: number): number | null {
  if (step < 0 || step > 50) return null;
  return (START_OFFSETS[player] + step) % 52;
}

function getLegalTokens(tokens: number[], roll: number): number[] {
  const legal: number[] = [];
  for (let i = 0; i < 4; i++) {
    const pos = tokens[i];
    if (pos === -1) {
      if (roll === 6) legal.push(i);
    } else if (pos < 56) {
      if (pos + roll <= 56) legal.push(i);
    }
  }
  return legal;
}

function calcLudoScores(tokens: [number[], number[]]): [number, number] {
  const scoreFor = (arr: number[]) =>
    arr.reduce((sum, pos) => sum + (pos === -1 ? 0 : pos === 56 ? 10 : Math.floor((pos / 56) * 8) + 1), 0);
  return [scoreFor(tokens[0]), scoreFor(tokens[1])];
}

export const ludoEngine: GameEngine<LudoState> = {
  id: 'ludo',
  createInitialState(): LudoState {
    return {
      tokens: [
        [-1, -1, -1, -1],
        [-1, -1, -1, -1]
      ],
      phase: 'roll',
      diceValue: null,
      consecutiveSixes: 0,
      legalTokenIndices: [],
      scores: [0, 0],
      lastEvent: null
    };
  },
  applyMove(state, playerIndex, currentTurnIndex, payload): MoveResult<LudoState> {
    if (playerIndex !== currentTurnIndex) {
      throw new InvalidMoveError('Not your turn');
    }
    const data = asRecord(payload);
    const action = data.action;
    const oppIndex: 0 | 1 = playerIndex === 0 ? 1 : 0;

    if (action === 'roll') {
      if (state.phase !== 'roll') {
        throw new InvalidMoveError('Select a token to move first');
      }
      const roll = crypto.randomInt(1, 7);
      const nextSixes = roll === 6 ? state.consecutiveSixes + 1 : 0;
      if (nextSixes >= 3) {
        return {
          state: {
            ...state,
            phase: 'roll',
            diceValue: roll,
            consecutiveSixes: 0,
            legalTokenIndices: [],
            lastEvent: 'Rolled three 6s in a row — turn forfeited!'
          },
          nextTurnIndex: oppIndex,
          scores: state.scores,
          finished: false,
          winnerIndex: null,
          isDraw: false,
          eventText: 'Three consecutive 6s! Turn passes.'
        };
      }

      const legal = getLegalTokens(state.tokens[playerIndex], roll);
      if (legal.length === 0) {
        return {
          state: {
            ...state,
            phase: 'roll',
            diceValue: roll,
            consecutiveSixes: 0,
            legalTokenIndices: [],
            lastEvent: `Rolled ${roll} — no legal token moves`
          },
          nextTurnIndex: oppIndex,
          scores: state.scores,
          finished: false,
          winnerIndex: null,
          isDraw: false,
          eventText: `Rolled ${roll} (no legal moves)`
        };
      }

      return {
        state: {
          ...state,
          phase: 'move',
          diceValue: roll,
          consecutiveSixes: nextSixes,
          legalTokenIndices: legal,
          lastEvent: `Rolled ${roll} — pick a highlighted token`
        },
        nextTurnIndex: playerIndex,
        scores: state.scores,
        finished: false,
        winnerIndex: null,
        isDraw: false
      };
    }

    if (action === 'move') {
      if (state.phase !== 'move' || state.diceValue === null) {
        throw new InvalidMoveError('Roll the dice first');
      }
      const tokenIndex = asInt(data.tokenIndex, 'tokenIndex', 0, 3);
      if (!state.legalTokenIndices.includes(tokenIndex)) {
        throw new InvalidMoveError('Selected token cannot make this move');
      }

      const nextTokens: [number[], number[]] = [
        [...state.tokens[0]],
        [...state.tokens[1]]
      ];
      const curPos = nextTokens[playerIndex][tokenIndex];
      const roll = state.diceValue;
      const targetPos = curPos === -1 ? 0 : curPos + roll;
      nextTokens[playerIndex][tokenIndex] = targetPos;

      let captured = false;
      const globalCell = toGlobalTrackIndex(playerIndex, targetPos);
      if (globalCell !== null && !SAFE_GLOBAL_CELLS.has(globalCell)) {
        for (let oi = 0; oi < 4; oi++) {
          const oppGlobal = toGlobalTrackIndex(oppIndex, nextTokens[oppIndex][oi]);
          if (oppGlobal === globalCell) {
            nextTokens[oppIndex][oi] = -1;
            captured = true;
          }
        }
      }

      const reachedGoal = targetPos === 56;
      const allHome = nextTokens[playerIndex].every((p) => p === 56);
      const nextScores = calcLudoScores(nextTokens);
      const bonusTurn = !allHome && (roll === 6 || captured || reachedGoal);

      const evt = captured
        ? 'Captured opponent token! Bonus roll!'
        : reachedGoal
          ? 'Token reached Home! Bonus roll!'
          : roll === 6
            ? 'Rolled 6 — Bonus roll!'
            : `Moved token ${roll} spaces`;

      return {
        state: {
          tokens: nextTokens,
          phase: 'roll',
          diceValue: roll,
          consecutiveSixes: bonusTurn ? state.consecutiveSixes : 0,
          legalTokenIndices: [],
          scores: nextScores,
          lastEvent: evt
        },
        nextTurnIndex: bonusTurn ? playerIndex : oppIndex,
        scores: nextScores,
        finished: allHome,
        winnerIndex: allHome ? playerIndex : null,
        isDraw: false,
        eventText: allHome ? 'All 4 tokens home — Ludo Victory!' : evt
      };
    }

    throw new InvalidMoveError('Invalid Ludo action');
  },
  sanitizeForPlayer(state) {
    return state;
  }
};

