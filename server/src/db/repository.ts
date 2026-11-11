import {
  calculateRank,
  type AchievementItem,
  type DailyChallengeItem,
  type FriendItem,
  type GameAdminConfig,
  type GameId,
  type LeaderboardEntry,
  type MatchEndReason,
  type MatchHistoryItem,
  type MatchMode,
  type NotificationItem,
  type PlatformSettings,
  type PlayerSummary,
  type ReportItem,
  type UserProfile,
  type UserRole,
  type UserSettings
} from '@gameverse/shared';
import { pool } from './pool.js';
import { config } from '../config.js';

const DEFAULT_USER_SETTINGS: UserSettings = {
  soundEnabled: true,
  soundVolume: 0.7,
  hapticsEnabled: true,
  theme: 'dark',
  showMoveHints: true,
  compactBoard: false
};

function mapUserRow(row: any): UserProfile {
  const settings: UserSettings = { ...DEFAULT_USER_SETTINGS, ...(row.settings || {}) };
  const favoriteGames: GameId[] = Array.isArray(row.favorite_games) ? row.favorite_games : [];
  return {
    id: row.id,
    telegramId: String(row.telegram_id),
    username: row.username ?? null,
    firstName: row.first_name,
    lastName: row.last_name ?? null,
    displayName: row.display_name,
    photoUrl: row.photo_url ?? null,
    role: (row.role === 'admin' ? 'admin' : 'user') as UserRole,
    isBanned: Boolean(row.is_banned),
    xp: Number(row.xp || 0),
    wins: Number(row.wins || 0),
    losses: Number(row.losses || 0),
    draws: Number(row.draws || 0),
    winStreak: Number(row.win_streak || 0),
    bestStreak: Number(row.best_streak || 0),
    favoriteGames,
    settings,
    rank: calculateRank(Number(row.xp || 0)),
    createdAt: new Date(row.created_at).toISOString(),
    lastSeenAt: new Date(row.last_seen_at).toISOString()
  };
}

export function toPlayerSummary(user: UserProfile, online = true, score = 0): PlayerSummary {
  return {
    id: user.id,
    telegramId: user.telegramId,
    username: user.username,
    displayName: user.displayName,
    photoUrl: user.photoUrl,
    xp: user.xp,
    rank: user.rank,
    wins: user.wins,
    losses: user.losses,
    draws: user.draws,
    online,
    score
  };
}

export async function upsertTelegramUser(input: {
  telegramId: string;
  username?: string | null;
  firstName: string;
  lastName?: string | null;
  photoUrl?: string | null;
}): Promise<UserProfile> {
  const displayName = [input.firstName, input.lastName].filter(Boolean).join(' ').trim() || input.username || `Player ${input.telegramId}`;
  const isEnvAdmin = config.adminTelegramIds.has(String(input.telegramId));

  const res = await pool.query(
    `INSERT INTO users (telegram_id, username, first_name, last_name, display_name, photo_url, role, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (telegram_id) DO UPDATE SET
       username = COALESCE(EXCLUDED.username, users.username),
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       display_name = EXCLUDED.display_name,
       photo_url = COALESCE(EXCLUDED.photo_url, users.photo_url),
       role = CASE WHEN $8 THEN 'admin' ELSE users.role END,
       last_seen_at = NOW()
     RETURNING *`,
    [
      String(input.telegramId),
      input.username || null,
      input.firstName,
      input.lastName || null,
      displayName,
      input.photoUrl || null,
      isEnvAdmin ? 'admin' : 'user',
      isEnvAdmin
    ]
  );
  return mapUserRow(res.rows[0]);
}

export async function getUserById(userId: string): Promise<UserProfile | null> {
  const res = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
  if (res.rowCount === 0) return null;
  return mapUserRow(res.rows[0]);
}

export async function getUsersByIds(ids: string[]): Promise<UserProfile[]> {
  if (!ids.length) return [];
  const res = await pool.query('SELECT * FROM users WHERE id = ANY($1::uuid[])', [ids]);
  return res.rows.map(mapUserRow);
}

export async function touchUserLastSeen(userId: string): Promise<void> {
  await pool.query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [userId]);
}

