import crypto from 'node:crypto';
import { asInt, asRecord, InvalidMoveError, type GameEngine, type MoveResult } from './engine.js';

export interface SudokuState {
  puzzle: number[][]; // 0 = empty, 1..9 = current value
  givens: boolean[][]; // true if initial clue
  owners: (0 | 1 | null)[][]; // who solved each cell
  solution: number[][]; // STRIPPED before sending to clients!
  scores: [number, number];
  strikes: [number, number];
  streaks: [number, number];
  lastMove: { r: number; c: number; val: number; correct: boolean; player: 0 | 1 } | null;
}

const BASE_GRID = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9]
];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function generateValidSolution(): number[][] {
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const digitMap = new Map<number, number>();
  for (let i = 0; i < 9; i++) digitMap.set(i + 1, digits[i]);

  const rowOrder: number[] = [];
  for (const band of shuffle([0, 1, 2])) {
    for (const offset of shuffle([0, 1, 2])) {
      rowOrder.push(band * 3 + offset);
    }
  }
  const colOrder: number[] = [];
  for (const stack of shuffle([0, 1, 2])) {
    for (const offset of shuffle([0, 1, 2])) {
      colOrder.push(stack * 3 + offset);
    }
  }

  return rowOrder.map((r) => colOrder.map((c) => digitMap.get(BASE_GRID[r][c])!));
}

function countSolutions(grid: number[][], limit = 2): number {
  let minOpts = 10;
  let target: [number, number] | null = null;
  let targetCandidates: number[] = [];

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] !== 0) continue;
      const used = new Set<number>();
      for (let i = 0; i < 9; i++) {
        if (grid[r][i]) used.add(grid[r][i]);
        if (grid[i][c]) used.add(grid[i][c]);
      }
      const br = Math.floor(r / 3) * 3;
      const bc = Math.floor(c / 3) * 3;
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          if (grid[br + dr][bc + dc]) used.add(grid[br + dr][bc + dc]);
        }
      }
      const cands: number[] = [];
      for (let d = 1; d <= 9; d++) if (!used.has(d)) cands.push(d);
      if (cands.length === 0) return 0;
      if (cands.length < minOpts) {
        minOpts = cands.length;
        target = [r, c];
        targetCandidates = cands;
      }
    }
  }

  if (!target) return 1;
  let total = 0;
  const [tr, tc] = target;
  for (const cand of targetCandidates) {
    grid[tr][tc] = cand;
    total += countSolutions(grid, limit);
    grid[tr][tc] = 0;
    if (total >= limit) return total;
  }
  return total;
}

function generateUniquePuzzle(): { puzzle: number[][]; solution: number[][] } {
  const solution = generateValidSolution();
  const puzzle = solution.map((r) => [...r]);
  const coords = shuffle(
    Array.from({ length: 81 }, (_, i) => [Math.floor(i / 9), i % 9] as [number, number])
  );

  let removed = 0;
  for (const [r, c] of coords) {
    if (removed >= 42) break;
    const backup = puzzle[r][c];
    puzzle[r][c] = 0;
    const copy = puzzle.map((row) => [...row]);
    if (countSolutions(copy, 2) !== 1) {
      puzzle[r][c] = backup;
    } else {
      removed++;
    }
  }
  return { puzzle, solution };
}

export const sudokuEngine: GameEngine<SudokuState> = {
  id: 'sudoku',
  createInitialState(): SudokuState {
    const { puzzle, solution } = generateUniquePuzzle();
    return {
      puzzle,
      givens: puzzle.map((row) => row.map((v) => v !== 0)),
      owners: Array.from({ length: 9 }, () => Array(9).fill(null)),
      solution,
      scores: [0, 0],
      strikes: [0, 0],
      streaks: [0, 0],
      lastMove: null
    };
  },
  applyMove(state, playerIndex, currentTurnIndex, payload): MoveResult<SudokuState> {
    if (playerIndex !== currentTurnIndex) {
      throw new InvalidMoveError('Not your turn');
    }
    const data = asRecord(payload);
    const r = asInt(data.r, 'row', 0, 8);
    const c = asInt(data.c, 'col', 0, 8);
    const value = asInt(data.value, 'digit', 1, 9);

    if (state.puzzle[r][c] !== 0) {
      throw new InvalidMoveError('Cell is already solved');
    }

    const correct = state.solution[r][c] === value;
    const nextPuzzle = state.puzzle.map((row) => [...row]);
    const nextOwners = state.owners.map((row) => [...row]);
    const nextScores: [number, number] = [...state.scores] as [number, number];
    const nextStrikes: [number, number] = [...state.strikes] as [number, number];
    const nextStreaks: [number, number] = [...state.streaks] as [number, number];

    const oppIndex: 0 | 1 = playerIndex === 0 ? 1 : 0;

    if (correct) {
      nextPuzzle[r][c] = value;
      nextOwners[r][c] = playerIndex;
      nextStreaks[playerIndex] += 1;
      const bonus = Math.min(10, (nextStreaks[playerIndex] - 1) * 2);
      nextScores[playerIndex] += 10 + bonus;
    } else {
      nextStreaks[playerIndex] = 0;
      nextStrikes[playerIndex] += 1;
      nextScores[playerIndex] = Math.max(0, nextScores[playerIndex] - 5);
    }

    const lostByStrikes = nextStrikes[playerIndex] >= 3;
    const allSolved = nextPuzzle.every((row) => row.every((v) => v !== 0));

    if (lostByStrikes) {
      return {
        state: {
          ...state,
          puzzle: nextPuzzle,
          owners: nextOwners,
          scores: nextScores,
          strikes: nextStrikes,
          streaks: nextStreaks,
          lastMove: { r, c, val: value, correct, player: playerIndex }
        },
        nextTurnIndex: oppIndex,
        scores: nextScores,
        finished: true,
        winnerIndex: oppIndex,
        isDraw: false,
        eventText: '3 Strikes! Opponent wins the Sudoku Duel.'
      };
    }

    if (allSolved) {
      const winnerIndex =
        nextScores[0] > nextScores[1] ? 0 : nextScores[1] > nextScores[0] ? 1 : null;
      return {
        state: {
          ...state,
          puzzle: nextPuzzle,
          owners: nextOwners,
          scores: nextScores,
          strikes: nextStrikes,
          streaks: nextStreaks,
          lastMove: { r, c, val: value, correct, player: playerIndex }
        },
        nextTurnIndex: oppIndex,
        scores: nextScores,
        finished: true,
        winnerIndex,
        isDraw: winnerIndex === null,
        eventText: 'Grid completed!'
      };
    }

    return {
      state: {
        ...state,
        puzzle: nextPuzzle,
        owners: nextOwners,
        scores: nextScores,
        strikes: nextStrikes,
        streaks: nextStreaks,
        lastMove: { r, c, val: value, correct, player: playerIndex }
      },
      nextTurnIndex: oppIndex,
      scores: nextScores,
      finished: false,
      winnerIndex: null,
      isDraw: false,
      eventText: correct ? `+${10 + Math.min(10, (nextStreaks[playerIndex] - 1) * 2)} pts!` : `Wrong digit! Strike ${nextStrikes[playerIndex]}/3`
    };
  },
  sanitizeForPlayer(state) {
    // NEVER send solution to clients!
    return {
      puzzle: state.puzzle,
      givens: state.givens,
      owners: state.owners,
      scores: state.scores,
      strikes: state.strikes,
      streaks: state.streaks,
      lastMove: state.lastMove
    };
  }
};

