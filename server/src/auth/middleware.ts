import type { NextFunction, Request, Response } from 'express';
import { verifySessionToken } from './jwt.js';
import { getUserById } from '../db/repository.js';
import type { UserProfile } from '@gameverse/shared';

export interface AuthenticatedRequest extends Request {
  user?: UserProfile;
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const claims = verifySessionToken(token);
    const user = await getUserById(claims.sub);
    if (!user) {
      res.status(401).json({ error: 'User account not found' });
      return;
    }
    if (user.isBanned) {
      res.status(403).json({ error: 'Account suspended by GameVerse moderation' });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: err instanceof Error ? err.message : 'Invalid session' });
  }
}

export function adminMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Administrator privileges required' });
    return;
  }
  next();
}

