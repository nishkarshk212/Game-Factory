import { asNum, asRecord, InvalidMoveError, type GameEngine, type MoveResult } from './engine.js';

export interface PoolBall {
  num: number; // 0 = cue, 1..7 = solid, 8 = black 8-ball, 9..15 = stripe
  x: number;
  y: number;
  pocketed: boolean;
}

export interface PoolFrame {
  balls: { num: number; x: number; y: number; pocketed: boolean }[];
}

export type PoolGroup = 'solids' | 'stripes';

export interface Pool8BallState {
  balls: PoolBall[];
  breakShotDone: boolean;
  playerGroups: [PoolGroup | null, PoolGroup | null];
  ballInHand: 0 | 1 | null;
  scores: [number, number]; // pocketed group balls count
  lastShot: {
    shooter: 0 | 1;
    angle: number;
    power: number;
    pocketedNumbers: number[];
    foulReason: string | null;
    frames: PoolFrame[];
  } | null;
  lastEvent: string | null;
}

const TABLE_LEFT = 55;
const TABLE_RIGHT = 945;
const TABLE_TOP = 55;
const TABLE_BOTTOM = 445;
const BALL_R = 13;
const POCKET_R = 24;

const POCKETS: [number, number][] = [
  [58, 58],
  [500, 44],
  [942, 58],
  [58, 442],
  [500, 456],
  [942, 442]
];

function createInitialRack(): PoolBall[] {
  const balls: PoolBall[] = [{ num: 0, x: 250, y: 250, pocketed: false }];
  // Standard triangle order ensuring 8-ball is center of 3rd row and corners are opposite groups
  const order = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
  const apexX = 685;
  const apexY = 250;
  const dx = BALL_R * 1.78;
  const dy = BALL_R * 2.04;

  let idx = 0;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col <= row; col++) {
      const num = order[idx++];
      balls.push({
        num,
        x: Math.round((apexX + row * dx) * 10) / 10,
        y: Math.round((apexY + (col - row / 2) * dy) * 10) / 10,
        pocketed: false
      });
    }
  }
  return balls;
}

function getGroup(num: number): PoolGroup | 'eight' | 'cue' {
  if (num === 0) return 'cue';
  if (num === 8) return 'eight';
  return num < 8 ? 'solids' : 'stripes';
}

function findSafeCueSpot(balls: PoolBall[], desiredX = 250, desiredY = 250): [number, number] {
  const clampX = Math.max(TABLE_LEFT + BALL_R + 4, Math.min(TABLE_RIGHT - BALL_R - 4, desiredX));
  const clampY = Math.max(TABLE_TOP + BALL_R + 4, Math.min(TABLE_BOTTOM - BALL_R - 4, desiredY));
  const free = (x: number, y: number) =>
    balls.every((b) => b.num === 0 || b.pocketed || Math.hypot(b.x - x, b.y - y) >= BALL_R * 2 + 2);
  if (free(clampX, clampY)) return [clampX, clampY];
  for (let r = 10; r <= 200; r += 12) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      const tx = Math.max(TABLE_LEFT + BALL_R + 4, Math.min(TABLE_RIGHT - BALL_R - 4, clampX + Math.cos(a) * r));
      const ty = Math.max(TABLE_TOP + BALL_R + 4, Math.min(TABLE_BOTTOM - BALL_R - 4, clampY + Math.sin(a) * r));
      if (free(tx, ty)) return [Math.round(tx), Math.round(ty)];
    }
  }
  return [250, 250];
}

function calcPoolScores(balls: PoolBall[], groups: [PoolGroup | null, PoolGroup | null]): [number, number] {
  const countGroup = (g: PoolGroup | null) => {
    if (!g) return 0;
    return balls.filter((b) => b.pocketed && getGroup(b.num) === g).length;
  };
  return [countGroup(groups[0]), countGroup(groups[1])];
}

