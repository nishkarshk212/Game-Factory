import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, type AuthenticatedRequest } from '../auth/middleware.js';
import {
  createNotification,
  createReport,
  getFriends,
  getNotifications,
  markNotificationsRead,
  respondFriendRequest,
  sendFriendRequest
} from '../db/repository.js';
import { getOnlineUserIds, getUserActiveMatchId } from '../redis/store.js';
import type { RealtimeCoordinator } from '../socket/handler.js';

export function createSocialRouter(coordinator: RealtimeCoordinator): Router {
  const router = Router();
  router.use(authMiddleware);

  router.get('/friends', async (req: AuthenticatedRequest, res) => {
    const [friends, onlineIds] = await Promise.all([getFriends(req.user!.id), getOnlineUserIds()]);
    const onlineSet = new Set(onlineIds);
    const enriched = await Promise.all(
      friends.map(async (f) => ({
        ...f,
        user: {
          ...f.user,
          online: onlineSet.has(f.user.id),
          inMatch: Boolean(await getUserActiveMatchId(f.user.id))
        }
      }))
    );
    res.json({ friends: enriched });
  });

  router.post('/friends/request', async (req: AuthenticatedRequest, res) => {
    try {
      const schema = z.object({ targetUserId: z.string().uuid() });
      const { targetUserId } = schema.parse(req.body);
      const result = await sendFriendRequest(req.user!.id, targetUserId);
      if (result.status === 'pending') {
        const notif = await createNotification({
          userId: targetUserId,
          type: 'friend_request',
          title: 'New Friend Request',
          message: `${req.user!.displayName} sent you a friend request.`,
          payload: { fromUserId: req.user!.id }
        });
        coordinator.emitToUser(targetUserId, 'notification:new', notif);
      } else if (result.status === 'accepted') {
        const notif = await createNotification({
          userId: targetUserId,
          type: 'friend_accepted',
          title: 'Friend Request Accepted',
          message: `${req.user!.displayName} and you are now friends!`,
          payload: { userId: req.user!.id }
        });
        coordinator.emitToUser(targetUserId, 'notification:new', notif);
      }
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  router.post('/friends/respond', async (req: AuthenticatedRequest, res) => {
    try {
      const schema = z.object({
        friendshipId: z.string().uuid(),
        action: z.enum(['accept', 'decline'])
      });
      const { friendshipId, action } = schema.parse(req.body);
      const ok = await respondFriendRequest(req.user!.id, friendshipId, action);
      if (!ok) {
        res.status(404).json({ error: 'Friend request not found' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  router.get('/notifications', async (req: AuthenticatedRequest, res) => {
    const notifications = await getNotifications(req.user!.id, 40);
    res.json({ notifications });
  });

  router.post('/notifications/read', async (req: AuthenticatedRequest, res) => {
    const id = typeof req.body?.notificationId === 'string' ? req.body.notificationId : undefined;
    await markNotificationsRead(req.user!.id, id);
    res.json({ ok: true });
  });

  router.post('/reports', async (req: AuthenticatedRequest, res) => {
    try {
      const schema = z.object({
        reportedUserId: z.string().uuid(),
        matchId: z.string().uuid().optional().nullable(),
        reason: z.string().min(2).max(100),
        details: z.string().max(500).optional()
      });
      const body = schema.parse(req.body);
      const report = await createReport({
        reporterId: req.user!.id,
        reportedUserId: body.reportedUserId,
        matchId: body.matchId,
        reason: body.reason,
        details: body.details || ''
      });
      res.status(201).json({ report });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  return router;
}

