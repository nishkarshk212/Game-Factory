import { asNum, asRecord, InvalidMoveError, type GameEngine, type MoveResult } from './engine.js';

export type CarromCoinType = 'white' | 'black' | 'queen';

export interface CarromCoin {
  id: number;
  type: CarromCoinType;
  x: number;
  y: number;
  pocketed: boolean;
}

export interface CarromFrame {
  striker: { x: number; y: number; visible: boolean };
  coins: { id: number; x: number; y: number; pocketed: boolean }[];
}

export interface CarromState {
  coins: CarromCoin[];
  queenOwner: 0 | 1 | null;
  pendingQueenBy: 0 | 1 | null;
  scores: [number, number];
  lastShot: {
    shooter: 0 | 1;
    strikerStartX: number;
    angle: number;
    power: number;
    pocketed: CarromCoinType[];
    foul: boolean;
    frames: CarromFrame[];
  } | null;
  lastEvent: string | null;
}

const BOARD_MIN = 62;
const BOARD_MAX = 738;
const COIN_R = 16;
const STRIKER_R = 22;
const POCKET_R = 28;
const POCKETS: [number, number][] = [
  [86, 86],
  [714, 86],
  [86, 714],
  [714, 714]
];

function createInitialCoins(): CarromCoin[] {
  const coins: CarromCoin[] = [{ id: 0, type: 'queen', x: 400, y: 400, pocketed: false }];
  let id = 1;
  let whiteCount = 0;
  let blackCount = 0;

  // Inner hexagon (6 coins)
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const type: CarromCoinType = i % 2 === 0 ? 'white' : 'black';
    if (type === 'white') whiteCount++;
    else blackCount++;
    coins.push({
      id: id++,
      type,
      x: 400 + Math.cos(a) * 35,
      y: 400 + Math.sin(a) * 35,
      pocketed: false
    });
  }

  // Outer ring (12 coins) -> 6 white, 6 black
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6 + Math.PI / 12;
    let type: CarromCoinType = i % 2 === 0 ? 'white' : 'black';
    if (type === 'white' && whiteCount >= 9) type = 'black';
    if (type === 'black' && blackCount >= 9) type = 'white';
    if (type === 'white') whiteCount++;
    else blackCount++;
    coins.push({
      id: id++,
      type,
      x: 400 + Math.cos(a) * 68,
      y: 400 + Math.sin(a) * 68,
      pocketed: false
    });
  }
  return coins;
}

function findFreeSpotNearCenter(coins: CarromCoin[], radius: number): [number, number] {
  for (let ring = 0; ring <= 140; ring += 18) {
    const steps = ring === 0 ? 1 : 12;
    for (let i = 0; i < steps; i++) {
      const a = (i * Math.PI * 2) / steps;
      const cx = 400 + Math.cos(a) * ring;
      const cy = 400 + Math.sin(a) * ring;
      const collides = coins.some(
        (c) => !c.pocketed && Math.hypot(c.x - cx, c.y - cy) < COIN_R + radius + 2
      );
      if (!collides) return [cx, cy];
    }
  }
  return [400, 400];
}

function resolveBaselineStrikerPos(coins: CarromCoin[], desiredX: number, y: number): number {
  const clamped = Math.max(180, Math.min(620, desiredX));
  const overlaps = (x: number) =>
    coins.some((c) => !c.pocketed && Math.hypot(c.x - x, c.y - y) < COIN_R + STRIKER_R + 1);
  if (!overlaps(clamped)) return clamped;
  for (let offset = 10; offset <= 240; offset += 10) {
    if (clamped + offset <= 620 && !overlaps(clamped + offset)) return clamped + offset;
    if (clamped - offset >= 180 && !overlaps(clamped - offset)) return clamped - offset;
  }
  return clamped;
}

function calcCarromScores(coins: CarromCoin[], queenOwner: 0 | 1 | null): [number, number] {
  const wPocketed = coins.filter((c) => c.type === 'white' && c.pocketed).length;
  const bPocketed = coins.filter((c) => c.type === 'black' && c.pocketed).length;
  return [
    wPocketed + (queenOwner === 0 ? 3 : 0),
    bPocketed + (queenOwner === 1 ? 3 : 0)
  ];
}

