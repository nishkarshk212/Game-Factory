import { Router } from 'express';
import { z } from 'zod';
import { VALID_GAME_IDS, type GameId } from '@gameverse/shared';
import { adminMiddleware, authMiddleware } from '../auth/middleware.js';
import {
  broadcastSystemNotification,
  getAdminOverview,
  getAdminReports,
  getAdminUsers,
  getGameConfigs,
  getPlatformSettings,
  updateAdminUser,
  updateGameConfig,
  updatePlatformSettings,
  updateReportStatus
} from '../db/repository.js';
import { getOnlineUserIds } from '../redis/store.js';
import type { RealtimeCoordinator } from '../socket/handler.js';

export function createAdminRouter(coordinator: RealtimeCoordinator): Router {
  const router = Router();
  router.use(authMiddleware, adminMiddleware);

  router.get('/overview', async (_req, res) => {
    const [overview, liveMatches, onlineIds, settings, gameConfigs] = await Promise.all([
      getAdminOverview(),
      coordinator.getAdminLiveMatchesSummary(),
      getOnlineUserIds(),
      getPlatformSettings(),
      getGameConfigs()
    ]);
    res.json({
      ...overview,
      onlineCount: onlineIds.length,
      liveMatches,
      settings,
      gameConfigs
    });
  });

  router.get('/users', async (_req, res) => {
    const users = await getAdminUsers(150);
    res.json({ users });
  });

  router.patch('/users/:id', async (req, res) => {
    try {
      const schema = z.object({
        isBanned: z.boolean().optional(),
        role: z.enum(['user', 'admin']).optional()
      });
      const patch = schema.parse(req.body);
      const user = await updateAdminUser(String(req.params.id), patch);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json({ user });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  router.patch('/games/:gameId', async (req, res) => {
    try {
      const gameId = req.params.gameId as GameId;
      if (!VALID_GAME_IDS.has(gameId)) {
        res.status(400).json({ error: 'Invalid game ID' });
        return;
      }
      const schema = z.object({
        enabled: z.boolean().optional(),
        featured: z.boolean().optional(),
        xpMultiplier: z.number().min(0.5).max(5).optional(),
        turnSeconds: z.number().int().min(10).max(300).optional()
      });
      const patch = schema.parse(req.body);
      const updated = await updateGameConfig(gameId, patch);
      res.json({ config: updated });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  router.post('/matches/:matchId/terminate', async (req, res) => {
    const ok = await coordinator.forceTerminateMatch(String(req.params.matchId));
    res.json({ ok });
  });

  router.get('/reports', async (_req, res) => {
    const reports = await getAdminReports();
    res.json({ reports });
  });

  router.patch('/reports/:id', async (req, res) => {
    try {
      const schema = z.object({
        status: z.enum(['open', 'reviewed', 'resolved', 'dismissed'])
      });
      const { status } = schema.parse(req.body);
      const report = await updateReportStatus(String(req.params.id), status);
      if (!report) {
        res.status(404).json({ error: 'Report not found' });
        return;
      }
      res.json({ report });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  router.patch('/settings', async (req, res) => {
    try {
      const schema = z.object({
        maintenanceMode: z.boolean().optional(),
        maintenanceMessage: z.string().max(240).optional(),
        defaultTurnSeconds: z.number().int().min(10).max(180).optional(),
        reconnectGraceSeconds: z.number().int().min(15).max(180).optional(),
        globalAnnouncement: z.string().max(300).optional(),
        allowPrivateRooms: z.boolean().optional(),
        allowPublicMatchmaking: z.boolean().optional()
      });
      const patch = schema.parse(req.body);
      const settings = await updatePlatformSettings(patch);
      coordinator.broadcastGlobal('platform:settings', settings);
      res.json({ settings });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  router.post('/announce', async (req, res) => {
    try {
      const schema = z.object({
        title: z.string().min(2).max(80),
        message: z.string().min(2).max(300)
      });
      const { title, message } = schema.parse(req.body);
      await broadcastSystemNotification(title, message);
      coordinator.broadcastGlobal('notification:new', {
        id: `sys-${Date.now()}`,
        type: 'system',
        title,
        message,
        payload: {},
        isRead: false,
        createdAt: new Date().toISOString()
      });
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  return router;
}

