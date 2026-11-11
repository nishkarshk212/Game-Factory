import crypto from 'node:crypto';
import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import {
  GAME_MAP,
  VALID_GAME_IDS,
  type ActiveMatchState,
  type GameId,
  type MatchEndReason,
  type MatchResultSummary,
  type PlayerSummary,
  type UserProfile
} from '@gameverse/shared';
import { config } from '../config.js';
import { verifySessionToken } from '../auth/jwt.js';
import {
  createMatchRecord,
  createNotification,
  getGameConfigs,
  getPlatformSettings,
  getUserById,
  recordMatchResult,
  toPlayerSummary,
  touchUserLastSeen
} from '../db/repository.js';
import {
  acquireLock,
  clearUserActiveMatchId,
  deleteMatchState,
  deleteRoomMapping,
  dequeuePlayer,
  enqueuePlayer,
  getAllActiveMatches,
  getMatchIdByRoomCode,
  getMatchState,
  getOnlineUserIds,
  getQueueSize,
  getUserActiveMatchId,
  getUserQueuedGame,
  popMatchOpponent,
  releaseLock,
  saveMatchState,
  setRoomMapping,
  setUserActiveMatchId,
  setUserOnline,
  setUserOffline
} from '../redis/store.js';
import { getGameEngine } from '../games/registry.js';
import { InvalidMoveError } from '../games/engine.js';
import { TokenBucketLimiter } from './rateLimiter.js';

interface AuthedSocket extends Socket {
  user?: UserProfile;
}

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ROOM_ALPHABET[crypto.randomInt(0, ROOM_ALPHABET.length)];
  }
  return code;
}