export const carromEngine: GameEngine<CarromState> = {
  id: 'carrom',
  createInitialState(): CarromState {
    return {
      coins: createInitialCoins(),
      queenOwner: null,
      pendingQueenBy: null,
      scores: [0, 0],
      lastShot: null,
      lastEvent: null
    };
  },
  applyMove(state, playerIndex, currentTurnIndex, payload): MoveResult<CarromState> {
    if (playerIndex !== currentTurnIndex) {
      throw new InvalidMoveError('Not your turn');
    }
    const data = asRecord(payload);
    const rawX = asNum(data.strikerX, 'strikerX', 150, 650);
    const angle = asNum(data.angle, 'angle', -Math.PI * 2, Math.PI * 2);
    const power = asNum(data.power, 'power', 0.12, 1.0);

    const baselineY = playerIndex === 0 ? 665 : 135;
    const strikerX = resolveBaselineStrikerPos(state.coins, rawX, baselineY);

    // Simulation entities
    interface Body {
      id: number; // -1 for striker
      type: CarromCoinType | 'striker';
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      mass: number;
      pocketed: boolean;
    }

    const speed = 8 + power * 24;
    const striker: Body = {
      id: -1,
      type: 'striker',
      x: strikerX,
      y: baselineY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: STRIKER_R,
      mass: 2.2,
      pocketed: false
    };

    const coinBodies: Body[] = state.coins.map((c) => ({
      id: c.id,
      type: c.type,
      x: c.x,
      y: c.y,
      vx: 0,
      vy: 0,
      r: COIN_R,
      mass: 1.0,
      pocketed: c.pocketed
    }));

    const bodies = [striker, ...coinBodies];
    const frames: CarromFrame[] = [];
    const pocketedOrder: CarromCoinType[] = [];
    let strikerPocketed = false;

    const MAX_STEPS = 220;
    for (let step = 0; step < MAX_STEPS; step++) {
      // Substep movement
      for (const b of bodies) {
        if (b.pocketed) continue;
        b.x += b.vx;
        b.y += b.vy;
        b.vx *= 0.982;
        b.vy *= 0.982;
        if (Math.hypot(b.vx, b.vy) < 0.08) {
          b.vx = 0;
          b.vy = 0;
        }

        // Wall rebounds
        if (b.x - b.r < BOARD_MIN) {
          b.x = BOARD_MIN + b.r;
          b.vx = Math.abs(b.vx) * 0.84;
        } else if (b.x + b.r > BOARD_MAX) {
          b.x = BOARD_MAX - b.r;
          b.vx = -Math.abs(b.vx) * 0.84;
        }
        if (b.y - b.r < BOARD_MIN) {
          b.y = BOARD_MIN + b.r;
          b.vy = Math.abs(b.vy) * 0.84;
        } else if (b.y + b.r > BOARD_MAX) {
          b.y = BOARD_MAX - b.r;
          b.vy = -Math.abs(b.vy) * 0.84;
        }

        // Pocket check
        for (const [px, py] of POCKETS) {
          if (Math.hypot(b.x - px, b.y - py) < POCKET_R) {
            b.pocketed = true;
            b.vx = 0;
            b.vy = 0;
            if (b.type === 'striker') {
              strikerPocketed = true;
            } else {
              pocketedOrder.push(b.type);
            }
            break;
          }
        }
      }

      // Pairwise elastic collisions
      for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i];
        if (a.pocketed) continue;
        for (let j = i + 1; j < bodies.length; j++) {
          const b = bodies[j];
          if (b.pocketed) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          const minDist = a.r + b.r;
          if (dist > 0 && dist < minDist) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;
            const totalMass = a.mass + b.mass;
            a.x -= nx * overlap * (b.mass / totalMass);
            a.y -= ny * overlap * (b.mass / totalMass);
            b.x += nx * overlap * (a.mass / totalMass);
            b.y += ny * overlap * (a.mass / totalMass);

            const rvx = b.vx - a.vx;
            const rvy = b.vy - a.vy;
            const velAlongNormal = rvx * nx + rvy * ny;
            if (velAlongNormal < 0) {
              const restitution = 0.88;
              const jImpulse = (-(1 + restitution) * velAlongNormal) / (1 / a.mass + 1 / b.mass);
              a.vx -= (jImpulse / a.mass) * nx;
              a.vy -= (jImpulse / a.mass) * ny;
              b.vx += (jImpulse / b.mass) * nx;
              b.vy += (jImpulse / b.mass) * ny;
            }
          }
        }
      }

      if (step % 4 === 0 || step === MAX_STEPS - 1) {
        frames.push({
          striker: { x: Math.round(striker.x), y: Math.round(striker.y), visible: !striker.pocketed },
          coins: coinBodies.map((c) => ({
            id: c.id,
            x: Math.round(c.x),
            y: Math.round(c.y),
            pocketed: c.pocketed
          }))
        });
      }

      if (bodies.every((b) => b.pocketed || (b.vx === 0 && b.vy === 0))) {
        break;
      }
    }

    const nextCoins: CarromCoin[] = coinBodies.map((c) => ({
      id: c.id,
      type: c.type as CarromCoinType,
      x: Math.round(c.x * 10) / 10,
      y: Math.round(c.y * 10) / 10,
      pocketed: c.pocketed
    }));

    const myColor: CarromCoinType = playerIndex === 0 ? 'white' : 'black';
    const oppIndex: 0 | 1 = playerIndex === 0 ? 1 : 0;
    const pocketedOwn = pocketedOrder.filter((t) => t === myColor).length;
    const pocketedQueen = pocketedOrder.includes('queen');

    let nextQueenOwner = state.queenOwner;
    let nextPendingQueen = state.pendingQueenBy;
    let eventMsg = '';

    if (strikerPocketed) {
      // Return one of shooter's pocketed coins to center if available
      const toReturn = nextCoins.find((c) => c.type === myColor && c.pocketed);
      if (toReturn) {
        const [rx, ry] = findFreeSpotNearCenter(nextCoins, COIN_R);
        toReturn.pocketed = false;
        toReturn.x = rx;
        toReturn.y = ry;
      }
      if (pocketedQueen || nextPendingQueen === playerIndex) {
        const queen = nextCoins.find((c) => c.type === 'queen')!;
        const [qx, qy] = findFreeSpotNearCenter(nextCoins, COIN_R);
        queen.pocketed = false;
        queen.x = qx;
        queen.y = qy;
        nextPendingQueen = null;
      }
      eventMsg = 'Striker Foul! Penalty coin returned.';
    } else {
      if (nextPendingQueen === playerIndex) {
        if (pocketedOwn > 0) {
          nextQueenOwner = playerIndex;
          nextPendingQueen = null;
          eventMsg = 'Queen covered (+3 pts)!';
        } else {
          const queen = nextCoins.find((c) => c.type === 'queen')!;
          const [qx, qy] = findFreeSpotNearCenter(nextCoins, COIN_R);
          queen.pocketed = false;
          queen.x = qx;
          queen.y = qy;
          nextPendingQueen = null;
          eventMsg = 'Queen not covered — returned to center.';
        }
      } else if (pocketedQueen) {
        if (pocketedOwn > 0) {
          nextQueenOwner = playerIndex;
          nextPendingQueen = null;
          eventMsg = 'Queen pocketed & covered (+3 pts)!';
        } else {
          nextPendingQueen = playerIndex;
          eventMsg = 'Queen pocketed! Pocket your coin next shot to cover it.';
        }
      } else if (pocketedOwn > 0) {
        eventMsg = `Pocketed ${pocketedOwn} ${myColor} coin${pocketedOwn > 1 ? 's' : ''}! Shoot again.`;
      } else if (pocketedOrder.length > 0) {
        eventMsg = 'Pocketed opponent coin — turn passes.';
      } else {
        eventMsg = 'No coin pocketed.';
      }
    }

    const whiteRemaining = nextCoins.filter((c) => c.type === 'white' && !c.pocketed).length;
    const blackRemaining = nextCoins.filter((c) => c.type === 'black' && !c.pocketed).length;
    const queenDone = nextQueenOwner !== null || !nextCoins.find((c) => c.type === 'queen')?.pocketed;

    // If a player cleared all their coins while pending queen cover, auto-grant queen if covered or check winner
    let winnerIndex: 0 | 1 | null = null;
    if (whiteRemaining === 0 && (queenDone || nextPendingQueen === 0)) {
      if (nextPendingQueen === 0) nextQueenOwner = 0;
      winnerIndex = 0;
    } else if (blackRemaining === 0 && (queenDone || nextPendingQueen === 1)) {
      if (nextPendingQueen === 1) nextQueenOwner = 1;
      winnerIndex = 1;
    }

    const finished = winnerIndex !== null;
    const scores = calcCarromScores(nextCoins, nextQueenOwner);
    const keepTurn =
      !finished &&
      !strikerPocketed &&
      (pocketedOwn > 0 || (pocketedQueen && nextPendingQueen === playerIndex));

    return {
      state: {
        coins: nextCoins,
        queenOwner: nextQueenOwner,
        pendingQueenBy: finished ? null : nextPendingQueen,
        scores,
        lastShot: {
          shooter: playerIndex,
          strikerStartX: strikerX,
          angle,
          power,
          pocketed: pocketedOrder,
          foul: strikerPocketed,
          frames
        },
        lastEvent: eventMsg
      },
      nextTurnIndex: keepTurn ? playerIndex : oppIndex,
      scores,
      finished,
      winnerIndex,
      isDraw: false,
      eventText: finished ? 'Board cleared — Carrom Victory!' : eventMsg
    };
  },
  sanitizeForPlayer(state) {
    return state;
  }
};

