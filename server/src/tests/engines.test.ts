import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CATALOG } from '@gameverse/shared';
import { getGameEngine } from '../games/registry.js';
import { InvalidMoveError } from '../games/engine.js';

test('All 14 catalog games have registered server engines', () => {
  assert.equal(GAME_CATALOG.length, 14);
  for (const g of GAME_CATALOG) {
    const engine = getGameEngine(g.id);
    assert.equal(engine.id, g.id);
    const state = engine.createInitialState();
    assert.ok(state !== null && typeof state === 'object');
  }
});

test('Chess engine plays Scholars Mate and rejects illegal moves', () => {
  const chess = getGameEngine('chess');
  let state = chess.createInitialState();
  let turn: 0 | 1 = 0;

  // Out-of-turn check
  assert.throws(() => chess.applyMove(state, 1, turn, { from: [1, 4], to: [3, 4] }), InvalidMoveError);

  const sequence: [0 | 1, [number, number], [number, number]][] = [
    [0, [6, 4], [4, 4]], // e4
    [1, [1, 4], [3, 4]], // e5
    [0, [7, 5], [4, 2]], // Bc4
    [1, [0, 1], [2, 2]], // Nc6
    [0, [7, 3], [3, 7]], // Qh5
    [1, [0, 6], [2, 5]], // Nf6??
    [0, [3, 7], [1, 5]]  // Qxf7#
  ];

  let res: any;
  for (const [player, from, to] of sequence) {
    res = chess.applyMove(state, player, turn, { from, to });
    state = res.state;
    turn = res.nextTurnIndex;
  }

  assert.equal(res.finished, true);
  assert.equal(res.winnerIndex, 0);
  assert.equal(res.isDraw, false);
});

test('Tic-Tac-Toe Best-of-3 awards match after 2 round wins', () => {
  const ttt = getGameEngine('tic_tac_toe');
  let s = ttt.createInitialState();
  let t: 0 | 1 = 0;

  // Round 1: Player 0 wins top row
  for (const [p, c] of [
    [0, 0], [1, 3], [0, 1], [1, 4], [0, 2]
  ] as [0 | 1, number][]) {
    const r = ttt.applyMove(s, p, t, { cell: c });
    s = r.state;
    t = r.nextTurnIndex;
    assert.equal(r.finished, false);
  }
  assert.equal(s.round, 2);
  assert.equal(t, 1);

  // Round 2: Player 0 wins diagonal (starting player is 1)
  let finalRes: any;
  for (const [p, c] of [
    [1, 1], [0, 0], [1, 2], [0, 4], [1, 5], [0, 8]
  ] as [0 | 1, number][]) {
    finalRes = ttt.applyMove(s, p, t, { cell: c });
    s = finalRes.state;
    t = finalRes.nextTurnIndex;
  }
  assert.equal(finalRes.finished, true);
  assert.equal(finalRes.winnerIndex, 0);
  assert.deepEqual(finalRes.scores, [2, 0]);
});

test('Connect Four & Four in a Row (Pop-Out) rules and wins', () => {
  const c4 = getGameEngine('connect_four');
  let s4 = c4.createInitialState();
  let t4: 0 | 1 = 0;
  let r4: any;
  for (const [p, col] of [
    [0, 0], [1, 1], [0, 0], [1, 1], [0, 0], [1, 1], [0, 0]
  ] as [0 | 1, number][]) {
    r4 = c4.applyMove(s4, p, t4, { col });
    s4 = r4.state;
    t4 = r4.nextTurnIndex;
  }
  assert.equal(r4.finished, true);
  assert.equal(r4.winnerIndex, 0);

  const four = getGameEngine('four_in_a_row');
  let sf = four.createInitialState();
  let tf: 0 | 1 = 0;
  // Cannot pop empty bottom row
  assert.throws(() => four.applyMove(sf, 0, tf, { action: 'pop', col: 0 }), InvalidMoveError);
  let r = four.applyMove(sf, 0, tf, { action: 'drop', col: 0 });
  sf = r.state;
  tf = r.nextTurnIndex;
  // Player 1 cannot pop Player 0's disc
  assert.throws(() => four.applyMove(sf, 1, tf, { action: 'pop', col: 0 }), InvalidMoveError);
  // Drop and verify player 0 can pop own disc
  r = four.applyMove(sf, 1, tf, { action: 'drop', col: 1 });
  sf = r.state;
  tf = r.nextTurnIndex;
  r = four.applyMove(sf, 0, tf, { action: 'pop', col: 0 });
  assert.equal(r.state.popCount[0], 1);
});

