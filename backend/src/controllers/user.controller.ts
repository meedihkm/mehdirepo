// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - USER CONTROLLER
// Méthodes: list, create, getById, update, remove, performance (matchent routes)
// ═══════════════════════════════════════════════════════════════════════════════

import { Request, Response, NextFunction } from 'express';
import { db } from '../database';
import { users, orders, deliveries, payments } from '../database/schema';
import { eq, and, or, ilike, desc, gte, sql, count, sum } from 'drizzle-orm';
import { AppError } from '../utils/errors';
import bcrypt from 'bcryptjs';

// Route: userRoutes.get('/')
export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.user!;
    const { page = '1', limit = '20', search, role, active } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const offset = (pageNum - 1) * limitNum;

    const conditions = [eq(users.organizationId, organizationId)];
    if (search) {
      conditions.push(or(
        ilike(users.name, `%${search}%`),
        ilike(users.email, `%${search}%`),
        ilike(users.phone, `%${search}%`)
      )!);
    }
    if (role) conditions.push(eq(users.role, role as string));
    if (active !== undefined) conditions.push(eq(users.isActive, active === 'true'));

    const whereClause = and(...conditions);

    const [totalResult] = await db.select({ count: count() }).from(users).where(whereClause);

    const result = await db
      .select({
        id: users.id, email: users.email, name: users.name,
        phone: users.phone, role: users.role, isActive: users.isActive,
        lastLoginAt: users.lastLoginAt, createdAt: users.createdAt,
      })
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(limitNum)
      .offset(offset);

    res.json({
      success: true,
      data: result,
      pagination: { page: pageNum, limit: limitNum, total: totalResult.count, totalPages: Math.ceil(totalResult.count / limitNum) },
    });
  } catch (error) { next(error); }
};

// Route: userRoutes.post('/')
export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.user!;
    const { email, name, phone, role, password, isActive = true } = req.body;

    const existing = await db.select({ id: users.id }).from(users)
      .where(and(eq(users.organizationId, organizationId), eq(users.email, email.toLowerCase())));

    if (existing.length > 0) throw new AppError('Un utilisateur avec cet email existe déjà', 409);

    const passwordHash = await bcrypt.hash(password, 12);

    const [user] = await db.insert(users).values({
      organizationId, email: email.toLowerCase(), name,
      phone: phone || null, role, passwordHash, isActive,
    }).returning({
      id: users.id, email: users.email, name: users.name,
      phone: users.phone, role: users.role, isActive: users.isActive, createdAt: users.createdAt,
    });

    res.status(201).json({ success: true, data: user });
  } catch (error) { next(error); }
};

// Route: userRoutes.get('/:id')
export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.user!;
    const { id } = req.params;

    const [user] = await db
      .select({
        id: users.id, email: users.email, name: users.name,
        phone: users.phone, role: users.role, isActive: users.isActive,
        lastLoginAt: users.lastLoginAt, createdAt: users.createdAt, updatedAt: users.updatedAt,
      })
      .from(users)
      .where(and(eq(users.id, id), eq(users.organizationId, organizationId)));

    if (!user) throw new AppError('Utilisateur non trouvé', 404);

    res.json({ success: true, data: user });
  } catch (error) { next(error); }
};

// Route: userRoutes.put('/:id')
export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.user!;
    const { id } = req.params;
    const { email, name, phone, role, password, isActive } = req.body;

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (email !== undefined) updateData.email = email.toLowerCase();
    if (password) updateData.passwordHash = await bcrypt.hash(password, 12);
    updateData.updatedAt = new Date();

    const [updated] = await db.update(users).set(updateData)
      .where(and(eq(users.id, id), eq(users.organizationId, organizationId)))
      .returning({
        id: users.id, email: users.email, name: users.name,
        phone: users.phone, role: users.role, isActive: users.isActive,
      });

    if (!updated) throw new AppError('Utilisateur non trouvé', 404);

    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
};

// Route: userRoutes.delete('/:id')
export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId, userId } = req.user!;
    const { id } = req.params;

    if (id === userId) throw new AppError('Vous ne pouvez pas supprimer votre propre compte', 400);

    const [updated] = await db.update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(users.id, id), eq(users.organizationId, organizationId)))
      .returning({ id: users.id });

    if (!updated) throw new AppError('Utilisateur non trouvé', 404);

    res.json({ success: true, message: 'Utilisateur désactivé' });
  } catch (error) { next(error); }
};

// Route: userRoutes.get('/:id/performance')
export const performance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.user!;
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate as string) : new Date();

    // Vérifier que l'utilisateur existe
    const [user] = await db.select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(and(eq(users.id, id), eq(users.organizationId, organizationId)));

    if (!user) throw new AppError('Utilisateur non trouvé', 404);

    // Stats livreur
    if (user.role === 'deliverer') {
      const [deliveryStats] = await db
        .select({
          totalDeliveries: count(),
          completedDeliveries: sql<number>`COUNT(*) FILTER (WHERE ${deliveries.status} = 'completed')`,
          failedDeliveries: sql<number>`COUNT(*) FILTER (WHERE ${deliveries.status} = 'failed')`,
          totalCollected: sum(deliveries.amountCollected),
        })
        .from(deliveries)
        .where(and(
          eq(deliveries.organizationId, organizationId),
          eq(deliveries.delivererId, id),
          gte(deliveries.createdAt, start)
        ));

      return res.json({
        success: true,
        data: {
          user: { id: user.id, name: user.name, role: user.role },
          period: { start, end },
          deliveries: {
            total: deliveryStats.totalDeliveries,
            completed: deliveryStats.completedDeliveries || 0,
            failed: deliveryStats.failedDeliveries || 0,
            successRate: deliveryStats.totalDeliveries > 0
              ? ((deliveryStats.completedDeliveries || 0) / deliveryStats.totalDeliveries * 100).toFixed(1)
              : 0,
            totalCollected: Number(deliveryStats.totalCollected) || 0,
          },
        },
      });
    }

    // Stats générique (commandes créées)
    // TODO: orders.createdBy field doesn't exist - query simplified
    const [orderStats] = await db
      .select({ totalOrders: count(), totalAmount: sum(orders.total) })
      .from(orders)
      .where(and(
        eq(orders.organizationId, organizationId),
        gte(orders.createdAt, start)
      ));

    res.json({
      success: true,
      data: {
        user: { id: user.id, name: user.name, role: user.role },
        period: { start, end },
        orders: {
          total: orderStats.totalOrders,
          total: Number(orderStats.total) || 0,
        },
      },
    });
  } catch (error) { next(error); }
};
