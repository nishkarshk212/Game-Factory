import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config.js';
import { testDbConnection, pool } from './db/pool.js';
import { runMigrations } from './db/schema.js';
import { seedDatabase } from './db/seed.js';
import { closeRedis, getRedis, initRedisClient } from './redis/client.js';
import { RealtimeCoordinator } from './socket/handler.js';
import { createAuthRouter } from './routes/auth.js';
import { createGamesRouter } from './routes/games.js';
import { createUsersRouter } from './routes/users.js';
import { createSocialRouter } from './routes/social.js';
import { createAdminRouter } from './routes/admin.js';
import { TokenBucketLimiter } from './socket/rateLimiter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface RunningServer {
  app: express.Express;
  httpServer: http.Server;
  coordinator: RealtimeCoordinator;
  close: () => Promise<void>;
}

export async function createAppServer(): Promise<RunningServer> {
  await testDbConnection();
  await runMigrations();
  await seedDatabase();
  const redis = await initRedisClient();

  const app = express();
  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    })
  );
  app.use(compression());
  app.use(
    cors({
      origin: config.clientOrigins.length ? config.clientOrigins : true,
      credentials: true
    })
  );
  app.use(express.json({ limit: '512kb' }));

  const httpLimiter = new TokenBucketLimiter(120, 40);
  app.use('/api', (req, res, next) => {
    const ip = req.ip || 'unknown';
    if (!httpLimiter.consume(ip)) {
      res.status(429).json({ error: 'Too many API requests' });
      return;
    }
    next();
  });

  const httpServer = http.createServer(app);
  const coordinator = new RealtimeCoordinator(httpServer);

  app.get('/api/health', async (_req, res) => {
    try {
      await testDbConnection();
      const pong = await getRedis().ping();
      res.json({
        ok: true,
        brand: 'GameVerse | Powered by Sonic Network',
        db: 'postgresql',
        redis: redis.mode === 'redis' ? `connected (${pong})` : 'memory-fallback'
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: (err as Error).message });
    }
  });

  app.use('/api/auth', createAuthRouter());
  app.use('/api/games', createGamesRouter());
  app.use('/api/users', createUsersRouter());
  app.use('/api/social', createSocialRouter(coordinator));
  app.use('/api/admin', createAdminRouter(coordinator));

  // Serve built React SPA in production / unified build
  const clientDistPath = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
        next();
        return;
      }
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  return {
    app,
    httpServer,
    coordinator,
    close: async () => {
      await coordinator.shutdown();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      await closeRedis();
      await pool.end();
    }
  };
}