export async function updateUserSettings(userId: string, patch: Partial<UserSettings>): Promise<UserProfile | null> {
  const current = await getUserById(userId);
  if (!current) return null;
  const merged = { ...current.settings, ...patch };
  const res = await pool.query(
    'UPDATE users SET settings = $2::jsonb WHERE id = $1 RETURNING *',
    [userId, JSON.stringify(merged)]
  );
  return res.rowCount ? mapUserRow(res.rows[0]) : null;
}

export async function toggleFavoriteGame(userId: string, gameId: GameId): Promise<GameId[]> {
  const current = await getUserById(userId);
  if (!current) return [];
  const set = new Set<GameId>(current.favoriteGames);
  if (set.has(gameId)) set.delete(gameId);
  else set.add(gameId);
  const next = Array.from(set);
  await pool.query('UPDATE users SET favorite_games = $2::jsonb WHERE id = $1', [
    userId,
    JSON.stringify(next)
  ]);
  return next;
}

export async function searchUsers(queryText: string, excludeUserId: string): Promise<UserProfile[]> {
  const clean = `%${queryText.trim()}%`;
  const res = await pool.query(
    `SELECT * FROM users
     WHERE id <> $1 AND is_banned = FALSE
       AND (display_name ILIKE $2 OR username ILIKE $2 OR telegram_id ILIKE $2)
     ORDER BY xp DESC
     LIMIT 20`,
    [excludeUserId, clean]
  );
  return res.rows.map(mapUserRow);
}

export async function getGameConfigs(): Promise<GameAdminConfig[]> {
  const res = await pool.query('SELECT * FROM games_config ORDER BY game_id ASC');
  return res.rows.map((r) => ({
    gameId: r.game_id as GameId,
    enabled: Boolean(r.enabled),
    featured: Boolean(r.featured),
    xpMultiplier: Number(r.xp_multiplier || 1),
    turnSeconds: Number(r.turn_seconds || 30),
    updatedAt: new Date(r.updated_at).toISOString()
  }));
}

export async function updateGameConfig(
  gameId: GameId,
  patch: Partial<Pick<GameAdminConfig, 'enabled' | 'featured' | 'xpMultiplier' | 'turnSeconds'>>
): Promise<GameAdminConfig | null> {
  const res = await pool.query(
    `UPDATE games_config SET
       enabled = COALESCE($2, enabled),
       featured = COALESCE($3, featured),
       xp_multiplier = COALESCE($4, xp_multiplier),
       turn_seconds = COALESCE($5, turn_seconds),
       updated_at = NOW()
     WHERE game_id = $1
     RETURNING *`,
    [
      gameId,
      patch.enabled ?? null,
      patch.featured ?? null,
      patch.xpMultiplier ?? null,
      patch.turnSeconds ?? null
    ]
  );
  if (!res.rowCount) return null;
  const r = res.rows[0];
  return {
    gameId: r.game_id as GameId,
    enabled: Boolean(r.enabled),
    featured: Boolean(r.featured),
    xpMultiplier: Number(r.xp_multiplier || 1),
    turnSeconds: Number(r.turn_seconds || 30),
    updatedAt: new Date(r.updated_at).toISOString()
  };
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const res = await pool.query(`SELECT value FROM platform_settings WHERE key = 'global'`);
  const defaults: PlatformSettings = {
    maintenanceMode: false,
    maintenanceMessage: 'Sonic Network is undergoing maintenance.',
    defaultTurnSeconds: 30,
    reconnectGraceSeconds: 45,
    globalAnnouncement: '',
    allowPrivateRooms: true,
    allowPublicMatchmaking: true
  };
  if (!res.rowCount) return defaults;
  return { ...defaults, ...(res.rows[0].value || {}) };
}

export async function updatePlatformSettings(patch: Partial<PlatformSettings>): Promise<PlatformSettings> {
  const current = await getPlatformSettings();
  const next = { ...current, ...patch };
  await pool.query(
    `INSERT INTO platform_settings (key, value, updated_at)
     VALUES ('global', $1::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [JSON.stringify(next)]
  );
  return next;
}

export async function createMatchRecord(input: {
  id: string;
  gameId: GameId;
  mode: MatchMode;
  roomCode: string | null;
  player1Id: string;
  player2Id: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO matches (id, game_id, mode, room_code, player1_id, player2_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'active')
     ON CONFLICT (id) DO NOTHING`,
    [input.id, input.gameId, input.mode, input.roomCode, input.player1Id, input.player2Id]
  );
}

