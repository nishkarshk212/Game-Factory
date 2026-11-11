import test from 'node:test';
import assert from 'node:assert/strict';
import { io as createClient, type Socket } from 'socket.io-client';
import { createAppServer, type RunningServer } from '../app.js';

function waitForEvent<T = any>(
  socket: Socket,
  event: string,
  predicate?: (data: T) => boolean,
  timeoutMs = 7000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for socket event "${event}"`));
    }, timeoutMs);

    const handler = (data: T) => {
      if (!predicate || predicate(data)) {
        clearTimeout(timer);
        socket.off(event, handler);
        resolve(data);
      }
    };
    socket.on(event, handler);
  });
}

test('End-to-end 2-player public matchmaking, private room, gameplay, reconnect, social, challenges & admin', async (t) => {
  let srv: RunningServer;
  try {
    srv = await createAppServer();
  } catch (err) {
    t.skip(`Skipping DB/Socket integration test (PostgreSQL unavailable): ${(err as Error).message}`);
    return;
  }

  await new Promise<void>((resolve) => srv.httpServer.listen(0, resolve));
  const address = srv.httpServer.address();
  const port = typeof address === 'object' && address ? address.port : 3001;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1) Authenticate Admin (100001) and Player 2 (888002)
    const res1 = await fetch(`${baseUrl}/api/auth/browser-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId: '100001', firstName: 'TestAdmin', username: 'test_admin' })
    });
    const auth1 = (await res1.json()) as any;
    assert.ok(auth1.token);
    assert.equal(auth1.user.role, 'admin');

    const res2 = await fetch(`${baseUrl}/api/auth/browser-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId: '888002', firstName: 'TestBeta', username: 'test_beta' })
    });
    const auth2 = (await res2.json()) as any;
    assert.ok(auth2.token);

    const s1 = createClient(baseUrl, { auth: { token: auth1.token }, transports: ['websocket'] });
    const s2 = createClient(baseUrl, { auth: { token: auth2.token }, transports: ['websocket'] });

    await Promise.all([waitForEvent(s1, 'connect'), waitForEvent(s2, 'connect')]);

    // 2) Private Room creation & join flow
    const createdPromise = waitForEvent(s1, 'room:created');
    s1.emit('room:create', { gameId: 'connect_four' });
    const created = await createdPromise;
    assert.ok(created.roomCode);

    const readyCheckPromise = waitForEvent(s2, 'match:state', (m) => m.status === 'ready_check');
    s2.emit('room:join', { roomCode: created.roomCode });
    const readyState = await readyCheckPromise;
    assert.equal(readyState.players[0].id, auth1.user.id);
    assert.equal(readyState.players[1].id, auth2.user.id);

    // 3) Player Ready -> Active match
    const activePromise1 = waitForEvent(s1, 'match:state', (m) => m.status === 'active');
    const activePromise2 = waitForEvent(s2, 'match:state', (m) => m.status === 'active');
    s2.emit('match:ready', { matchId: readyState.matchId });
    const [active1] = await Promise.all([activePromise1, activePromise2]);
    assert.equal(active1.status, 'active');

    // 4) Disconnect & Reconnect restoration without losing match progress!
    const movePromise = waitForEvent(s2, 'match:state', (m) => m.moveSequence === 1);
    s1.emit('match:move', { matchId: active1.matchId, expectedSeq: 0, move: { col: 0 } });
    await movePromise;

    const reconNotice = waitForEvent(s2, 'match:state', (m) => m.players[0]?.reconnecting === true);
    s1.disconnect();
    await reconNotice;

    const s1Reconnected = createClient(baseUrl, { auth: { token: auth1.token }, transports: ['websocket'] });
    const restoredState = await waitForEvent(s1Reconnected, 'match:state', (m) => m.matchId === active1.matchId);
    assert.equal(restoredState.moveSequence, 1);
    assert.equal(restoredState.gameState.board[5][0], 0);

    // 5) Finish Connect Four match & verify match:ended + XP + Rematch
    const moves: [Socket, number, number][] = [
      [s2, 1, 1],
      [s1Reconnected, 0, 2],
      [s2, 1, 3],
      [s1Reconnected, 0, 4],
      [s2, 1, 5],
      [s1Reconnected, 0, 6]
    ];
    for (const [sock, col, seq] of moves) {
      const nextWait =
        seq === 6
          ? waitForEvent(s2, 'match:ended')
          : waitForEvent(s2, 'match:state', (m) => m.moveSequence === seq + 1);
      sock.emit('match:move', { matchId: active1.matchId, expectedSeq: seq, move: { col } });
      const res = await nextWait;
      if (seq === 6) {
        assert.equal(res.winnerIndex, 0);
        assert.ok(res.xpAwarded[0] >= 100);
      }
    }

    // 6) Rematch flow
    const rematchStarted = waitForEvent(s1Reconnected, 'match:rematch_started');
    s1Reconnected.emit('match:rematch_request', { matchId: active1.matchId });
    s2.emit('match:rematch_request', { matchId: active1.matchId });
    const rematchInfo = await rematchStarted;
    assert.ok(rematchInfo.newMatchId && rematchInfo.newMatchId !== active1.matchId);

    // Finish rematch via resign so both players are free for public queue test!
    const rematchEnded = waitForEvent(s2, 'match:ended');
    s1Reconnected.emit('match:resign', { matchId: rematchInfo.newMatchId });
    await rematchEnded;

    // 7) Public Matchmaking Queue (Play Online)
    const waitingPromise = waitForEvent(s1Reconnected, 'queue:waiting');
    s1Reconnected.emit('queue:join', { gameId: 'tic_tac_toe' });
    await waitingPromise;

    const matchFound1 = waitForEvent(s1Reconnected, 'match:found');
    const matchFound2 = waitForEvent(s2, 'match:found');
    s2.emit('queue:join', { gameId: 'tic_tac_toe' });
    const [f1, f2] = await Promise.all([matchFound1, matchFound2]);
    assert.equal(f1.matchId, f2.matchId);
    assert.equal(f1.gameId, 'tic_tac_toe');

    // 8) Verify Match History, Leaderboard, Daily Challenges, Social & Admin APIs
    const [histRes, lbRes, chRes, adminRes] = await Promise.all([
      fetch(`${baseUrl}/api/users/history`, { headers: { Authorization: `Bearer ${auth1.token}` } }),
      fetch(`${baseUrl}/api/users/leaderboard`, { headers: { Authorization: `Bearer ${auth1.token}` } }),
      fetch(`${baseUrl}/api/users/challenges`, { headers: { Authorization: `Bearer ${auth1.token}` } }),
      fetch(`${baseUrl}/api/admin/overview`, { headers: { Authorization: `Bearer ${auth1.token}` } })
    ]);

    const histJson = (await histRes.json()) as any;
    const lbJson = (await lbRes.json()) as any;
    const chJson = (await chRes.json()) as any;
    const adminJson = (await adminRes.json()) as any;

    assert.ok(histJson.history.length >= 2);
    assert.ok(lbJson.entries.length >= 2);
    assert.ok(chJson.challenges.some((c: any) => c.code === 'daily_win_1' && c.completed === true));
    assert.ok(adminJson.totalUsers >= 2);
    assert.ok(adminJson.liveMatches.length >= 1);

    // Friend request flow
    const frRes = await fetch(`${baseUrl}/api/social/friends/request`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth1.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ targetUserId: auth2.user.id })
    });
    const frJson = (await frRes.json()) as any;
    assert.ok(['pending', 'accepted', 'already_friends'].includes(frJson.status));

    s1Reconnected.disconnect();
    s2.disconnect();
  } finally {
    await srv.close();
  }
});
