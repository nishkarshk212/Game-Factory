import { Router } from 'express';
import { z } from 'zod';
import { VALID_GAME_IDS, type GameId } from '@gameverse/shared';
import { authMiddleware, type AuthenticatedRequest } from '../auth/middleware.js';
import {
  claimDailyChallenge,
  getLeaderboard,
  getUserAchievements,
  getUserDailyChallenges,
  getUserMatchHistory,
  getUsersByIds,
  searchUsers,
  toggleFavoriteGame,
  toPlayerSummary,
  updateUserSettings
} from '../db/repository.js';
import { getOnlineUserIds, getUserActiveMatchId, getUserQueuedGame } from '../redis/store.js';

export function createUsersRouter(): Router {
  const router = Router();
  router.use(authMiddleware);

  router.patch('/settings', async (req: AuthenticatedRequest, res) => {
    try {
      const schema = z.object({
        soundEnabled: z.boolean().optional(),
        soundVolume: z.number().min(0).max(1).optional(),
        hapticsEnabled: z.boolean().optional(),
        theme: z.enum(['dark', 'light']).optional(),
        showMoveHints: z.boolean().optional(),
        compactBoard: z.boolean().optional()
      });
      const patch = schema.parse(req.body);
      const updated = await updateUserSettings(req.user!.id, patch);
      res.json({ user: updated });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  router.post('/favorites/:gameId', async (req: AuthenticatedRequest, res) => {
    const gameId = req.params.gameId as GameId;
    if (!VALID_GAME_IDS.has(gameId)) {
      res.status(400).json({ error: 'Invalid game ID' });
      return;
    }
    const favoriteGames = await toggleFavoriteGame(req.user!.id, gameId);
    res.json({ favoriteGames });
  });

  router.get('/history', async (req: AuthenticatedRequest, res) => {
    const history = await getUserMatchHistory(req.user!.id, 40);
    res.json({ history });
  });

  router.get('/achievements', async (req: AuthenticatedRequest, res) => {
    const achievements = await getUserAchievements(req.user!.id);
    res.json({ achievements });
  });

  router.get('/challenges', async (req: AuthenticatedRequest, res) => {
    const challenges = await getUserDailyChallenges(req.user!.id);
    res.json({ challenges });
  });

  router.post('/challenges/:id/claim', async (req: AuthenticatedRequest, res) => {
    const claimed = await claimDailyChallenge(req.user!.id, String(req.params.id));
    if (!claimed) {
      res.status(400).json({ error: 'Challenge not completed or already claimed' });
      return;
    }
    res.json(claimed);
  });

  router.get('/leaderboard', async (req: AuthenticatedRequest, res) => {
    const rawGame = typeof req.query.gameId === 'string' ? (req.query.gameId as GameId) : null;
    const gameId = rawGame && VALID_GAME_IDS.has(rawGame) ? rawGame : null;
    const entries = await getLeaderboard(gameId, 50);
    res.json({ entries, gameId });
  });

  router.get('/online', async (req: AuthenticatedRequest, res) => {
    const onlineIds = await getOnlineUserIds();
    const users = await getUsersByIds(onlineIds);
    const enriched = await Promise.all(
      users
        .filter((u) => !u.isBanned)
        .map(async (u) => {
          const [activeMatch, queuedGame] = await Promise.all([
            getUserActiveMatchId(u.id),
            getUserQueuedGame(u.id)
          ]);
          return {
            ...toPlayerSummary(u, true, 0),
            inMatch: Boolean(activeMatch),
            inQueue: Boolean(queuedGame)
          };
        })
    );
    res.json({ players: enriched, selfId: req.user!.id });
  });

  router.get('/search', async (req: AuthenticatedRequest, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    if (q.trim().length < 2) {
      res.json({ users: [] });
      return;
    }
    const found = await searchUsers(q, req.user!.id);
    const onlineSet = new Set(await getOnlineUserIds());
    res.json({
      users: found.map((u) => toPlayerSummary(u, onlineSet.has(u.id), 0))
    });
  });

  return router;
}