test('RPS hides pending choice from opponent until both commit', () => {
  const rps = getGameEngine('rps');
  let s = rps.createInitialState();
  const r1 = rps.applyMove(s, 0, 0, { choice: 'rock' });
  s = r1.state;
  assert.equal(r1.finished, false);

  // Sanitized view for Player 1 MUST NOT expose Player 0's choice
  const viewForP1 = rps.sanitizeForPlayer(s, 1) as any;
  assert.equal(viewForP1.opponentCommitted, true);
  assert.equal(viewForP1.myCommitted, false);
  assert.equal(viewForP1.pendingChoices, undefined);

  const r2 = rps.applyMove(s, 1, 1, { choice: 'scissors' });
  assert.deepEqual(r2.scores, [1, 0]);
});

test('Dots and Boxes awards bonus turn on box completion', () => {
  const db = getGameEngine('dots_and_boxes');
  let s = db.createInitialState();
  let t: 0 | 1 = 0;

  let res = db.applyMove(s, 0, t, { type: 'h', r: 0, c: 0 });
  s = res.state; t = res.nextTurnIndex;
  assert.equal(t, 1);

  res = db.applyMove(s, 1, t, { type: 'h', r: 1, c: 0 });
  s = res.state; t = res.nextTurnIndex;
  assert.equal(t, 0);

  res = db.applyMove(s, 0, t, { type: 'v', r: 0, c: 0 });
  s = res.state; t = res.nextTurnIndex;
  assert.equal(t, 1);

  // Player 1 completes the box and keeps turn!
  res = db.applyMove(s, 1, t, { type: 'v', r: 0, c: 1 });
  assert.equal(res.nextTurnIndex, 1);
  assert.deepEqual(res.scores, [0, 1]);
});

test('Battleship protects secret fleet positions and resolves naval combat', () => {
  const bs = getGameEngine('battleship');
  let s = bs.createInitialState();

  const r0 = bs.applyMove(s, 0, 0, { action: 'randomFleet' });
  s = r0.state;
  const viewForP1Setup = bs.sanitizeForPlayer(s, 1) as any;
  assert.equal(viewForP1Setup.enemyBoard.ready, true);
  assert.equal(viewForP1Setup.enemyBoard.sunkShips.length, 0);
  assert.equal(viewForP1Setup.enemyBoard.ships, undefined);

  const r1 = bs.applyMove(s, 1, 0, { action: 'randomFleet' });
  s = r1.state;
  assert.equal(s.phase, 'battle');

  const shot = bs.applyMove(s, 0, 0, { action: 'fire', row: 0, col: 0 });
  s = shot.state;
  assert.throws(() => bs.applyMove(s, 0, shot.nextTurnIndex, { action: 'fire', row: 0, col: 0 }), InvalidMoveError);
});

