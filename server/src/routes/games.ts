import { Router } from 'express';
import { GAME_CATALOG } from '@gameverse/shared';
import { getGameConfigs, getPlatformSettings } from '../db/repository.js';
import { getQueueSize } from '../redis/store.js';

export function createGamesRouter(): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      const [configs, settings] = await Promise.all([getGameConfigs(), getPlatformSettings()]);
      const cfgMap = new Map(configs.map((c) => [c.gameId, c]));
      const games = await Promise.all(
        GAME_CATALOG.map(async (g) => {
          const cfg = cfgMap.get(g.id);
          const queueCount = await getQueueSize(g.id);
          return {
            ...g,
            enabled: cfg ? cfg.enabled : true,
            featured: cfg ? cfg.featured : false,
            xpMultiplier: cfg ? cfg.xpMultiplier : 1.0,
            turnSeconds: cfg ? cfg.turnSeconds : g.defaultTurnSeconds,
            queueCount
          };
        })
      );
      res.json({ games, platform: settings });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}

