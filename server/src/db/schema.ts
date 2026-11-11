import { pool } from './pool.js';

export async function runMigrations(): Promise<void> {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      telegram_id TEXT UNIQUE NOT NULL,
      username TEXT,
      first_name TEXT NOT NULL,
      last_name TEXT,
      display_name TEXT NOT NULL,
      photo_url TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      is_banned BOOLEAN NOT NULL DEFAULT FALSE,
      xp INTEGER NOT NULL DEFAULT 0,
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      draws INTEGER NOT NULL DEFAULT 0,
      win_streak INTEGER NOT NULL DEFAULT 0,
      best_streak INTEGER NOT NULL DEFAULT 0,
      favorite_games JSONB NOT NULL DEFAULT '[]'::jsonb,
      settings JSONB NOT NULL DEFAULT '{"soundEnabled":true,"soundVolume":0.7,"hapticsEnabled":true,"theme":"dark","showMoveHints":true,"compactBoard":false}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_users_xp ON users (xp DESC);
    CREATE INDEX IF NOT EXISTS idx_users_tg ON users (telegram_id);

    CREATE TABLE IF NOT EXISTS matches (
      id UUID PRIMARY KEY,
      game_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      room_code TEXT,
      player1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      player2_id UUID REFERENCES users(id) ON DELETE CASCADE,
      winner_id UUID REFERENCES users(id) ON DELETE SET NULL,
      is_draw BOOLEAN NOT NULL DEFAULT FALSE,
      status TEXT NOT NULL,
      end_reason TEXT,
      player1_score INTEGER NOT NULL DEFAULT 0,
      player2_score INTEGER NOT NULL DEFAULT 0,
      player1_xp INTEGER NOT NULL DEFAULT 0,
      player2_xp INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      final_state JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_matches_p1 ON matches (player1_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_matches_p2 ON matches (player2_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_matches_game ON matches (game_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS friendships (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (requester_id, addressee_id)
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT NOT NULL,
      xp_reward INTEGER NOT NULL DEFAULT 50
    );

    CREATE TABLE IF NOT EXISTS user_achievements (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
      unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, achievement_id)
    );

    CREATE TABLE IF NOT EXISTS daily_challenges (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      target_count INTEGER NOT NULL,
      xp_reward INTEGER NOT NULL,
      game_id TEXT
    );

    CREATE TABLE IF NOT EXISTS user_daily_challenges (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      challenge_id UUID NOT NULL REFERENCES daily_challenges(id) ON DELETE CASCADE,
      challenge_date DATE NOT NULL DEFAULT CURRENT_DATE,
      progress INTEGER NOT NULL DEFAULT 0,
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      claimed BOOLEAN NOT NULL DEFAULT FALSE,
      PRIMARY KEY (user_id, challenge_id, challenge_date)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reported_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
      reason TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS games_config (
      game_id TEXT PRIMARY KEY,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      featured BOOLEAN NOT NULL DEFAULT FALSE,
      xp_multiplier REAL NOT NULL DEFAULT 1.0,
      turn_seconds INTEGER NOT NULL DEFAULT 30,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

