import { asRecord, InvalidMoveError, type GameEngine, type MoveResult } from './engine.js';

export type RpsChoice = 'rock' | 'paper' | 'scissors';

export interface RpsRoundRecord {
  round: number;
  choices: [RpsChoice, RpsChoice];
  winner: 0 | 1 | 'draw';
}

export interface RpsState {
  round: number;
  targetWins: number;
  scores: [number, number];
  pendingChoices: [RpsChoice | null, RpsChoice | null];
  history: RpsRoundRecord[];
}

const VALID_CHOICES = new Set<RpsChoice>(['rock', 'paper', 'scissors']);

function resolveRound(a: RpsChoice, b: RpsChoice): 0 | 1 | 'draw' {
  if (a === b) return 'draw';
  if (
    (a === 'rock' && b === 'scissors') ||
    (a === 'paper' && b === 'rock') ||
    (a === 'scissors' && b === 'paper')
  ) {
    return 0;
  }
  return 1;
}

export const rpsEngine: GameEngine<RpsState> = {
  id: 'rps',
  createInitialState(): RpsState {
    return {
      round: 1,
      targetWins: 3,
      scores: [0, 0],
      pendingChoices: [null, null],
      history: []
    };
  },
  canPlayerAct(state, playerIndex): boolean {
    return state.pendingChoices[playerIndex] === null;
  },
  applyMove(state, playerIndex, _currentTurnIndex, payload): MoveResult<RpsState> {
    const data = asRecord(payload);
    const choice = data.choice as RpsChoice;
    if (!VALID_CHOICES.has(choice)) {
      throw new InvalidMoveError('Choice must be rock, paper, or scissors');
    }
    if (state.pendingChoices[playerIndex] !== null) {
      throw new InvalidMoveError('You already locked your pick for this round');
    }

    const nextPending: [RpsChoice | null, RpsChoice | null] = [...state.pendingChoices] as [
      RpsChoice | null,
      RpsChoice | null
    ];
    nextPending[playerIndex] = choice;

    const otherIndex: 0 | 1 = playerIndex === 0 ? 1 : 0;
    if (nextPending[otherIndex] === null) {
      return {
        state: {
          ...state,
          pendingChoices: nextPending
        },
        nextTurnIndex: otherIndex,
        scores: state.scores,
        finished: false,
        winnerIndex: null,
        isDraw: false,
        eventText: 'Choice locked — waiting for opponent'
      };
    }

    const c0 = nextPending[0]!;
    const c1 = nextPending[1]!;
    const winner = resolveRound(c0, c1);
    const nextScores: [number, number] = [...state.scores] as [number, number];
    if (winner !== 'draw') {
      nextScores[winner] += 1;
    }

    const record: RpsRoundRecord = {
      round: state.round,
      choices: [c0, c1],
      winner
    };

    const matchFinished = nextScores[0] >= state.targetWins || nextScores[1] >= state.targetWins;
    const matchWinner: 0 | 1 | null = matchFinished
      ? nextScores[0] >= state.targetWins
        ? 0
        : 1
      : null;

    return {
      state: {
        ...state,
        round: matchFinished ? state.round : state.round + 1,
        scores: nextScores,
        pendingChoices: [null, null],
        history: [...state.history, record]
      },
      nextTurnIndex: 0,
      scores: nextScores,
      finished: matchFinished,
      winnerIndex: matchWinner,
      isDraw: false,
      eventText:
        winner === 'draw'
          ? `Round ${state.round}: Tie (${c0} vs ${c1})!`
          : `Round ${state.round}: ${c0} vs ${c1}`
    };
  },
  sanitizeForPlayer(state, playerIndex) {
    const oppIndex: 0 | 1 = playerIndex === 0 ? 1 : 0;
    return {
      ...state,
      myCommitted: state.pendingChoices[playerIndex] !== null,
      myChoice: state.pendingChoices[playerIndex],
      opponentCommitted: state.pendingChoices[oppIndex] !== null,
      pendingChoices: undefined
    };
  }
};

