import type { ActiveMatchState, GameId } from '@gameverse/shared';
import { getRedis } from './client.js';

const KEY = {
  onlineUsers: 'gv:online_users',
  userActiveMatch: (userId: string) => `gv:user_match:${userId}`,
  userQueueGame: (userId: string) => `gv:user_queue:${userId}`,
  queue: (gameId: GameId) => `gv:queue:${gameId}`,
  match: (matchId: string) => `gv:match:${matchId}`,
  activeMatchesSet: 'gv:active_matches',
  roomCode: (code: string) => `gv:room:${code.toUpperCase()}`,
  actionLock: (scope: string) => `gv:lock:${scope}`
};

export async function acquireLock(scope: string, ttlSeconds = 5): Promise<boolean> {
  return getRedis().setIfNotExists(KEY.actionLock(scope), '1', ttlSeconds);
}

export async function releaseLock(scope: string): Promise<void> {
  await getRedis().del(KEY.actionLock(scope));
}

export async function setUserOnline(userId: string): Promise<void> {
  await getRedis().sadd(KEY.onlineUsers, userId);
}

export async function setUserOffline(userId: string): Promise<void> {
  await getRedis().srem(KEY.onlineUsers, userId);
}

export async function getOnlineUserIds(): Promise<string[]> {
  return getRedis().smembers(KEY.onlineUsers);
}

export async function getUserActiveMatchId(userId: string): Promise<string | null> {
  return getRedis().get(KEY.userActiveMatch(userId));
}

export async function setUserActiveMatchId(userId: string, matchId: string): Promise<void> {
  await getRedis().set(KEY.userActiveMatch(userId), matchId, 60 * 60 * 4);
}

export async function clearUserActiveMatchId(userId: string): Promise<void> {
  await getRedis().del(KEY.userActiveMatch(userId));
}

export async function getUserQueuedGame(userId: string): Promise<GameId | null> {
  const val = await getRedis().get(KEY.userQueueGame(userId));
  return (val as GameId | null) ?? null;
}

export async function enqueuePlayer(gameId: GameId, userId: string): Promise<void> {
  const redis = getRedis();
  await redis.set(KEY.userQueueGame(userId), gameId, 60 * 15);
  await redis.lrem(KEY.queue(gameId), userId);
  await redis.rpush(KEY.queue(gameId), userId);
}

export async function dequeuePlayer(userId: string, gameId?: GameId): Promise<void> {
  const redis = getRedis();
  const targetGame = gameId || (await getUserQueuedGame(userId));
  if (targetGame) {
    await redis.lrem(KEY.queue(targetGame), userId);
  }
  await redis.del(KEY.userQueueGame(userId));
}

export async function popMatchOpponent(gameId: GameId, selfUserId: string): Promise<string | null> {
  const redis = getRedis();
  const candidates: string[] = [];
  let popped: string | null;
  while ((popped = await redis.lpop(KEY.queue(gameId))) !== null) {
    if (popped === selfUserId) {
      continue;
    }
    const stillQueued = await getUserQueuedGame(popped);
    const activeMatch = await getUserActiveMatchId(popped);
    if (stillQueued === gameId && !activeMatch) {
      // Found valid opponent! Re-push any skipped items if needed (none here except stale entries)
      await redis.del(KEY.userQueueGame(popped));
      for (const c of candidates) {
        await redis.rpush(KEY.queue(gameId), c);
      }
      return popped;
    }
  }
  for (const c of candidates) {
    await redis.rpush(KEY.queue(gameId), c);
  }
  return null;
}

export async function getQueueSize(gameId: GameId): Promise<number> {
  const items = await getRedis().lrange(KEY.queue(gameId), 0, -1);
  return items.length;
}

export async function saveMatchState(match: ActiveMatchState): Promise<void> {
  const redis = getRedis();
  await redis.set(KEY.match(match.matchId), JSON.stringify(match), 60 * 60 * 6);
  if (match.status === 'completed' || match.status === 'abandoned') {
    await redis.srem(KEY.activeMatchesSet, match.matchId);
  } else {
    await redis.sadd(KEY.activeMatchesSet, match.matchId);
  }
}

export async function getMatchState(matchId: string): Promise<ActiveMatchState | null> {
  const raw = await getRedis().get(KEY.match(matchId));
  if (!raw) return null;
  return JSON.parse(raw) as ActiveMatchState;
}

export async function deleteMatchState(matchId: string): Promise<void> {
  const redis = getRedis();
  await redis.srem(KEY.activeMatchesSet, matchId);
  await redis.del(KEY.match(matchId));
}

export async function getAllActiveMatches(): Promise<ActiveMatchState[]> {
  const redis = getRedis();
  const ids = await redis.smembers(KEY.activeMatchesSet);
  const results: ActiveMatchState[] = [];
  for (const id of ids) {
    const m = await getMatchState(id);
    if (m && m.status !== 'completed' && m.status !== 'abandoned') {
      results.push(m);
    } else {
      await redis.srem(KEY.activeMatchesSet, id);
    }
  }
  return results;
}

export async function setRoomMapping(code: string, matchId: string): Promise<void> {
  await getRedis().set(KEY.roomCode(code), matchId, 60 * 60 * 2);
}

export async function getMatchIdByRoomCode(code: string): Promise<string | null> {
  return getRedis().get(KEY.roomCode(code));
}

export async function deleteRoomMapping(code: string): Promise<void> {
  await getRedis().del(KEY.roomCode(code));
}

