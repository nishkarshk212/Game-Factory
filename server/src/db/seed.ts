import { GAME_CATALOG } from '@gameverse/shared';
import { pool } from './pool.js';

const DEFAULT_ACHIEVEMENTS = [
  { code: 'first_match', title: 'First Kickoff', description: 'Complete your very first 2-player match on Sonic Network.', icon: '🎮', xpReward: 50 },
  { code: 'first_win', title: 'First Victory', description: 'Win your first multiplayer match.', icon: '🏆', xpReward: 100 },
  { code: 'streak_3', title: 'Hat-Trick Surge', description: 'Achieve a 3-match win streak.', icon: '🔥', xpReward: 150 },
  { code: 'streak_5', title: 'Sonic Unstoppable', description: 'Achieve a 5-match win streak.', icon: '⚡', xpReward: 300 },
  { code: 'matches_10', title: 'Arena Regular', description: 'Play 10 multiplayer matches.', icon: '🕹️', xpReward: 150 },
  { code: 'chess_win', title: 'Grand Tactician', description: 'Win a game of Chess.', icon: '♟️', xpReward: 120 },
  { code: 'pool_win', title: 'Cue Shark', description: 'Sink the 8-Ball cleanly to win 8 Ball Pool.', icon: '🎱', xpReward: 120 },
  { code: 'carrom_win', title: 'Carrom Striker', description: 'Win a match of Carrom.', icon: '🎯', xpReward: 120 },
  { code: 'private_duel', title: 'Friendly Rivalry', description: 'Play a match in a private room with a friend.', icon: '🤝', xpReward: 80 },
  { code: 'variety_5', title: 'Sonic Explorer', description: 'Win across 5 different games.', icon: '🌟', xpReward: 250 }
];

const DEFAULT_CHALLENGES = [
  { code: 'daily_play_2', title: 'Warm-Up Arena', description: 'Play 2 multiplayer matches today', targetCount: 2, xpReward: 120, gameId: null },
  { code: 'daily_win_1', title: 'Daily Champion', description: 'Win 1 online match today', targetCount: 1, xpReward: 150, gameId: null },
  { code: 'daily_win_3', title: 'Sonic Domination', description: 'Win 3 matches across any games today', targetCount: 3, xpReward: 350, gameId: null },
  { code: 'daily_chess_win', title: 'Board Master', description: 'Win 1 Chess match today', targetCount: 1, xpReward: 200, gameId: 'chess' }
];

const FEATURED_GAMES = new Set(['chess', 'ludo', 'carrom', 'pool_8ball', 'battleship', 'sudoku']);

export async function seedDatabase(): Promise<void> {
  for (const game of GAME_CATALOG) {
    await pool.query(
      `INSERT INTO games_config (game_id, enabled, featured, xp_multiplier, turn_seconds)
       VALUES ($1, TRUE, $2, 1.0, $3)
       ON CONFLICT (game_id) DO NOTHING`,
      [game.id, FEATURED_GAMES.has(game.id), game.defaultTurnSeconds]
    );
  }

  for (const ach of DEFAULT_ACHIEVEMENTS) {
    await pool.query(
      `INSERT INTO achievements (code, title, description, icon, xp_reward)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (code) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, icon = EXCLUDED.icon, xp_reward = EXCLUDED.xp_reward`,
      [ach.code, ach.title, ach.description, ach.icon, ach.xpReward]
    );
  }

  for (const ch of DEFAULT_CHALLENGES) {
    await pool.query(
      `INSERT INTO daily_challenges (code, title, description, target_count, xp_reward, game_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (code) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, target_count = EXCLUDED.target_count, xp_reward = EXCLUDED.xp_reward, game_id = EXCLUDED.game_id`,
      [ch.code, ch.title, ch.description, ch.targetCount, ch.xpReward, ch.gameId]
    );
  }

  await pool.query(
    `INSERT INTO platform_settings (key, value)
     VALUES ('global', $1::jsonb)
     ON CONFLICT (key) DO NOTHING`,
    [
      JSON.stringify({
        maintenanceMode: false,
        maintenanceMessage: 'Sonic Network is undergoing scheduled maintenance.',
        defaultTurnSeconds: 30,
        reconnectGraceSeconds: 45,
        globalAnnouncement: 'Welcome to GameVerse – Powered by Sonic Network! Challenge friends live in 14 2-player games.',
        allowPrivateRooms: true,
        allowPublicMatchmaking: true
      })
    ]
  );
}