export const pool8BallEngine: GameEngine<Pool8BallState> = {
  id: 'pool_8ball',
  createInitialState(): Pool8BallState {
    return {
      balls: createInitialRack(),
      breakShotDone: false,
      playerGroups: [null, null],
      ballInHand: 0,
      scores: [0, 0],
      lastShot: null,
      lastEvent: 'Break shot! Drag the cue ball or aim to break.'
    };
  },
  applyMove(state, playerIndex, currentTurnIndex, payload): MoveResult<Pool8BallState> {
    if (playerIndex !== currentTurnIndex) {
      throw new InvalidMoveError('Not your turn');
    }
    const data = asRecord(payload);
    const angle = asNum(data.angle, 'angle', -Math.PI * 2, Math.PI * 2);
    const power = asNum(data.power, 'power', 0.1, 1.0);

    interface Body {
      num: number;
      x: number;
      y: number;
      vx: number;
      vy: number;
      pocketed: boolean;
    }

    const bodies: Body[] = state.balls.map((b) => ({
      num: b.num,
      x: b.x,
      y: b.y,
      vx: 0,
      vy: 0,
      pocketed: b.pocketed
    }));

    const cue = bodies.find((b) => b.num === 0)!;
    if (state.ballInHand === playerIndex || cue.pocketed) {
      const reqX = typeof data.cueX === 'number' ? data.cueX : cue.x;
      const reqY = typeof data.cueY === 'number' ? data.cueY : cue.y;
      const maxCueX = !state.breakShotDone ? 280 : TABLE_RIGHT - BALL_R - 4;
      const clampedX = Math.min(maxCueX, Math.max(TABLE_LEFT + BALL_R + 4, reqX));
      const [sx, sy] = findSafeCueSpot(bodies, clampedX, reqY);
      cue.x = sx;
      cue.y = sy;
      cue.pocketed = false;
    }

    const speed = 7 + power * 26;
    cue.vx = Math.cos(angle) * speed;
    cue.vy = Math.sin(angle) * speed;

    let firstBallHit: number | null = null;
    let railHitAfterContact = false;
    let cueScratched = false;
    const pocketedThisShot: number[] = [];
    const frames: PoolFrame[] = [];

    const MAX_STEPS = 260;
    for (let step = 0; step < MAX_STEPS; step++) {
      for (const b of bodies) {
        if (b.pocketed) continue;
        b.x += b.vx;
        b.y += b.vy;
        b.vx *= 0.985;
        b.vy *= 0.985;
        if (Math.hypot(b.vx, b.vy) < 0.07) {
          b.vx = 0;
          b.vy = 0;
        }

        let hitRail = false;
        if (b.x - BALL_R < TABLE_LEFT) {
          b.x = TABLE_LEFT + BALL_R;
          b.vx = Math.abs(b.vx) * 0.86;
          hitRail = true;
        } else if (b.x + BALL_R > TABLE_RIGHT) {
          b.x = TABLE_RIGHT - BALL_R;
          b.vx = -Math.abs(b.vx) * 0.86;
          hitRail = true;
        }
        if (b.y - BALL_R < TABLE_TOP) {
          b.y = TABLE_TOP + BALL_R;
          b.vy = Math.abs(b.vy) * 0.86;
          hitRail = true;
        } else if (b.y + BALL_R > TABLE_BOTTOM) {
          b.y = TABLE_BOTTOM - BALL_R;
          b.vy = -Math.abs(b.vy) * 0.86;
          hitRail = true;
        }
        if (hitRail && firstBallHit !== null) {
          railHitAfterContact = true;
        }

        for (const [px, py] of POCKETS) {
          if (Math.hypot(b.x - px, b.y - py) < POCKET_R) {
            b.pocketed = true;
            b.vx = 0;
            b.vy = 0;
            if (b.num === 0) cueScratched = true;
            else pocketedThisShot.push(b.num);
            break;
          }
        }
      }

      // Ball-to-ball elastic collisions
      for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i];
        if (a.pocketed) continue;
        for (let j = i + 1; j < bodies.length; j++) {
          const b = bodies[j];
          if (b.pocketed) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          const minDist = BALL_R * 2;
          if (dist > 0 && dist < minDist) {
            if (firstBallHit === null && (a.num === 0 || b.num === 0)) {
              firstBallHit = a.num === 0 ? b.num : a.num;
            }
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = (minDist - dist) / 2;
            a.x -= nx * overlap;
            a.y -= ny * overlap;
            b.x += nx * overlap;
            b.y += ny * overlap;

            const rvx = b.vx - a.vx;
            const rvy = b.vy - a.vy;
            const velAlongNormal = rvx * nx + rvy * ny;
            if (velAlongNormal < 0) {
              const jImpulse = -0.94 * velAlongNormal;
              a.vx -= jImpulse * nx;
              a.vy -= jImpulse * ny;
              b.vx += jImpulse * nx;
              b.vy += jImpulse * ny;
            }
          }
        }
      }

      if (step % 5 === 0 || step === MAX_STEPS - 1) {
        frames.push({
          balls: bodies.map((b) => ({
            num: b.num,
            x: Math.round(b.x),
            y: Math.round(b.y),
            pocketed: b.pocketed
          }))
        });
      }

      if (bodies.every((b) => b.pocketed || (b.vx === 0 && b.vy === 0))) {
        break;
      }
    }

    const oppIndex: 0 | 1 = playerIndex === 0 ? 1 : 0;
    let nextGroups: [PoolGroup | null, PoolGroup | null] = [...state.playerGroups] as [
      PoolGroup | null,
      PoolGroup | null
    ];
    const myGroup = nextGroups[playerIndex];
    const myGroupClearedBefore =
      myGroup !== null &&
      state.balls.filter((b) => getGroup(b.num) === myGroup && !b.pocketed).length === 0;

    // Check fouls
    let foulReason: string | null = null;
    if (cueScratched) {
      foulReason = 'Cue ball scratched';
    } else if (firstBallHit === null) {
      foulReason = 'No object ball hit';
    } else if (myGroup !== null) {
      const hitType = getGroup(firstBallHit);
      if (myGroupClearedBefore && hitType !== 'eight') {
        foulReason = 'Must hit the 8-Ball first';
      } else if (!myGroupClearedBefore && hitType !== myGroup) {
        foulReason = `Must hit your ${myGroup} ball first`;
      }
    } else if (state.breakShotDone && firstBallHit === 8) {
      foulReason = 'Cannot hit 8-Ball first on an open table';
    }
    if (!foulReason && pocketedThisShot.length === 0 && !railHitAfterContact) {
      foulReason = 'No ball pocketed or driven to a rail';
    }

    const eightPocketed = pocketedThisShot.includes(8);
    let finished = false;
    let winnerIndex: 0 | 1 | null = null;
    let eventText = '';

    if (eightPocketed) {
      if (!state.breakShotDone && !cueScratched) {
        // Re-spot 8-ball on clean break
        const eightBall = bodies.find((b) => b.num === 8)!;
        const [ex, ey] = findSafeCueSpot(bodies, 700, 250);
        eightBall.pocketed = false;
        eightBall.x = ex;
        eightBall.y = ey;
        eventText = '8-Ball pocketed on break — re-spotted!';
      } else if (foulReason || !myGroupClearedBefore) {
        finished = true;
        winnerIndex = oppIndex;
        eventText = foulReason
          ? `Foul while sinking 8-Ball (${foulReason}) — Opponent wins!`
          : '8-Ball sunk prematurely — Opponent wins!';
      } else {
        finished = true;
        winnerIndex = playerIndex;
        eventText = '8-Ball sunk cleanly — Victory!';
      }
    }

    // Assign groups if open table after break and non-8 ball pocketed cleanly
    const objectBallsPocketed = pocketedThisShot.filter((n) => n !== 8);
    if (!finished && state.breakShotDone && nextGroups[0] === null && !foulReason && objectBallsPocketed.length > 0) {
      const firstGroup = getGroup(objectBallsPocketed[0]);
      if (firstGroup === 'solids' || firstGroup === 'stripes') {
        nextGroups[playerIndex] = firstGroup;
        nextGroups[oppIndex] = firstGroup === 'solids' ? 'stripes' : 'solids';
        eventText = `You claimed ${firstGroup.toUpperCase()}!`;
      }
    }

    // Re-spot cue ball if scratched
    if (cue.pocketed) {
      const [sx, sy] = findSafeCueSpot(bodies, 250, 250);
      cue.pocketed = false;
      cue.x = sx;
      cue.y = sy;
    }

    const nextBalls: PoolBall[] = bodies.map((b) => ({
      num: b.num,
      x: Math.round(b.x * 10) / 10,
      y: Math.round(b.y * 10) / 10,
      pocketed: b.pocketed
    }));

    const scores = calcPoolScores(nextBalls, nextGroups);
    const keepTurn =
      !finished &&
      !foulReason &&
      (nextGroups[playerIndex] === null
        ? objectBallsPocketed.length > 0
        : objectBallsPocketed.some((n) => getGroup(n) === nextGroups[playerIndex]));

    if (!eventText) {
      if (foulReason) eventText = `Foul: ${foulReason} — Ball in hand for opponent.`;
      else if (keepTurn) eventText = `Nice shot! Shoot again.`;
      else eventText = 'Turn passes.';
    }

    return {
      state: {
        balls: nextBalls,
        breakShotDone: true,
        playerGroups: nextGroups,
        ballInHand: !finished && foulReason ? oppIndex : null,
        scores,
        lastShot: {
          shooter: playerIndex,
          angle,
          power,
          pocketedNumbers: pocketedThisShot,
          foulReason,
          frames
        },
        lastEvent: eventText
      },
      nextTurnIndex: keepTurn ? playerIndex : oppIndex,
      scores,
      finished,
      winnerIndex,
      isDraw: false,
      eventText
    };
  },
  sanitizeForPlayer(state) {
    return state;
  }
};