export async function recordMatchResult(input: {
  matchId: string;
  gameId: GameId;
  mode: MatchMode;
  roomCode: string | null;
  player1Id: string;
  player2Id: string;
  winnerIndex: 0 | 1 | null;
  isDraw: boolean;
  endReason: MatchEndReason;
  scores: [number, number];
  xpAwarded: [number, number];
  durationMs: number;
  finalState: unknown;
}): Promise<{ unlockedByPlayer: Record<string, AchievementItem[]> }> {
  const client = await pool.connect();
  const unlockedByPlayer: Record<string, AchievementItem[]> = {
    [input.player1Id]: [],
    [input.player2Id]: []
  };

  try {
    await client.query('BEGIN');

    const winnerId =
      input.isDraw || input.winnerIndex === null
        ? null
        : input.winnerIndex === 0
          ? input.player1Id
          : input.player2Id;

    await client.query(
      `INSERT INTO matches (
         id, game_id, mode, room_code, player1_id, player2_id, winner_id, is_draw,
         status, end_reason, player1_score, player2_score, player1_xp, player2_xp,
         duration_ms, final_state, ended_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed', $9, $10, $11, $12, $13, $14, $15::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET
         winner_id = EXCLUDED.winner_id,
         is_draw = EXCLUDED.is_draw,
         status = 'completed',
         end_reason = EXCLUDED.end_reason,
         player1_score = EXCLUDED.player1_score,
         player2_score = EXCLUDED.player2_score,
         player1_xp = EXCLUDED.player1_xp,
         player2_xp = EXCLUDED.player2_xp,
         duration_ms = EXCLUDED.duration_ms,
         final_state = EXCLUDED.final_state,
         ended_at = NOW()`,
      [
        input.matchId,
        input.gameId,
        input.mode,
        input.roomCode,
        input.player1Id,
        input.player2Id,
        winnerId,
        input.isDraw,
        input.endReason,
        input.scores[0],
        input.scores[1],
        input.xpAwarded[0],
        input.xpAwarded[1],
        Math.max(0, Math.round(input.durationMs)),
        JSON.stringify(input.finalState ?? {})
      ]
    );

    const playerIds = [input.player1Id, input.player2Id];
    for (let idx = 0; idx < 2; idx++) {
      const uid = playerIds[idx];
      const won = !input.isDraw && input.winnerIndex === idx;
      const lost = !input.isDraw && input.winnerIndex !== null && input.winnerIndex !== idx;
      const draw = input.isDraw;
      const gainedXp = input.xpAwarded[idx];

      const uRes = await client.query(
        `UPDATE users SET
           xp = xp + $2,
           wins = wins + $3,
           losses = losses + $4,
           draws = draws + $5,
           win_streak = CASE WHEN $3 = 1 THEN win_streak + 1 WHEN $4 = 1 THEN 0 ELSE win_streak END,
           best_streak = GREATEST(best_streak, CASE WHEN $3 = 1 THEN win_streak + 1 ELSE win_streak END),
           last_seen_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [uid, gainedXp, won ? 1 : 0, lost ? 1 : 0, draw ? 1 : 0]
      );

      if (uRes.rowCount) {
        const u = uRes.rows[0];
        // Update daily challenges progress
        const challengesRes = await client.query('SELECT * FROM daily_challenges');
        for (const ch of challengesRes.rows) {
          let inc = 0;
          if (ch.code === 'daily_play_2') inc = 1;
          else if (ch.code === 'daily_win_1' && won) inc = 1;
          else if (ch.code === 'daily_win_3' && won) inc = 1;
          else if (ch.code === 'daily_chess_win' && won && input.gameId === 'chess') inc = 1;

          if (inc > 0) {
            await client.query(
              `INSERT INTO user_daily_challenges (user_id, challenge_id, challenge_date, progress, completed)
               VALUES ($1, $2, CURRENT_DATE, LEAST($3::int, $4::int), $3::int >= $4::int)
               ON CONFLICT (user_id, challenge_id, challenge_date) DO UPDATE SET
                 progress = LEAST(user_daily_challenges.progress + $3::int, $4::int),
                 completed = (user_daily_challenges.progress + $3::int) >= $4::int`,
              [uid, ch.id, Number(inc), Number(ch.target_count)]
            );
          }
        }

        // Check & unlock achievements
        const totalMatches = Number(u.wins) + Number(u.losses) + Number(u.draws);
        const candidates: string[] = [];
        if (totalMatches >= 1) candidates.push('first_match');
        if (Number(u.wins) >= 1) candidates.push('first_win');
        if (Number(u.win_streak) >= 3) candidates.push('streak_3');
        if (Number(u.win_streak) >= 5) candidates.push('streak_5');
        if (totalMatches >= 10) candidates.push('matches_10');
        if (won && input.gameId === 'chess') candidates.push('chess_win');
        if (won && input.gameId === 'pool_8ball') candidates.push('pool_win');
        if (won && input.gameId === 'carrom') candidates.push('carrom_win');
        if (input.mode === 'private') candidates.push('private_duel');

        const distinctWinsRes = await client.query(
          `SELECT COUNT(DISTINCT game_id) AS cnt FROM matches WHERE winner_id = $1`,
          [uid]
        );
        if (Number(distinctWinsRes.rows[0]?.cnt || 0) >= 5) {
          candidates.push('variety_5');
        }

        if (candidates.length) {
          const achRows = await client.query(
            `SELECT a.* FROM achievements a
             WHERE a.code = ANY($1::text[])
               AND NOT EXISTS (
                 SELECT 1 FROM user_achievements ua WHERE ua.user_id = $2 AND ua.achievement_id = a.id
               )`,
            [candidates, uid]
          );

          for (const ach of achRows.rows) {
            await client.query(
              `INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
              [uid, ach.id]
            );
            await client.query(`UPDATE users SET xp = xp + $2 WHERE id = $1`, [uid, ach.xp_reward]);
            unlockedByPlayer[uid].push({
              id: ach.id,
              code: ach.code,
              title: ach.title,
              description: ach.description,
              icon: ach.icon,
              xpReward: ach.xp_reward,
              unlocked: true,
              unlockedAt: new Date().toISOString()
            });
            await client.query(
              `INSERT INTO notifications (user_id, type, title, message, payload)
               VALUES ($1, 'achievement', $2, $3, $4::jsonb)`,
              [
                uid,
                `Achievement Unlocked: ${ach.title}`,
                `${ach.icon} ${ach.description} (+${ach.xp_reward} XP)`,
                JSON.stringify({ code: ach.code, xpReward: ach.xp_reward })
              ]
            );
          }
        }
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { unlockedByPlayer };
}

