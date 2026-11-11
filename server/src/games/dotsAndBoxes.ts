import { asInt, asRecord, InvalidMoveError, type GameEngine, type MoveResult } from './engine.js';

export interface DotsAndBoxesState {
  dots: number; // 5 -> 4x4 boxes
  hLines: boolean[][]; // [5][4]
  vLines: boolean[][]; // [4][5]
  boxes: (0 | 1 | null)[][]; // [4][4]
  scores: [number, number];
  lastLine: { type: 'h' | 'v'; r: number; c: number; player: 0 | 1 } | null;
}

const DOTS = 5;
const BOX_COUNT = DOTS - 1; // 4

export const dotsAndBoxesEngine: GameEngine<DotsAndBoxesState> = {
  id: 'dots_and_boxes',
  createInitialState(): DotsAndBoxesState {
    return {
      dots: DOTS,
      hLines: Array.from({ length: DOTS }, () => Array(BOX_COUNT).fill(false)),
      vLines: Array.from({ length: BOX_COUNT }, () => Array(DOTS).fill(false)),
      boxes: Array.from({ length: BOX_COUNT }, () => Array(BOX_COUNT).fill(null)),
      scores: [0, 0],
      lastLine: null
    };
  },
  applyMove(state, playerIndex, currentTurnIndex, payload): MoveResult<DotsAndBoxesState> {
    if (playerIndex !== currentTurnIndex) {
      throw new InvalidMoveError('Not your turn');
    }
    const data = asRecord(payload);
    const type = data.type;
    if (type !== 'h' && type !== 'v') {
      throw new InvalidMoveError('Line type must be h or v');
    }

    const hLines = state.hLines.map((r) => [...r]);
    const vLines = state.vLines.map((r) => [...r]);
    const boxes = state.boxes.map((r) => [...r]);
    const scores: [number, number] = [...state.scores] as [number, number];

    let r: number;
    let c: number;
    if (type === 'h') {
      r = asInt(data.r, 'row', 0, DOTS - 1);
      c = asInt(data.c, 'col', 0, BOX_COUNT - 1);
      if (hLines[r][c]) throw new InvalidMoveError('Line already drawn');
      hLines[r][c] = true;
    } else {
      r = asInt(data.r, 'row', 0, BOX_COUNT - 1);
      c = asInt(data.c, 'col', 0, DOTS - 1);
      if (vLines[r][c]) throw new InvalidMoveError('Line already drawn');
      vLines[r][c] = true;
    }

    let claimed = 0;
    for (let br = 0; br < BOX_COUNT; br++) {
      for (let bc = 0; bc < BOX_COUNT; bc++) {
        if (
          boxes[br][bc] === null &&
          hLines[br][bc] &&
          hLines[br + 1][bc] &&
          vLines[br][bc] &&
          vLines[br][bc + 1]
        ) {
          boxes[br][bc] = playerIndex;
          claimed++;
        }
      }
    }

    scores[playerIndex] += claimed;
    const totalBoxes = scores[0] + scores[1];
    const finished = totalBoxes === BOX_COUNT * BOX_COUNT;
    const winnerIndex = finished
      ? scores[0] > scores[1]
        ? 0
        : scores[1] > scores[0]
          ? 1
          : null
      : null;

    return {
      state: {
        ...state,
        hLines,
        vLines,
        boxes,
        scores,
        lastLine: { type, r, c, player: playerIndex }
      },
      nextTurnIndex: claimed > 0 && !finished ? playerIndex : playerIndex === 0 ? 1 : 0,
      scores,
      finished,
      winnerIndex,
      isDraw: finished && winnerIndex === null,
      eventText: claimed > 0 ? `Claimed ${claimed} box${claimed > 1 ? 'es' : ''} — bonus turn!` : undefined
    };
  },
  sanitizeForPlayer(state) {
    return state;
  }
};

