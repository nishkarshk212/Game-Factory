import crypto from 'node:crypto';
import { asInt, asRecord, InvalidMoveError, type GameEngine, type MoveResult } from './engine.js';

export interface BattleshipShip {
  id: string;
  name: string;
  size: number;
  cells: [number, number][];
  hits: number;
}

export interface BattleshipShot {
  r: number;
  c: number;
  hit: boolean;
  sunkShipName?: string;
}

export interface BattleshipPlayerBoard {
  ready: boolean;
  ships: BattleshipShip[];
  incomingShots: BattleshipShot[];
}

export interface BattleshipState {
  phase: 'setup' | 'battle';
  boards: [BattleshipPlayerBoard, BattleshipPlayerBoard];
  scores: [number, number]; // enemy ships sunk (0..5)
  lastShot: { shooter: 0 | 1; r: number; c: number; hit: boolean; sunkShipName?: string } | null;
}

const FLEET_SPEC = [
  { id: 'carrier', name: 'Carrier', size: 5 },
  { id: 'battleship', name: 'Battleship', size: 4 },
  { id: 'cruiser', name: 'Cruiser', size: 3 },
  { id: 'submarine', name: 'Submarine', size: 3 },
  { id: 'destroyer', name: 'Destroyer', size: 2 }
];

function generateRandomFleet(): BattleshipShip[] {
  const occupied = new Set<string>();
  const ships: BattleshipShip[] = [];

  for (const spec of FLEET_SPEC) {
    let placed = false;
    for (let attempt = 0; attempt < 200; attempt++) {
      const horiz = crypto.randomInt(0, 2) === 0;
      const r = crypto.randomInt(0, horiz ? 10 : 10 - spec.size + 1);
      const c = crypto.randomInt(0, horiz ? 10 - spec.size + 1 : 10);
      const cells: [number, number][] = [];
      let conflict = false;
      for (let i = 0; i < spec.size; i++) {
        const cr = horiz ? r : r + i;
        const cc = horiz ? c + i : c;
        const key = `${cr},${cc}`;
        if (occupied.has(key)) {
          conflict = true;
          break;
        }
        cells.push([cr, cc]);
      }
      if (!conflict) {
        cells.forEach(([cr, cc]) => occupied.add(`${cr},${cc}`));
        ships.push({ id: spec.id, name: spec.name, size: spec.size, cells, hits: 0 });
        placed = true;
        break;
      }
    }
    if (!placed) throw new Error('Failed to generate Battleship fleet');
  }
  return ships;
}

function validateCustomFleet(rawShips: unknown): BattleshipShip[] {
  if (!Array.isArray(rawShips) || rawShips.length !== FLEET_SPEC.length) {
    throw new InvalidMoveError('Fleet must contain exactly 5 ships');
  }
  const occupied = new Set<string>();
  const ships: BattleshipShip[] = [];

  for (let idx = 0; idx < FLEET_SPEC.length; idx++) {
    const spec = FLEET_SPEC[idx];
    const item = asRecord(rawShips[idx]);
    const cellsRaw = item.cells;
    if (!Array.isArray(cellsRaw) || cellsRaw.length !== spec.size) {
      throw new InvalidMoveError(`${spec.name} must occupy ${spec.size} cells`);
    }
    const cells: [number, number][] = cellsRaw.map((pair) => {
      if (!Array.isArray(pair) || pair.length !== 2) throw new InvalidMoveError('Invalid ship cell');
      return [asInt(pair[0], 'row', 0, 9), asInt(pair[1], 'col', 0, 9)];
    });

    // Check contiguous straight line
    const sameRow = cells.every(([r]) => r === cells[0][0]);
    const sameCol = cells.every(([, c]) => c === cells[0][1]);
    if (!sameRow && !sameCol) {
      throw new InvalidMoveError(`${spec.name} must be placed straight horizontally or vertically`);
    }
    const coords = (sameRow ? cells.map(([, c]) => c) : cells.map(([r]) => r)).sort((a, b) => a - b);
    for (let i = 1; i < coords.length; i++) {
      if (coords[i] !== coords[i - 1] + 1) {
        throw new InvalidMoveError(`${spec.name} cells must be contiguous`);
      }
    }

    for (const [r, c] of cells) {
      const k = `${r},${c}`;
      if (occupied.has(k)) throw new InvalidMoveError('Ships cannot overlap');
      occupied.add(k);
    }

    ships.push({ id: spec.id, name: spec.name, size: spec.size, cells, hits: 0 });
  }
  return ships;
}