export async function getUserMatchHistory(userId: string, limit = 30): Promise<MatchHistoryItem[]> {
  const res = await pool.query(
    `SELECT m.*,
            u1.id AS u1_id, u1.display_name AS u1_name, u1.username AS u1_username, u1.photo_url AS u1_photo,
            u2.id AS u2_id, u2.display_name AS u2_name, u2.username AS u2_username, u2.photo_url AS u2_photo
     FROM matches m
     JOIN users u1 ON m.player1_id = u1.id
     LEFT JOIN users u2 ON m.player2_id = u2.id
     WHERE (m.player1_id = $1 OR m.player2_id = $1) AND m.status = 'completed'
     ORDER BY m.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return res.rows.map((r) => {
    const isP1 = r.player1_id === userId;
    const opp = isP1
      ? { id: r.u2_id, displayName: r.u2_name || 'Opponent', username: r.u2_username, photoUrl: r.u2_photo }
      : { id: r.u1_id, displayName: r.u1_name || 'Opponent', username: r.u1_username, photoUrl: r.u1_photo };

    const result: 'win' | 'loss' | 'draw' = r.is_draw
      ? 'draw'
      : r.winner_id === userId
        ? 'win'
        : 'loss';

    return {
      id: r.id,
      gameId: r.game_id as GameId,
      mode: r.mode as MatchMode,
      opponent: opp,
      result,
      myScore: Number(isP1 ? r.player1_score : r.player2_score),
      opponentScore: Number(isP1 ? r.player2_score : r.player1_score),
      xpEarned: Number(isP1 ? r.player1_xp : r.player2_xp),
      endReason: r.end_reason || 'completed',
      durationMs: Number(r.duration_ms || 0),
      createdAt: new Date(r.created_at).toISOString()
    };
  });
}

export async function getLeaderboard(gameId?: GameId | null, limit = 50): Promise<LeaderboardEntry[]> {
  if (!gameId) {
    const res = await pool.query(
      `SELECT id, display_name, username, photo_url, xp, wins, losses, draws
       FROM users
       WHERE is_banned = FALSE
       ORDER BY xp DESC, wins DESC
       LIMIT $1`,
      [limit]
    );
    return res.rows.map((r, i) => {
      const total = Number(r.wins) + Number(r.losses) + Number(r.draws);
      return {
        rankPosition: i + 1,
        userId: r.id,
        displayName: r.display_name,
        username: r.username,
        photoUrl: r.photo_url,
        xp: Number(r.xp),
        wins: Number(r.wins),
        losses: Number(r.losses),
        draws: Number(r.draws),
        winRate: total > 0 ? Math.round((Number(r.wins) / total) * 100) : 0,
        rank: calculateRank(Number(r.xp))
      };
    });
  }

  const res = await pool.query(
    `SELECT u.id, u.display_name, u.username, u.photo_url, u.xp,
            COUNT(*) FILTER (WHERE m.winner_id = u.id)::int AS g_wins,
            COUNT(*) FILTER (WHERE NOT m.is_draw AND m.winner_id IS NOT NULL AND m.winner_id <> u.id)::int AS g_losses,
            COUNT(*) FILTER (WHERE m.is_draw)::int AS g_draws,
            COALESCE(SUM(CASE WHEN m.player1_id = u.id THEN m.player1_xp ELSE m.player2_xp END), 0)::int AS g_xp
     FROM matches m
     JOIN users u ON (u.id = m.player1_id OR u.id = m.player2_id)
     WHERE m.game_id = $1 AND m.status = 'completed' AND u.is_banned = FALSE
     GROUP BY u.id
     ORDER BY g_wins DESC, g_xp DESC
     LIMIT $2`,
    [gameId, limit]
  );

  return res.rows.map((r, i) => {
    const total = Number(r.g_wins) + Number(r.g_losses) + Number(r.g_draws);
    return {
      rankPosition: i + 1,
      userId: r.id,
      displayName: r.display_name,
      username: r.username,
      photoUrl: r.photo_url,
      xp: Number(r.g_xp),
      wins: Number(r.g_wins),
      losses: Number(r.g_losses),
      draws: Number(r.g_draws),
      winRate: total > 0 ? Math.round((Number(r.g_wins) / total) * 100) : 0,
      rank: calculateRank(Number(r.xp))
    };
  });
}

export async function getUserAchievements(userId: string): Promise<AchievementItem[]> {
  const res = await pool.query(
    `SELECT a.*, ua.unlocked_at
     FROM achievements a
     LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.user_id = $1
     ORDER BY ua.unlocked_at DESC NULLS LAST, a.xp_reward ASC`,
    [userId]
  );
  return res.rows.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    description: r.description,
    icon: r.icon,
    xpReward: Number(r.xp_reward),
    unlocked: Boolean(r.unlocked_at),
    unlockedAt: r.unlocked_at ? new Date(r.unlocked_at).toISOString() : null
  }));
}

export async function getUserDailyChallenges(userId: string): Promise<DailyChallengeItem[]> {
  const res = await pool.query(
    `SELECT dc.*, COALESCE(udc.progress, 0) AS progress,
            COALESCE(udc.completed, FALSE) AS completed,
            COALESCE(udc.claimed, FALSE) AS claimed
     FROM daily_challenges dc
     LEFT JOIN user_daily_challenges udc
       ON udc.challenge_id = dc.id AND udc.user_id = $1 AND udc.challenge_date = CURRENT_DATE
     ORDER BY dc.xp_reward ASC`,
    [userId]
  );
  return res.rows.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    description: r.description,
    targetCount: Number(r.target_count),
    progress: Number(r.progress),
    completed: Boolean(r.completed),
    claimed: Boolean(r.claimed),
    xpReward: Number(r.xp_reward),
    gameId: (r.game_id as GameId | null) ?? null
  }));
}

export async function claimDailyChallenge(userId: string, challengeId: string): Promise<{ xpEarned: number } | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(
      `UPDATE user_daily_challenges udc
       SET claimed = TRUE
       FROM daily_challenges dc
       WHERE udc.challenge_id = dc.id
         AND udc.user_id = $1
         AND udc.challenge_id = $2
         AND udc.challenge_date = CURRENT_DATE
         AND udc.completed = TRUE
         AND udc.claimed = FALSE
       RETURNING dc.xp_reward`,
      [userId, challengeId]
    );
    if (!res.rowCount) {
      await client.query('ROLLBACK');
      return null;
    }
    const xpReward = Number(res.rows[0].xp_reward);
    await client.query('UPDATE users SET xp = xp + $2 WHERE id = $1', [userId, xpReward]);
    await client.query('COMMIT');
    return { xpEarned: xpReward };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getFriends(userId: string): Promise<FriendItem[]> {
  const res = await pool.query(
    `SELECT f.id AS friendship_id, f.requester_id, f.addressee_id, f.status, f.created_at,
            u.*
     FROM friendships f
     JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
     WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status IN ('pending', 'accepted')
     ORDER BY f.status ASC, f.updated_at DESC`,
    [userId]
  );

  return res.rows.map((r) => {
    const user = mapUserRow(r);
    let status: FriendItem['status'] = 'accepted';
    if (r.status === 'pending') {
      status = r.requester_id === userId ? 'pending_outgoing' : 'pending_incoming';
    }
    return {
      friendshipId: r.friendship_id,
      user: toPlayerSummary(user, false, 0),
      status,
      createdAt: new Date(r.created_at).toISOString()
    };
  });
}

export async function sendFriendRequest(requesterId: string, targetUserId: string): Promise<{ status: string }> {
  if (requesterId === targetUserId) throw new Error('Cannot add yourself as a friend');
  const existing = await pool.query(
    `SELECT * FROM friendships
     WHERE (requester_id = $1 AND addressee_id = $2)
        OR (requester_id = $2 AND addressee_id = $1)`,
    [requesterId, targetUserId]
  );

  if (existing.rowCount) {
    const row = existing.rows[0];
    if (row.status === 'accepted') return { status: 'already_friends' };
    if (row.requester_id === targetUserId && row.status === 'pending') {
      await pool.query(`UPDATE friendships SET status = 'accepted', updated_at = NOW() WHERE id = $1`, [row.id]);
      return { status: 'accepted' };
    }
    return { status: 'pending' };
  }

  await pool.query(
    `INSERT INTO friendships (requester_id, addressee_id, status) VALUES ($1, $2, 'pending')`,
    [requesterId, targetUserId]
  );
  return { status: 'pending' };
}

export async function respondFriendRequest(
  userId: string,
  friendshipId: string,
  action: 'accept' | 'decline'
): Promise<boolean> {
  if (action === 'decline') {
    const res = await pool.query(
      `DELETE FROM friendships WHERE id = $1 AND (addressee_id = $2 OR requester_id = $2)`,
      [friendshipId, userId]
    );
    return (res.rowCount || 0) > 0;
  }
  const res = await pool.query(
    `UPDATE friendships SET status = 'accepted', updated_at = NOW()
     WHERE id = $1 AND addressee_id = $2 AND status = 'pending'`,
    [friendshipId, userId]
  );
  return (res.rowCount || 0) > 0;
}

export async function createNotification(input: {
  userId: string;
  type: NotificationItem['type'];
  title: string;
  message: string;
  payload?: Record<string, unknown>;
}): Promise<NotificationItem> {
  const res = await pool.query(
    `INSERT INTO notifications (user_id, type, title, message, payload)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING *`,
    [input.userId, input.type, input.title, input.message, JSON.stringify(input.payload || {})]
  );
  const r = res.rows[0];
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    message: r.message,
    payload: r.payload || {},
    isRead: Boolean(r.is_read),
    createdAt: new Date(r.created_at).toISOString()
  };
}

export async function broadcastSystemNotification(title: string, message: string): Promise<void> {
  await pool.query(
    `INSERT INTO notifications (user_id, type, title, message, payload)
     SELECT id, 'system', $1, $2, '{}'::jsonb FROM users WHERE is_banned = FALSE`,
    [title, message]
  );
}

export async function getNotifications(userId: string, limit = 30): Promise<NotificationItem[]> {
  const res = await pool.query(
    `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return res.rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    message: r.message,
    payload: r.payload || {},
    isRead: Boolean(r.is_read),
    createdAt: new Date(r.created_at).toISOString()
  }));
}

