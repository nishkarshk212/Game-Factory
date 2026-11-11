import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { verifyTelegramInitData } from '../auth/telegram.js';
import { signSessionToken } from '../auth/jwt.js';
import { authMiddleware, type AuthenticatedRequest } from '../auth/middleware.js';
import { getPlatformSettings, upsertTelegramUser } from '../db/repository.js';

const DEV_PRESETS: Record<string, { telegramId: string; firstName: string; lastName: string; username: string }> = {
  player1: { telegramId: '100001', firstName: 'Nova', lastName: 'Sonic', username: 'nova_sonic' },
  player2: { telegramId: '100002', firstName: 'Aria', lastName: 'Pulse', username: 'aria_pulse' },
  admin: { telegramId: '100001', firstName: 'Sonic', lastName: 'Admin', username: 'sonic_admin' }
};

export function createAuthRouter(): Router {
  const router = Router();

  router.post('/telegram', async (req, res) => {
    try {
      const schema = z.object({ initData: z.string().min(1) });
      const { initData } = schema.parse(req.body);
      const verified = verifyTelegramInitData(initData, config.telegramBotToken);
      const user = await upsertTelegramUser({
        telegramId: String(verified.user.id),
        username: verified.user.username || null,
        firstName: verified.user.first_name,
        lastName: verified.user.last_name || null,
        photoUrl: verified.user.photo_url || null
      });
      if (user.isBanned) {
        res.status(403).json({ error: 'Your account has been suspended' });
        return;
      }
      const token = signSessionToken({ sub: user.id, tgId: user.telegramId, role: user.role });
      res.json({ token, user, startParam: verified.startParam || null });
    } catch (err) {
      res.status(401).json({ error: err instanceof Error ? err.message : 'Telegram authentication failed' });
    }
  });

  router.post('/browser-session', async (req, res) => {
    if (!config.allowDevAuth) {
      res.status(403).json({ error: 'Browser sandbox authentication is disabled in production' });
      return;
    }
    try {
      const schema = z.object({
        preset: z.enum(['player1', 'player2', 'admin']).optional(),
        telegramId: z.string().min(3).max(32).optional(),
        firstName: z.string().min(1).max(40).optional(),
        username: z.string().min(2).max(32).optional()
      });
      const body = schema.parse(req.body || {});
      const presetData = body.preset ? DEV_PRESETS[body.preset] : null;
      const tgId = presetData?.telegramId || body.telegramId || `9${Math.floor(10000 + Math.random() * 89999)}`;
      const firstName = presetData?.firstName || body.firstName || 'Guest';
      const lastName = presetData?.lastName || 'Gamer';
      const username = presetData?.username || body.username || `player_${tgId.slice(-4)}`;

      const user = await upsertTelegramUser({
        telegramId: tgId,
        username,
        firstName,
        lastName,
        photoUrl: null
      });
      if (user.isBanned) {
        res.status(403).json({ error: 'Account suspended' });
        return;
      }
      const token = signSessionToken({ sub: user.id, tgId: user.telegramId, role: user.role });
      res.json({ token, user, devMode: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create session' });
    }
  });

  router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res) => {
    const settings = await getPlatformSettings();
    res.json({
      user: req.user,
      platform: settings,
      telegramBotUsername: config.telegramBotUsername,
      telegramAppShortName: config.telegramMiniAppShortName,
      allowDevAuth: config.allowDevAuth
    });
  });

  return router;
}