export const battleshipEngine: GameEngine<BattleshipState> = {
  id: 'battleship',
  createInitialState(): BattleshipState {
    return {
      phase: 'setup',
      boards: [
        { ready: false, ships: [], incomingShots: [] },
        { ready: false, ships: [], incomingShots: [] }
      ],
      scores: [0, 0],
      lastShot: null
    };
  },
  canPlayerAct(state, playerIndex, currentTurnIndex): boolean {
    if (state.phase === 'setup') {
      return !state.boards[playerIndex].ready;
    }
    return playerIndex === currentTurnIndex;
  },
  applyMove(state, playerIndex, currentTurnIndex, payload): MoveResult<BattleshipState> {
    const data = asRecord(payload);
    const action = data.action;

    if (state.phase === 'setup') {
      if (state.boards[playerIndex].ready) {
        throw new InvalidMoveError('Fleet already locked');
      }
      let ships: BattleshipShip[];
      if (action === 'randomFleet') {
        ships = generateRandomFleet();
      } else if (action === 'placeFleet') {
        ships = validateCustomFleet(data.ships);
      } else {
        throw new InvalidMoveError('Invalid setup action');
      }

      const nextBoards: [BattleshipPlayerBoard, BattleshipPlayerBoard] = [
        { ...state.boards[0] },
        { ...state.boards[1] }
      ];
      nextBoards[playerIndex] = { ready: true, ships, incomingShots: [] };
      const bothReady = nextBoards[0].ready && nextBoards[1].ready;

      return {
        state: {
          ...state,
          phase: bothReady ? 'battle' : 'setup',
          boards: nextBoards
        },
        nextTurnIndex: bothReady ? 0 : playerIndex === 0 ? 1 : 0,
        scores: state.scores,
        finished: false,
        winnerIndex: null,
        isDraw: false,
        eventText: bothReady ? 'Both fleets locked — Battle stations!' : 'Fleet locked! Waiting for opponent.'
      };
    }

    // Battle phase
    if (playerIndex !== currentTurnIndex) {
      throw new InvalidMoveError('Not your turn');
    }
    if (action !== 'fire') {
      throw new InvalidMoveError('Invalid battle action');
    }
    const r = asInt(data.row, 'row', 0, 9);
    const c = asInt(data.col, 'col', 0, 9);

    const oppIndex: 0 | 1 = playerIndex === 0 ? 1 : 0;
    const oppBoard = state.boards[oppIndex];
    if (oppBoard.incomingShots.some((s) => s.r === r && s.c === c)) {
      throw new InvalidMoveError('Coordinate already targeted');
    }

    const nextOppShips = oppBoard.ships.map((s) => ({
      ...s,
      cells: s.cells.map((pair) => [...pair] as [number, number])
    }));

    let hit = false;
    let sunkShipName: string | undefined;
    for (const ship of nextOppShips) {
      if (ship.cells.some(([sr, sc]) => sr === r && sc === c)) {
        hit = true;
        ship.hits += 1;
        if (ship.hits >= ship.size) {
          sunkShipName = ship.name;
        }
        break;
      }
    }

    const nextBoards: [BattleshipPlayerBoard, BattleshipPlayerBoard] = [
      { ...state.boards[0] },
      { ...state.boards[1] }
    ];
    nextBoards[oppIndex] = {
      ...oppBoard,
      ships: nextOppShips,
      incomingShots: [...oppBoard.incomingShots, { r, c, hit, sunkShipName }]
    };

    const nextScores: [number, number] = [...state.scores] as [number, number];
    nextScores[playerIndex] = nextOppShips.filter((s) => s.hits >= s.size).length;

    const finished = nextScores[playerIndex] === FLEET_SPEC.length;
    return {
      state: {
        phase: 'battle',
        boards: nextBoards,
        scores: nextScores,
        lastShot: { shooter: playerIndex, r, c, hit, sunkShipName }
      },
      nextTurnIndex: hit && !finished ? playerIndex : oppIndex,
      scores: nextScores,
      finished,
      winnerIndex: finished ? playerIndex : null,
      isDraw: false,
      eventText: sunkShipName
        ? `Direct hit! Sunk enemy ${sunkShipName}!`
        : hit
          ? 'Direct Hit — Fire again!'
          : 'Splash — Shot missed'
    };
  },
  sanitizeForPlayer(state, playerIndex) {
    const oppIndex: 0 | 1 = playerIndex === 0 ? 1 : 0;
    const myBoard = state.boards[playerIndex];
    const oppBoard = state.boards[oppIndex];
    return {
      phase: state.phase,
      scores: state.scores,
      lastShot: state.lastShot,
      myBoard: {
        ready: myBoard.ready,
        ships: myBoard.ships,
        incomingShots: myBoard.incomingShots
      },
      enemyBoard: {
        ready: oppBoard.ready,
        shotsFired: oppBoard.incomingShots,
        // Only reveal ships once sunk! Never leak live ship positions!
        sunkShips: oppBoard.ships.filter((s) => s.hits >= s.size)
      }
    };
  }
};

