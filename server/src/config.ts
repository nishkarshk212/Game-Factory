import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const parseCommaList = (val: string | undefined): string[] =>
  (val || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 3001),
  publicWebappUrl: process.env.PUBLIC_WEBAPP_URL || 'http://localhost:5173',
  clientOrigins: parseCommaList(process.env.CLIENT_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173'),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME || 'GameVerseSonicBot',
  telegramMiniAppShortName: process.env.TELEGRAM_MINI_APP_SHORT_NAME || 'gameverse',
  jwtSecret: process.env.JWT_SECRET || 'gameverse-sonic-network-dev-secret-change-me',
  allowDevAuth: (process.env.ALLOW_DEV_AUTH ?? 'true').toLowerCase() !== 'false',
  adminTelegramIds: new Set(parseCommaList(process.env.ADMIN_TELEGRAM_IDS || '100001')),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/gameverse',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  allowInMemoryRedisFallback: (process.env.ALLOW_IN_MEMORY_REDIS_FALLBACK ?? 'true').toLowerCase() !== 'false',
  reconnectGraceSeconds: Number(process.env.RECONNECT_GRACE_SECONDS || 45),
  readyTimeoutSeconds: Number(process.env.READY_TIMEOUT_SECONDS || 30),
  rematchTtlSeconds: 90
};

