// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - NOTIFICATION CONTROLLER
// Méthodes: list, markRead, markAllRead, registerToken (matchent routes)
// ═══════════════════════════════════════════════════════════════════════════════

import { Request, Response, NextFunction } from 'express';
import { db } from '../database';
import { notifications } from '../database/schema';
import { eq, and, desc, count } from 'drizzle-orm';
import { AppError } from '../utils/errors';
import { NotificationService } from '../services/notification.service';

const notificationService = new NotificationService();

// Route: notificationRoutes.get('/')
export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, organizationId } = req.user!;
    const { page = '1', limit = '20', unreadOnly } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const offset = (pageNum - 1) * limitNum;

    const conditions = [
      eq(notifications.organizationId, organizationId),
      eq(notifications.userId, userId),
    ];
    if (unreadOnly === 'true') conditions.push(eq(notifications.isRead, false));

    const whereClause = and(...conditions);

    const [totalResult] = await db.select({ count: count() }).from(notifications).where(whereClause);

    const result = await db.select().from(notifications)
      .where(whereClause)
      .orderBy(desc(notifications.createdAt))
      .limit(limitNum)
      .offset(offset);

    const [unreadResult] = await db.select({ count: count() }).from(notifications)
      .where(and(
        eq(notifications.organizationId, organizationId),
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));

    res.json({
      success: true,
      data: result,
      unreadCount: unreadResult.count,
      pagination: { page: pageNum, limit: limitNum, total: totalResult.count, totalPages: Math.ceil(totalResult.count / limitNum) },
    });
  } catch (error) { next(error); }
};

// Route: notificationRoutes.put('/:id/read')
export const markRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, organizationId } = req.user!;
    const { id } = req.params;

    const [updated] = await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(notifications.id, id),
        eq(notifications.userId, userId),
        eq(notifications.organizationId, organizationId)
      ))
      .returning();

    if (!updated) throw new AppError('Notification non trouvée', 404);

    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
};

// Route: notificationRoutes.put('/read-all')
export const markAllRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, organizationId } = req.user!;

    await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.organizationId, organizationId),
        eq(notifications.isRead, false)
      ));

    res.json({ success: true, message: 'Toutes les notifications marquées comme lues' });
  } catch (error) { next(error); }
};

// Route: notificationRoutes.post('/register-token')
export const registerToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, organizationId } = req.user!;
    const { token, platform } = req.body;

    if (!token) throw new AppError('Le token FCM est requis', 400);

    await notificationService.registerDeviceToken(userId, organizationId, token, platform || 'android');

    res.json({ success: true, message: 'Token enregistré' });
  } catch (error) { next(error); }
};