export class RealtimeCoordinator {
  public readonly io: Server;
  private userSockets = new Map<string, Set<string>>();
  private turnTimers = new Map<string, NodeJS.Timeout>();
  private readyTimers = new Map<string, NodeJS.Timeout>();
  private disconnectTimers = new Map<string, NodeJS.Timeout>();
  private isShuttingDown = false;
  private moveLimiter = new TokenBucketLimiter(25, 10);
  private actionLimiter = new TokenBucketLimiter(15, 5);

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: config.clientOrigins.length ? config.clientOrigins : '*',
        credentials: true
      },
      pingTimeout: 20000,
      pingInterval: 10000
    });

    this.io.use(async (socket: AuthedSocket, next) => {
      try {
        const token =
          (socket.handshake.auth?.token as string) ||
          (socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '');
        if (!token) return next(new Error('Unauthorized'));
        const claims = verifySessionToken(token);
        const user = await getUserById(claims.sub);
        if (!user) return next(new Error('Account not found'));
        if (user.isBanned) return next(new Error('Account banned'));
        socket.user = user;
        next();
      } catch (err) {
        next(new Error(err instanceof Error ? err.message : 'Authentication failed'));
      }
    });

    this.io.on('connection', (socket: AuthedSocket) => {
      void this.onConnection(socket);
    });
  }

  public isUserOnline(userId: string): boolean {
    const set = this.userSockets.get(userId);
    return Boolean(set && set.size > 0);
  }

  public emitToUser(userId: string, event: string, payload: unknown): void {
    this.io.to(`user:${userId}`).emit(event, payload);
  }

  public broadcastGlobal(event: string, payload: unknown): void {
    this.io.emit(event, payload);
  }

  public async forceTerminateMatch(matchId: string): Promise<boolean> {
    const match = await getMatchState(matchId);
    if (!match || match.status === 'completed' || match.status === 'abandoned') return false;
    await this.finalizeMatch(match, null, true, 'admin_terminated', 'Match terminated by platform admin.');
    return true;
  }

  public async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    for (const t of this.turnTimers.values()) clearTimeout(t);
    for (const t of this.readyTimers.values()) clearTimeout(t);
    for (const t of this.disconnectTimers.values()) clearTimeout(t);
    this.turnTimers.clear();
    this.readyTimers.clear();
    this.disconnectTimers.clear();
    this.io.disconnectSockets(true);
    await new Promise<void>((resolve) => this.io.close(() => resolve()));
  }

  private async onConnection(socket: AuthedSocket): Promise<void> {
    const user = socket.user!;
    let set = this.userSockets.get(user.id);
    if (!set) {
      set = new Set();
      this.userSockets.set(user.id, set);
    }
    set.add(socket.id);
    socket.join(`user:${user.id}`);

    await setUserOnline(user.id);
    await touchUserLastSeen(user.id);
    this.io.emit('presence:update', { userId: user.id, online: true });

    // Restore active match or queue if user reconnected!
    const existingMatchId = await getUserActiveMatchId(user.id);
    if (existingMatchId) {
      const match = await getMatchState(existingMatchId);
      if (match && match.status !== 'completed' && match.status !== 'abandoned') {
        const pIdx = this.getPlayerIndex(match, user.id);
        if (pIdx !== -1) {
          this.clearDisconnectTimer(existingMatchId, user.id);
          match.players[pIdx]!.online = true;
          match.players[pIdx]!.reconnecting = false;
          match.players[pIdx]!.disconnectDeadline = null;
          await saveMatchState(match);
          socket.join(`match:${match.matchId}`);
          await this.broadcastMatchState(match);
        } else {
          await clearUserActiveMatchId(user.id);
        }
      } else {
        await clearUserActiveMatchId(user.id);
      }
    }

    const queuedGame = await getUserQueuedGame(user.id);
    if (queuedGame) {
      socket.emit('queue:waiting', {
        gameId: queuedGame,
        queueSize: await getQueueSize(queuedGame)
      });
    }

    socket.on('queue:join', (data) => void this.handleQueueJoin(socket, data));
    socket.on('queue:leave', () => void this.handleQueueLeave(socket));
    socket.on('room:create', (data) => void this.handleRoomCreate(socket, data));
    socket.on('room:join', (data) => void this.handleRoomJoin(socket, data));
    socket.on('room:cancel', (data) => void this.handleRoomCancel(socket, data));
    socket.on('room:invite_friend', (data) => void this.handleInviteFriend(socket, data));
    socket.on('match:ready', (data) => void this.handleMatchReady(socket, data));
    socket.on('match:move', (data) => void this.handleMatchMove(socket, data));
    socket.on('match:resign', (data) => void this.handleMatchResign(socket, data));
    socket.on('match:offer_draw', (data) => void this.handleOfferDraw(socket, data));
    socket.on('match:respond_draw', (data) => void this.handleRespondDraw(socket, data));
    socket.on('match:emote', (data) => void this.handleMatchEmote(socket, data));
    socket.on('match:rematch_request', (data) => void this.handleRematchRequest(socket, data));
    socket.on('match:leave_postgame', (data) => void this.handleLeavePostgame(socket, data));
    socket.on('presence:list', () => void this.handlePresenceList(socket));

    socket.on('disconnect', () => {
      void this.onDisconnect(socket);
    });
  }

  private async onDisconnect(socket: AuthedSocket): Promise<void> {
    if (this.isShuttingDown) return;
    const user = socket.user!;
    const set = this.userSockets.get(user.id);
    if (set) {
      set.delete(socket.id);
      if (set.size > 0) return; // another tab/device is still connected
      this.userSockets.delete(user.id);
    }

    await setUserOffline(user.id);
    this.io.emit('presence:update', { userId: user.id, online: false });

    const queued = await getUserQueuedGame(user.id);
    if (queued) {
      await dequeuePlayer(user.id, queued);
    }

    const activeMatchId = await getUserActiveMatchId(user.id);
    if (!activeMatchId) return;

    const match = await getMatchState(activeMatchId);
    if (!match || match.status === 'completed' || match.status === 'abandoned') {
      await clearUserActiveMatchId(user.id);
      return;
    }

    const pIdx = this.getPlayerIndex(match, user.id);
    if (pIdx === -1) return;

    // If host disconnects from an unfilled private room, give a brief 20s grace or clean up
    const settings = await getPlatformSettings();
    const graceSec = match.status === 'waiting_opponent' ? 15 : settings.reconnectGraceSeconds || config.reconnectGraceSeconds;
    const deadline = Date.now() + graceSec * 1000;

    match.players[pIdx]!.online = false;
    match.players[pIdx]!.reconnecting = true;
    match.players[pIdx]!.disconnectDeadline = deadline;
    await saveMatchState(match);
    await this.broadcastMatchState(match);

    this.clearDisconnectTimer(match.matchId, user.id);
    const timer = setTimeout(() => {
      void this.handleDisconnectTimeout(match.matchId, user.id);
    }, graceSec * 1000);
    this.disconnectTimers.set(`${match.matchId}:${user.id}`, timer);
  }

  private async handleDisconnectTimeout(matchId: string, userId: string): Promise<void> {
    this.disconnectTimers.delete(`${matchId}:${userId}`);
    if (this.isUserOnline(userId)) return;

    const match = await getMatchState(matchId);
    if (!match || match.status === 'completed' || match.status === 'abandoned') return;

    if (match.status === 'waiting_opponent') {
      match.status = 'abandoned';
      await saveMatchState(match);
      if (match.roomCode) await deleteRoomMapping(match.roomCode);
      await clearUserActiveMatchId(userId);
      await deleteMatchState(match.matchId);
      return;
    }

    const pIdx = this.getPlayerIndex(match, userId);
    if (pIdx === -1) return;
    const oppIdx: 0 | 1 = pIdx === 0 ? 1 : 0;

    await this.finalizeMatch(
      match,
      oppIdx,
      false,
      'disconnect_forfeit',
      `${match.players[pIdx]?.displayName} failed to reconnect in time.`
    );
  }

  private clearDisconnectTimer(matchId: string, userId: string) {
    const key = `${matchId}:${userId}`;
    const t = this.disconnectTimers.get(key);
    if (t) {
      clearTimeout(t);
      this.disconnectTimers.delete(key);
    }
  }

  private clearMatchTimers(matchId: string) {
    const t = this.turnTimers.get(matchId);
    if (t) {
      clearTimeout(t);
      this.turnTimers.delete(matchId);
    }
    const r = this.readyTimers.get(matchId);
    if (r) {
      clearTimeout(r);
      this.readyTimers.delete(matchId);
    }
  }

  private scheduleReadyTimer(match: ActiveMatchState) {
    this.clearMatchTimers(match.matchId);
    const timer = setTimeout(() => {
      void (async () => {
        const latest = await getMatchState(match.matchId);
        if (!latest || latest.status !== 'ready_check') return;
        const p0Ready = Boolean(latest.players[0]?.ready);
        const p1Ready = Boolean(latest.players[1]?.ready);
        if (p0Ready && p1Ready) return;
        // Auto-start if at least one ready or cancel cleanly if neither ready
        if (!p0Ready && !p1Ready) {
          latest.status = 'abandoned';
          await saveMatchState(latest);
          if (latest.players[0]) await clearUserActiveMatchId(latest.players[0].id);
          if (latest.players[1]) await clearUserActiveMatchId(latest.players[1].id);
          this.io.to(`match:${latest.matchId}`).emit('match:abandoned', {
            matchId: latest.matchId,
            reason: 'Ready check timed out'
          });
          return;
        }
        // Auto-ready remaining player if connected, or forfeit if disconnected
        if (latest.players[0] && latest.players[1]) {
          latest.players[0].ready = true;
          latest.players[1].ready = true;
          await this.startActiveMatch(latest);
        }
      })();
    }, config.readyTimeoutSeconds * 1000);
    this.readyTimers.set(match.matchId, timer);
  }

  private scheduleTurnTimer(match: ActiveMatchState) {
    const existing = this.turnTimers.get(match.matchId);
    if (existing) clearTimeout(existing);
    if (match.status !== 'active' || !match.turnDeadline) return;

    const delayMs = Math.max(1000, match.turnDeadline - Date.now());
    const expectedSeq = match.moveSequence;

    const timer = setTimeout(() => {
      void (async () => {
        const latest = await getMatchState(match.matchId);
        if (!latest || latest.status !== 'active' || latest.moveSequence !== expectedSeq) return;
        const timedOutIdx = latest.currentTurnIndex;
        const winnerIdx: 0 | 1 = timedOutIdx === 0 ? 1 : 0;
        await this.finalizeMatch(
          latest,
          winnerIdx,
          false,
          'timeout',
          `${latest.players[timedOutIdx]?.displayName} ran out of turn time.`
        );
      })();
    }, delayMs);

    this.turnTimers.set(match.matchId, timer);
  }

  private getPlayerIndex(match: ActiveMatchState, userId: string): 0 | 1 | -1 {
    if (match.players[0]?.id === userId) return 0;
    if (match.players[1]?.id === userId) return 1;
    return -1;
  }

  private async handlePresenceList(socket: AuthedSocket) {
    const ids = await getOnlineUserIds();
    socket.emit('presence:list', { userIds: ids });
  }

  private async handleQueueJoin(socket: AuthedSocket, raw: any) {
    const user = socket.user!;
    if (!this.actionLimiter.consume(`act:${user.id}`)) {
      socket.emit('match:error', { error: 'Too many requests. Please slow down.' });
      return;
    }

    const gameId = raw?.gameId as GameId;
    if (!VALID_GAME_IDS.has(gameId)) {
      socket.emit('match:error', { error: 'Invalid game selected' });
      return;
    }

    const lockKey = `mm:${user.id}`;
    if (!(await acquireLock(lockKey, 4))) {
      socket.emit('match:error', { error: 'Matchmaking request already in progress' });
      return;
    }

    try {
      const [settings, configs, existingMatchId] = await Promise.all([
        getPlatformSettings(),
        getGameConfigs(),
        getUserActiveMatchId(user.id)
      ]);

      if (settings.maintenanceMode) {
        socket.emit('match:error', { error: settings.maintenanceMessage || 'Maintenance mode active' });
        return;
      }
      if (!settings.allowPublicMatchmaking) {
        socket.emit('match:error', { error: 'Public matchmaking is currently disabled' });
        return;
      }
      const gCfg = configs.find((c) => c.gameId === gameId);
      if (gCfg && !gCfg.enabled) {
        socket.emit('match:error', { error: `${GAME_MAP[gameId].name} is currently disabled` });
        return;
      }
      if (existingMatchId) {
        const existing = await getMatchState(existingMatchId);
        if (existing && existing.status !== 'completed' && existing.status !== 'abandoned') {
          socket.emit('match:error', { error: 'You already have an active match' });
          return;
        }
        await clearUserActiveMatchId(user.id);
      }

      const alreadyQueued = await getUserQueuedGame(user.id);
      if (alreadyQueued) {
        await dequeuePlayer(user.id, alreadyQueued);
      }

      const opponentId = await popMatchOpponent(gameId, user.id);
      if (opponentId) {
        const opponent = await getUserById(opponentId);
        if (!opponent || opponent.isBanned || !this.isUserOnline(opponent.id)) {
          // Stale opponent, enqueue self instead
          await enqueuePlayer(gameId, user.id);
          socket.emit('queue:waiting', { gameId, queueSize: await getQueueSize(gameId) });
          return;
        }

        const freshSelf = (await getUserById(user.id)) || user;
        const turnSeconds = gCfg?.turnSeconds || GAME_MAP[gameId].defaultTurnSeconds;
        const match = await this.createMatchInstance({
          gameId,
          mode: 'public',
          roomCode: null,
          p0: freshSelf,
          p1: opponent,
          turnSeconds
        });

        this.joinUserSocketsToMatch(freshSelf.id, match.matchId);
        this.joinUserSocketsToMatch(opponent.id, match.matchId);
        this.scheduleReadyTimer(match);
        this.emitToUser(freshSelf.id, 'match:found', { matchId: match.matchId, gameId });
        this.emitToUser(opponent.id, 'match:found', { matchId: match.matchId, gameId });
        await this.broadcastMatchState(match);
      } else {
        await enqueuePlayer(gameId, user.id);
        socket.emit('queue:waiting', { gameId, queueSize: await getQueueSize(gameId) });
      }
    } finally {
      await releaseLock(lockKey);
    }
  }

  private async handleQueueLeave(socket: AuthedSocket) {
    const user = socket.user!;
    await dequeuePlayer(user.id);
    socket.emit('queue:left', {});
  }

  private async handleRoomCreate(socket: AuthedSocket, raw: any) {
    const user = socket.user!;
    if (!this.actionLimiter.consume(`act:${user.id}`)) {
      socket.emit('match:error', { error: 'Too many requests' });
      return;
    }

    const gameId = raw?.gameId as GameId;
    if (!VALID_GAME_IDS.has(gameId)) {
      socket.emit('match:error', { error: 'Invalid game selected' });
      return;
    }

    const [settings, configs, existingMatchId] = await Promise.all([
      getPlatformSettings(),
      getGameConfigs(),
      getUserActiveMatchId(user.id)
    ]);

    if (settings.maintenanceMode) {
      socket.emit('match:error', { error: settings.maintenanceMessage });
      return;
    }
    if (!settings.allowPrivateRooms) {
      socket.emit('match:error', { error: 'Private rooms are currently disabled' });
      return;
    }
    const gCfg = configs.find((c) => c.gameId === gameId);
    if (gCfg && !gCfg.enabled) {
      socket.emit('match:error', { error: 'This game is currently disabled' });
      return;
    }
    if (existingMatchId) {
      const existing = await getMatchState(existingMatchId);
      if (existing && existing.status !== 'completed' && existing.status !== 'abandoned') {
        socket.emit('match:error', { error: 'Finish or leave your current match first' });
        return;
      }
      await clearUserActiveMatchId(user.id);
    }

    await dequeuePlayer(user.id);

    let roomCode = generateRoomCode();
    for (let i = 0; i < 6; i++) {
      if (!(await getMatchIdByRoomCode(roomCode))) break;
      roomCode = generateRoomCode();
    }

    const matchId = crypto.randomUUID();
    const freshSelf = (await getUserById(user.id)) || user;
    const p0: PlayerSummary = { ...toPlayerSummary(freshSelf, true, 0), ready: true };
    const turnSeconds = gCfg?.turnSeconds || GAME_MAP[gameId].defaultTurnSeconds;
    const engine = getGameEngine(gameId);

    const match: ActiveMatchState = {
      matchId,
      gameId,
      mode: 'private',
      roomCode,
      status: 'waiting_opponent',
      players: [p0, null],
      currentTurnIndex: 0,
      turnSeconds,
      turnDeadline: null,
      startedAt: null,
      endedAt: null,
      winnerIndex: null,
      isDraw: false,
      endReason: null,
      moveSequence: 0,
      drawOfferBy: null,
      rematchRequests: [false, false],
      gameState: engine.createInitialState(),
      lastEventText: `Room ${roomCode} created — waiting for opponent`
    };

    await saveMatchState(match);
    await setRoomMapping(roomCode, matchId);
    await setUserActiveMatchId(user.id, matchId);
    this.joinUserSocketsToMatch(user.id, matchId);

    socket.emit('room:created', {
      matchId,
      roomCode,
      gameId
    });
    await this.broadcastMatchState(match);
  }

  private async handleRoomJoin(socket: AuthedSocket, raw: any) {
    const user = socket.user!;
    const code = String(raw?.roomCode || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{4,10}$/.test(code)) {
      socket.emit('match:error', { error: 'Enter a valid room code' });
      return;
    }

    const matchId = await getMatchIdByRoomCode(code);
    if (!matchId) {
      socket.emit('match:error', { error: 'Room code not found or expired' });
      return;
    }

    const lockKey = `room:${matchId}`;
    if (!(await acquireLock(lockKey, 4))) {
      socket.emit('match:error', { error: 'Room is currently busy — retry' });
      return;
    }

    try {
      const existingMatchId = await getUserActiveMatchId(user.id);
      if (existingMatchId && existingMatchId !== matchId) {
        const existing = await getMatchState(existingMatchId);
        if (existing && existing.status !== 'completed' && existing.status !== 'abandoned') {
          socket.emit('match:error', { error: 'You are already in an active match' });
          return;
        }
        await clearUserActiveMatchId(user.id);
      }

      const match = await getMatchState(matchId);
      if (!match || match.status !== 'waiting_opponent' || !match.players[0]) {
        socket.emit('match:error', { error: 'This room is already full or closed' });
        return;
      }
      if (match.players[0].id === user.id) {
        this.joinUserSocketsToMatch(user.id, match.matchId);
        await this.broadcastMatchState(match);
        return;
      }

      await dequeuePlayer(user.id);
      const freshSelf = (await getUserById(user.id)) || user;
      match.players[1] = { ...toPlayerSummary(freshSelf, true, 0), ready: false };
      match.status = 'ready_check';
      match.lastEventText = `${freshSelf.displayName} joined the room!`;

      await saveMatchState(match);
      await setUserActiveMatchId(freshSelf.id, match.matchId);
      await createMatchRecord({
        id: match.matchId,
        gameId: match.gameId,
        mode: 'private',
        roomCode: match.roomCode,
        player1Id: match.players[0].id,
        player2Id: freshSelf.id
      });

      this.joinUserSocketsToMatch(freshSelf.id, match.matchId);
      this.scheduleReadyTimer(match);
      await this.broadcastMatchState(match);
    } finally {
      await releaseLock(lockKey);
    }
  }

  private async handleRoomCancel(socket: AuthedSocket, raw: any) {
    const user = socket.user!;
    const matchId = String(raw?.matchId || (await getUserActiveMatchId(user.id)) || '');
    if (!matchId) return;
    const match = await getMatchState(matchId);
    if (!match || match.players[0]?.id !== user.id) return;
    if (match.status !== 'waiting_opponent' && match.status !== 'ready_check') return;

    this.clearMatchTimers(matchId);
    match.status = 'abandoned';
    await saveMatchState(match);
    if (match.roomCode) await deleteRoomMapping(match.roomCode);
    if (match.players[0]) await clearUserActiveMatchId(match.players[0].id);
    if (match.players[1]) await clearUserActiveMatchId(match.players[1].id);
    this.io.to(`match:${matchId}`).emit('match:abandoned', {
      matchId,
      reason: 'Room closed by host'
    });
    await deleteMatchState(matchId);
  }

  private async handleInviteFriend(socket: AuthedSocket, raw: any) {
    const user = socket.user!;
    const friendUserId = String(raw?.friendUserId || '');
    const roomCode = String(raw?.roomCode || '').trim().toUpperCase();
    const gameId = raw?.gameId as GameId;
    if (!friendUserId || !roomCode || !VALID_GAME_IDS.has(gameId)) {
      socket.emit('match:error', { error: 'Invalid invite request' });
      return;
    }

    const notif = await createNotification({
      userId: friendUserId,
      type: 'match_invite',
      title: `${user.displayName} challenged you!`,
      message: `Join ${GAME_MAP[gameId].name} room ${roomCode}`,
      payload: { roomCode, gameId, fromUserId: user.id, fromName: user.displayName }
    });
    this.emitToUser(friendUserId, 'notification:new', notif);
    socket.emit('room:invited', { friendUserId, roomCode });
  }

  private async handleMatchReady(socket: AuthedSocket, raw: any) {
    const user = socket.user!;
    const matchId = String(raw?.matchId || '');
    const lockKey = `match:${matchId}`;
    if (!(await acquireLock(lockKey, 4))) return;

    try {
      const match = await getMatchState(matchId);
      if (!match || match.status !== 'ready_check') return;
      const pIdx = this.getPlayerIndex(match, user.id);
      if (pIdx === -1 || !match.players[pIdx]) return;

      match.players[pIdx]!.ready = true;
      if (match.players[0]?.ready && match.players[1]?.ready) {
        await this.startActiveMatch(match);
      } else {
        await saveMatchState(match);
        await this.broadcastMatchState(match);
      }
    } finally {
      await releaseLock(lockKey);
    }
  }

  private async startActiveMatch(match: ActiveMatchState) {
    this.clearMatchTimers(match.matchId);
    match.status = 'active';
    match.startedAt = Date.now();
    match.turnDeadline = Date.now() + match.turnSeconds * 1000;
    match.lastEventText = 'Match started — Good luck!';
    if (match.roomCode) {
      await deleteRoomMapping(match.roomCode);
    }
    await saveMatchState(match);
    this.scheduleTurnTimer(match);
    await this.broadcastMatchState(match);
  }

  private async handleMatchMove(socket: AuthedSocket, raw: any) {
    const user = socket.user!;
    if (!this.moveLimiter.consume(`mv:${user.id}`)) {
      socket.emit('match:error', { error: 'Move rate limit exceeded' });
      return;
    }

    const matchId = String(raw?.matchId || '');
    const expectedSeq = typeof raw?.expectedSeq === 'number' ? raw.expectedSeq : null;
    const lockKey = `match:${matchId}`;
    if (!(await acquireLock(lockKey, 4))) {
      socket.emit('match:error', { error: 'Previous move still processing' });
      return;
    }

    try {
      const match = await getMatchState(matchId);
      if (!match || match.status !== 'active') {
        socket.emit('match:error', { error: 'Match is not active' });
        return;
      }
      const pIdx = this.getPlayerIndex(match, user.id);
      if (pIdx === -1 || !match.players[0] || !match.players[1]) {
        socket.emit('match:error', { error: 'You are not a participant in this match' });
        return;
      }
      if (expectedSeq !== null && expectedSeq !== match.moveSequence) {
        socket.emit('match:error', { error: 'Out-of-sync move sequence ignored' });
        await this.sendSanitizedStateToSocket(socket, match, pIdx);
        return;
      }

      const engine = getGameEngine(match.gameId);
      const canAct = engine.canPlayerAct
        ? engine.canPlayerAct(match.gameState, pIdx, match.currentTurnIndex)
        : pIdx === match.currentTurnIndex;
      if (!canAct) {
        socket.emit('match:error', { error: 'It is not your turn' });
        return;
      }

      const result = engine.applyMove(match.gameState, pIdx, match.currentTurnIndex, raw?.move);
      match.gameState = result.state;
      match.currentTurnIndex = result.nextTurnIndex;
      match.players[0].score = result.scores[0];
      match.players[1].score = result.scores[1];
      match.moveSequence += 1;
      match.drawOfferBy = null;
      match.lastEventText = result.eventText || undefined;

      if (result.finished) {
        await this.finalizeMatch(
          match,
          result.winnerIndex,
          result.isDraw,
          result.isDraw ? 'draw' : 'normal_win',
          result.eventText
        );
      } else {
        match.turnDeadline = Date.now() + match.turnSeconds * 1000;
        await saveMatchState(match);
        this.scheduleTurnTimer(match);
        await this.broadcastMatchState(match);
      }
    } catch (err) {
      if (err instanceof InvalidMoveError) {
        socket.emit('match:error', { error: err.message });
      } else {
        console.error('[Socket] Unexpected move error:', err);
        socket.emit('match:error', { error: 'Failed to process move' });
      }
    } finally {
      await releaseLock(lockKey);
    }
  }

  private async handleMatchResign(socket: AuthedSocket, raw: any) {
    const user = socket.user!;
    const matchId = String(raw?.matchId || '');
    const lockKey = `match:${matchId}`;
    if (!(await acquireLock(lockKey, 4))) return;

    try {
      const match = await getMatchState(matchId);
      if (!match || match.status !== 'active') return;
      const pIdx = this.getPlayerIndex(match, user.id);
      if (pIdx === -1) return;
      const oppIdx: 0 | 1 = pIdx === 0 ? 1 : 0;
      await this.finalizeMatch(
        match,
        oppIdx,
        false,
        'resign',
        `${match.players[pIdx]?.displayName} resigned.`
      );
    } finally {
      await releaseLock(lockKey);
    }
  }

  private async handleOfferDraw(socket: AuthedSocket, raw: any) {
    const user = socket.user!;
    const matchId = String(raw?.matchId || '');
    const match = await getMatchState(matchId);
    if (!match || match.status !== 'active') return;
    if (!GAME_MAP[match.gameId].supportsDrawOffer) return;
    const pIdx = this.getPlayerIndex(match, user.id);
    if (pIdx === -1) return;
    match.drawOfferBy = pIdx;
    match.lastEventText = `${match.players[pIdx]?.displayName} offered a draw`;
    await saveMatchState(match);
    await this.broadcastMatchState(match);
  }

  private async handleRespondDraw(socket: AuthedSocket, raw: any) {
    const user = socket.user!;
    const matchId = String(raw?.matchId || '');
    const accept = Boolean(raw?.accept);
    const lockKey = `match:${matchId}`;
    if (!(await acquireLock(lockKey, 4))) return;

    try {
      const match = await getMatchState(matchId);
      if (!match || match.status !== 'active' || match.drawOfferBy === null) return;
      const pIdx = this.getPlayerIndex(match, user.id);
      if (pIdx === -1 || pIdx === match.drawOfferBy) return;

      if (accept) {
        await this.finalizeMatch(match, null, true, 'draw_agreement', 'Draw agreed by both players.');
      } else {
        match.drawOfferBy = null;
        match.lastEventText = 'Draw offer declined.';
        await saveMatchState(match);
        await this.broadcastMatchState(match);
      }
    } finally {
      await releaseLock(lockKey);
    }
  }

  private async handleMatchEmote(socket: AuthedSocket, raw: any) {
    const user = socket.user!;
    if (!this.actionLimiter.consume(`emo:${user.id}`)) return;
    const matchId = String(raw?.matchId || '');
    const emote = String(raw?.emote || '').slice(0, 24);
    if (!emote) return;
    const match = await getMatchState(matchId);
    if (!match) return;
    const pIdx = this.getPlayerIndex(match, user.id);
    if (pIdx === -1) return;

    this.io.to(`match:${matchId}`).emit('match:emote', {
      matchId,
      fromPlayerIndex: pIdx,
      emote
    });
  }

  private async handleRematchRequest(socket: AuthedSocket, raw: any) {
    const user = socket.user!;
    const matchId = String(raw?.matchId || '');
    const lockKey = `match:${matchId}`;
    if (!(await acquireLock(lockKey, 4))) return;

    try {
      const match = await getMatchState(matchId);
      if (!match || match.status !== 'completed' || !match.players[0] || !match.players[1]) return;
      const pIdx = this.getPlayerIndex(match, user.id);
      if (pIdx === -1) return;

      match.rematchRequests[pIdx] = true;
      if (match.rematchRequests[0] && match.rematchRequests[1]) {
        // Swap player slots for fair turn rotation in rematch
        const u0 = await getUserById(match.players[1].id);
        const u1 = await getUserById(match.players[0].id);
        if (!u0 || !u1) return;

        const configs = await getGameConfigs();
        const gCfg = configs.find((c) => c.gameId === match.gameId);
        const turnSeconds = gCfg?.turnSeconds || GAME_MAP[match.gameId].defaultTurnSeconds;

        const nextMatch = await this.createMatchInstance({
          gameId: match.gameId,
          mode: match.mode,
          roomCode: null,
          p0: u0,
          p1: u1,
          turnSeconds,
          autoStart: true
        });
        this.joinUserSocketsToMatch(u0.id, nextMatch.matchId);
        this.joinUserSocketsToMatch(u1.id, nextMatch.matchId);
        this.scheduleTurnTimer(nextMatch);
        this.io.to(`match:${match.matchId}`).emit('match:rematch_started', {
          oldMatchId: match.matchId,
          newMatchId: nextMatch.matchId
        });
        await this.broadcastMatchState(nextMatch);
      } else {
        await saveMatchState(match);
        await this.broadcastMatchState(match);
      }
    } finally {
      await releaseLock(lockKey);
    }
  }

  private async handleLeavePostgame(socket: AuthedSocket, raw: any) {
    const user = socket.user!;
    const matchId = String(raw?.matchId || '');
    const current = await getUserActiveMatchId(user.id);
    if (current === matchId) {
      await clearUserActiveMatchId(user.id);
    }
    socket.leave(`match:${matchId}`);
  }

  private async createMatchInstance(input: {
    gameId: GameId;
    mode: 'public' | 'private';
    roomCode: string | null;
    p0: UserProfile;
    p1: UserProfile;
    turnSeconds: number;
    autoStart?: boolean;
  }): Promise<ActiveMatchState> {
    const matchId = crypto.randomUUID();
    const engine = getGameEngine(input.gameId);
    const now = Date.now();
    const match: ActiveMatchState = {
      matchId,
      gameId: input.gameId,
      mode: input.mode,
      roomCode: input.roomCode,
      status: input.autoStart ? 'active' : 'ready_check',
      players: [
        { ...toPlayerSummary(input.p0, this.isUserOnline(input.p0.id), 0), ready: Boolean(input.autoStart) },
        { ...toPlayerSummary(input.p1, this.isUserOnline(input.p1.id), 0), ready: Boolean(input.autoStart) }
      ],
      currentTurnIndex: 0,
      turnSeconds: input.turnSeconds,
      turnDeadline: input.autoStart ? now + input.turnSeconds * 1000 : null,
      startedAt: input.autoStart ? now : null,
      endedAt: null,
      winnerIndex: null,
      isDraw: false,
      endReason: null,
      moveSequence: 0,
      drawOfferBy: null,
      rematchRequests: [false, false],
      gameState: engine.createInitialState(),
      lastEventText: input.autoStart ? 'Rematch started!' : 'Opponent found! Click Ready to start.'
    };

    await saveMatchState(match);
    await setUserActiveMatchId(input.p0.id, matchId);
    await setUserActiveMatchId(input.p1.id, matchId);
    await createMatchRecord({
      id: matchId,
      gameId: input.gameId,
      mode: input.mode,
      roomCode: input.roomCode,
      player1Id: input.p0.id,
      player2Id: input.p1.id
    });
    return match;
  }

  private async finalizeMatch(
    match: ActiveMatchState,
    winnerIndex: 0 | 1 | null,
    isDraw: boolean,
    endReason: MatchEndReason,
    eventText?: string
  ) {
    if (match.status === 'completed' || match.status === 'abandoned') return;
    this.clearMatchTimers(match.matchId);
    if (match.players[0]) this.clearDisconnectTimer(match.matchId, match.players[0].id);
    if (match.players[1]) this.clearDisconnectTimer(match.matchId, match.players[1].id);
    if (match.roomCode) await deleteRoomMapping(match.roomCode);

    match.status = 'completed';
    match.endedAt = Date.now();
    match.turnDeadline = null;
    match.winnerIndex = isDraw ? null : winnerIndex;
    match.isDraw = isDraw;
    match.endReason = endReason;
    if (eventText) match.lastEventText = eventText;

    const p0 = match.players[0];
    const p1 = match.players[1];
    if (!p0 || !p1) {
      await saveMatchState(match);
      if (p0) await clearUserActiveMatchId(p0.id);
      return;
    }

    const configs = await getGameConfigs();
    const mult = configs.find((c) => c.gameId === match.gameId)?.xpMultiplier || 1;
    const baseWin = Math.round(100 * mult);
    const baseDraw = Math.round(45 * mult);
    const baseLoss = Math.round(25 * mult);

    const xpAwarded: [number, number] = isDraw
      ? [baseDraw, baseDraw]
      : winnerIndex === 0
        ? [baseWin, baseLoss]
        : [baseLoss, baseWin];

    const durationMs = match.startedAt ? Math.max(1000, match.endedAt - match.startedAt) : 0;
    const scores: [number, number] = [p0.score, p1.score];

    await saveMatchState(match);
    await clearUserActiveMatchId(p0.id);
    await clearUserActiveMatchId(p1.id);

    const { unlockedByPlayer } = await recordMatchResult({
      matchId: match.matchId,
      gameId: match.gameId,
      mode: match.mode,
      roomCode: match.roomCode,
      player1Id: p0.id,
      player2Id: p1.id,
      winnerIndex: match.winnerIndex,
      isDraw,
      endReason,
      scores,
      xpAwarded,
      durationMs,
      finalState: match.gameState
    });

    await this.broadcastMatchState(match);

    const summary: MatchResultSummary = {
      matchId: match.matchId,
      gameId: match.gameId,
      winnerIndex: match.winnerIndex,
      isDraw,
      endReason,
      scores,
      xpAwarded,
      durationMs,
      unlockedAchievements: unlockedByPlayer
    };

    this.io.to(`match:${match.matchId}`).emit('match:ended', summary);
  }

  private joinUserSocketsToMatch(userId: string, matchId: string) {
    const sIds = this.userSockets.get(userId);
    if (!sIds) return;
    for (const sId of sIds) {
      const sock = this.io.sockets.sockets.get(sId);
      sock?.join(`match:${matchId}`);
    }
  }

  private async broadcastMatchState(match: ActiveMatchState) {
    const engine = getGameEngine(match.gameId);
    if (match.players[0]) {
      const s0 = {
        ...match,
        gameState: engine.sanitizeForPlayer(match.gameState, 0)
      };
      this.emitToUser(match.players[0].id, 'match:state', s0);
    }
    if (match.players[1]) {
      const s1 = {
        ...match,
        gameState: engine.sanitizeForPlayer(match.gameState, 1)
      };
      this.emitToUser(match.players[1].id, 'match:state', s1);
    }
  }

  private async sendSanitizedStateToSocket(socket: AuthedSocket, match: ActiveMatchState, pIdx: 0 | 1) {
    const engine = getGameEngine(match.gameId);
    socket.emit('match:state', {
      ...match,
      gameState: engine.sanitizeForPlayer(match.gameState, pIdx)
    });
  }

  public async getAdminLiveMatchesSummary() {
    const matches = await getAllActiveMatches();
    return matches.map((m) => ({
      matchId: m.matchId,
      gameId: m.gameId,
      mode: m.mode,
      roomCode: m.roomCode,
      status: m.status,
      player1: m.players[0]?.displayName || 'Unknown',
      player2: m.players[1]?.displayName || 'Waiting...',
      scores: [m.players[0]?.score || 0, m.players[1]?.score || 0],
      moveSequence: m.moveSequence,
      startedAt: m.startedAt
    }));
  }
}