test('Sudoku strips solution from client payload and enforces 3-strike loss', () => {
  const sdk = getGameEngine('sudoku');
  let s = sdk.createInitialState();
  const sanitized = sdk.sanitizeForPlayer(s, 0) as any;
  assert.equal(sanitized.solution, undefined);

  // Find first empty cell and submit wrong digit 3 times for Player 0
  let er = -1;
  let ec = -1;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (s.puzzle[r][c] === 0) {
        er = r;
        ec = c;
        break;
      }
    }
    if (er !== -1) break;
  }
  const correctDigit = s.solution[er][ec];
  const wrongDigit = correctDigit === 9 ? 1 : correctDigit + 1;

  let res = sdk.applyMove(s, 0, 0, { r: er, c: ec, value: wrongDigit });
  s = res.state;
  assert.equal(s.strikes[0], 1);

  // Player 1 makes correct move on same cell
  res = sdk.applyMove(s, 1, 1, { r: er, c: ec, value: correctDigit });
  s = res.state;
  assert.equal(s.scores[1], 10);

  // Find another empty cell for Player 0 wrong guesses
  let er2 = -1;
  let ec2 = -1;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (s.puzzle[r][c] === 0) {
        er2 = r;
        ec2 = c;
        break;
      }
    }
    if (er2 !== -1) break;
  }
  const wrong2 = s.solution[er2][ec2] === 9 ? 1 : s.solution[er2][ec2] + 1;
  res = sdk.applyMove(s, 0, 0, { r: er2, c: ec2, value: wrong2 });
  s = res.state;
  res = sdk.applyMove(s, 1, 1, { r: er2, c: ec2, value: s.solution[er2][ec2] });
  s = res.state;

  // Third strike causes Player 0 loss
  let er3 = -1;
  let ec3 = -1;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (s.puzzle[r][c] === 0) {
        er3 = r;
        ec3 = c;
        break;
      }
    }
    if (er3 !== -1) break;
  }
  const wrong3 = s.solution[er3][ec3] === 9 ? 1 : s.solution[er3][ec3] + 1;
  res = sdk.applyMove(s, 0, 0, { r: er3, c: ec3, value: wrong3 });
  assert.equal(res.finished, true);
  assert.equal(res.winnerIndex, 1);
});

test('Checkers enforces mandatory captures', () => {
  const chk = getGameEngine('checkers');
  let s = chk.createInitialState();
  // Move p0 piece [5,0] -> [4,1]
  let res = chk.applyMove(s, 0, 0, { from: [5, 0], to: [4, 1] });
  s = res.state;
  // Move p1 piece [2,3] -> [3,2]
  res = chk.applyMove(s, 1, 1, { from: [2, 3], to: [3, 2] });
  s = res.state;
  // Now [4,1] MUST capture [3,2] -> [2,3]; non-capture move [5,2]->[4,3] must be rejected!
  assert.throws(() => chk.applyMove(s, 0, 0, { from: [5, 2], to: [4, 3] }), InvalidMoveError);
  res = chk.applyMove(s, 0, 0, { from: [4, 1], to: [2, 3] });
  assert.deepEqual(res.scores, [1, 0]);
});

test('Carrom and 8-Ball Pool simulate physics shots deterministically and produce frames', () => {
  const carrom = getGameEngine('carrom');
  const cInit = carrom.createInitialState();
  const cRes = carrom.applyMove(cInit, 0, 0, {
    strikerX: 400,
    angle: -Math.PI / 2,
    power: 0.95
  });
  assert.ok(cRes.state.lastShot.frames.length > 5);

  const pool = getGameEngine('pool_8ball');
  const pInit = pool.createInitialState();
  const pRes = pool.applyMove(pInit, 0, 0, {
    cueX: 250,
    cueY: 250,
    angle: 0,
    power: 0.95
  });
  assert.equal(pRes.state.breakShotDone, true);
  assert.ok(pRes.state.lastShot.frames.length > 5);
});

test('Ludo, Reversi, and Memory Clash sanitize and validate moves', () => {
  const ludo = getGameEngine('ludo');
  const lInit = ludo.createInitialState();
  const lRoll = ludo.applyMove(lInit, 0, 0, { action: 'roll' });
  assert.ok(lRoll.state.diceValue! >= 1 && lRoll.state.diceValue! <= 6);

  const rev = getGameEngine('reversi');
  const rInit = rev.createInitialState();
  assert.throws(() => rev.applyMove(rInit, 0, 0, { r: 0, c: 0 }), InvalidMoveError);
  const rOk = rev.applyMove(rInit, 0, 0, { r: 2, c: 3 });
  assert.equal(rOk.scores[0], 4);
  assert.equal(rOk.scores[1], 1);

  const mem = getGameEngine('memory_clash');
  const mInit = mem.createInitialState();
  const mSanitized = mem.sanitizeForPlayer(mInit, 0) as any;
  assert.equal(mSanitized.cards[0].symbol, null);
  const mFlip = mem.applyMove(mInit, 0, 0, { index: 0 });
  const mSanitizedAfter = mem.sanitizeForPlayer(mFlip.state, 0) as any;
  assert.ok(typeof mSanitizedAfter.cards[0].symbol === 'string');
  assert.equal(mSanitizedAfter.cards[1].symbol, null);
});

