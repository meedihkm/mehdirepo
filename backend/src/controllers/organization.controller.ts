// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - ORGANIZATION CONTROLLER
// Méthodes: get, update, updateSettings, dashboard (matchent routes/index.ts)
// ═══════════════════════════════════════════════════════════════════════════════

import { Request, Response, NextFunction } from 'express';
import { db } from '../database';
import { organizations, orders, customers, products, payments, deliveries } from '../database/schema';
import { eq, and, gte, sql, count, sum } from 'drizzle-orm';
import { AppError } from '../utils/errors';

// Route: orgRoutes.get('/')
export const get = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Utilisateur non authentifié', 401);
    }
    const { organizationId } = req.user;
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId));

    if (!org) throw new AppError('Organisation non trouvée', 404);

    res.json({ success: true, data: org });
  } catch (error) {
    next(error);
  }
};

// Route: orgRoutes.put('/')
export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Utilisateur non authentifié', 401);
    }
    const { organizationId } = req.user;
    const { name, address, phone, email, taxId, logo } = req.body;

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (taxId !== undefined) updateData.taxId = taxId;
    if (logo !== undefined) updateData.logo = logo;
    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(organizations)
      .set(updateData)
      .where(eq(organizations.id, organizationId))
      .returning();

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

// Route: orgRoutes.put('/settings')
export const updateSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Utilisateur non authentifié', 401);
    }
    const { organizationId } = req.user;
    const {
      currency, timezone, receiptFooter, defaultCreditLimit,
      lowStockThreshold, notifications, deliveryFeeDefault,
    } = req.body;

    const updateData: Record<string, any> = {};
    if (currency !== undefined) updateData.currency = currency;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (receiptFooter !== undefined) updateData.receiptFooter = receiptFooter;
    if (defaultCreditLimit !== undefined) updateData.defaultCreditLimit = defaultCreditLimit;
    if (lowStockThreshold !== undefined) updateData.lowStockThreshold = lowStockThreshold;
    if (notifications !== undefined) updateData.notificationSettings = notifications;
    if (deliveryFeeDefault !== undefined) updateData.deliveryFeeDefault = deliveryFeeDefault;
    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(organizations)
      .set(updateData)
      .where(eq(organizations.id, organizationId))
      .returning();

    res.json({ success: true, data: updated, message: 'Paramètres mis à jour' });
  } catch (error) {
    next(error);
  }
};

// Route: orgRoutes.get('/dashboard')
export const dashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Utilisateur non authentifié', 401);
    }
    const { organizationId } = req.user;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Commandes du jour
    const [todayOrders] = await db
      .select({ count: count(), total: sum(orders.total) })
      .from(orders)
      .where(and(
        eq(orders.organizationId, organizationId),
        gte(orders.createdAt, today)
      ));

    // Commandes en attente
    const [pendingOrders] = await db
      .select({ count: count() })
      .from(orders)
      .where(and(
        eq(orders.organizationId, organizationId),
        sql`${orders.status} IN ('pending', 'confirmed', 'preparing')`
      ));

    // Livraisons actives
    const [activeDeliveries] = await db
      .select({ count: count() })
      .from(deliveries)
      .where(and(
        eq(deliveries.organizationId, organizationId),
        sql`${deliveries.status} IN ('assigned', 'in_progress')`
      ));

    // Encaissements du jour
    const [todayPayments] = await db
      .select({ total: sum(payments.amount) })
      .from(payments)
      .where(and(
        eq(payments.organizationId, organizationId),
        gte(payments.createdAt, today)
      ));

    // Produits en stock bas
    const [lowStock] = await db
      .select({ count: count() })
      .from(products)
      .where(and(
        eq(products.organizationId, organizationId),
        eq(products.isActive, true),
        sql`${products.stockQuantity} <= ${products.minStockLevel}`
      ));

    // Dette totale clients
    const [totalDebt] = await db
      .select({ total: sum(customers.currentDebt), count: count() })
      .from(customers)
      .where(and(
        eq(customers.organizationId, organizationId),
        sql`${customers.currentDebt} > 0`
      ));

    res.json({
      success: true,
      data: {
        todayOrders: todayOrders.count,
        todayRevenue: Number(todayOrders.total) || 0,
        todayPayments: Number(todayPayments.total) || 0,
        pendingOrders: pendingOrders.count,
        activeDeliveries: activeDeliveries.count,
        lowStockProducts: lowStock.count,
        totalDebt: Number(totalDebt.total) || 0,
        customersWithDebt: totalDebt.count,
      },
    });
  } catch (error) {
    next(error);
  }
};