export async function markNotificationsRead(userId: string, notificationId?: string): Promise<void> {
  if (notificationId) {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2', [
      notificationId,
      userId
    ]);
  } else {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [userId]);
  }
}

export async function createReport(input: {
  reporterId: string;
  reportedUserId: string;
  matchId?: string | null;
  reason: string;
  details: string;
}): Promise<ReportItem> {
  const res = await pool.query(
    `INSERT INTO reports (reporter_id, reported_user_id, match_id, reason, details)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [input.reporterId, input.reportedUserId, input.matchId || null, input.reason, input.details]
  );
  const r = res.rows[0];
  return {
    id: r.id,
    reporterId: r.reporter_id,
    reportedUserId: r.reported_user_id,
    matchId: r.match_id,
    reason: r.reason,
    details: r.details,
    status: r.status,
    createdAt: new Date(r.created_at).toISOString()
  };
}

export async function getAdminOverview() {
  const [usersRes, matchesRes, reportsRes, recentMatchesRes] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_banned)::int AS banned FROM users`),
    pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'completed')::int AS completed FROM matches`),
    pool.query(`SELECT COUNT(*)::int AS open FROM reports WHERE status = 'open'`),
    pool.query(
      `SELECT m.*, u1.display_name AS p1_name, u2.display_name AS p2_name
       FROM matches m
       JOIN users u1 ON m.player1_id = u1.id
       LEFT JOIN users u2 ON m.player2_id = u2.id
       ORDER BY m.created_at DESC
       LIMIT 30`
    )
  ]);

  return {
    totalUsers: Number(usersRes.rows[0]?.total || 0),
    bannedUsers: Number(usersRes.rows[0]?.banned || 0),
    totalMatches: Number(matchesRes.rows[0]?.total || 0),
    completedMatches: Number(matchesRes.rows[0]?.completed || 0),
    openReports: Number(reportsRes.rows[0]?.open || 0),
    recentMatches: recentMatchesRes.rows.map((r) => ({
      id: r.id,
      gameId: r.game_id,
      mode: r.mode,
      roomCode: r.room_code,
      player1Name: r.p1_name,
      player2Name: r.p2_name,
      status: r.status,
      endReason: r.end_reason,
      player1Score: r.player1_score,
      player2Score: r.player2_score,
      createdAt: new Date(r.created_at).toISOString()
    }))
  };
}

export async function getAdminUsers(limit = 100): Promise<UserProfile[]> {
  const res = await pool.query('SELECT * FROM users ORDER BY created_at DESC LIMIT $1', [limit]);
  return res.rows.map(mapUserRow);
}

export async function updateAdminUser(
  userId: string,
  patch: { isBanned?: boolean; role?: UserRole }
): Promise<UserProfile | null> {
  const res = await pool.query(
    `UPDATE users SET
       is_banned = COALESCE($2, is_banned),
       role = COALESCE($3, role)
     WHERE id = $1
     RETURNING *`,
    [userId, patch.isBanned ?? null, patch.role ?? null]
  );
  return res.rowCount ? mapUserRow(res.rows[0]) : null;
}

export async function getAdminReports(): Promise<ReportItem[]> {
  const res = await pool.query(
    `SELECT r.*, u1.display_name AS reporter_name, u2.display_name AS reported_name
     FROM reports r
     JOIN users u1 ON r.reporter_id = u1.id
     JOIN users u2 ON r.reported_user_id = u2.id
     ORDER BY CASE WHEN r.status = 'open' THEN 0 ELSE 1 END, r.created_at DESC
     LIMIT 100`
  );
  return res.rows.map((r) => ({
    id: r.id,
    reporterId: r.reporter_id,
    reporterName: r.reporter_name,
    reportedUserId: r.reported_user_id,
    reportedUserName: r.reported_name,
    matchId: r.match_id,
    reason: r.reason,
    details: r.details,
    status: r.status,
    createdAt: new Date(r.created_at).toISOString()
  }));
}

export async function updateReportStatus(
  reportId: string,
  status: ReportItem['status']
): Promise<ReportItem | null> {
  const res = await pool.query(
    `UPDATE reports SET status = $2 WHERE id = $1 RETURNING *`,
    [reportId, status]
  );
  if (!res.rowCount) return null;
  const r = res.rows[0];
  return {
    id: r.id,
    reporterId: r.reporter_id,
    reportedUserId: r.reported_user_id,
    matchId: r.match_id,
    reason: r.reason,
    details: r.details,
    status: r.status,
    createdAt: new Date(r.created_at).toISOString()
  };
}

