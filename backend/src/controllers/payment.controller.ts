// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - PAYMENT CONTROLLER
// Méthodes: list, create, getById (matchent routes/index.ts)
// ═══════════════════════════════════════════════════════════════════════════════

import { Request, Response, NextFunction } from 'express';
import { db } from '../database';
import { payments, orders, customers } from '../database/schema';
import { eq, and, desc, gte, lte, count, sum } from 'drizzle-orm';
import { AppError } from '../utils/errors';
import { PaymentService } from '../services/payment.service';

const paymentService = new PaymentService();

// Route: paymentRoutes.get('/')
export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.user!;
    const { page = '1', limit = '20', orderId, customerId, mode, startDate, endDate } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const offset = (pageNum - 1) * limitNum;

    const conditions = [eq(payments.organizationId, organizationId)];
    if (orderId) conditions.push(eq(payments.orderId, orderId as string));
    if (customerId) conditions.push(eq(payments.customerId, customerId as string));
    if (mode) conditions.push(eq(payments.mode, mode as string));
    if (startDate) conditions.push(gte(payments.createdAt, new Date(startDate as string)));
    if (endDate) conditions.push(lte(payments.createdAt, new Date(endDate as string)));

    const whereClause = and(...conditions);

    const [totalResult] = await db.select({ count: count() }).from(payments).where(whereClause);

    const result = await db
      .select({
        id: payments.id, orderId: payments.orderId, customerId: payments.customerId,
        amount: payments.amount, mode: payments.mode, reference: payments.reference,
        notes: payments.notes, collectedBy: payments.collectedBy, createdAt: payments.createdAt,
      })
      .from(payments)
      .where(whereClause)
      .orderBy(desc(payments.createdAt))
      .limit(limitNum)
      .offset(offset);

    res.json({
      success: true,
      data: result,
      pagination: { page: pageNum, limit: limitNum, total: totalResult.count, totalPages: Math.ceil(totalResult.count / limitNum) },
    });
  } catch (error) { next(error); }
};

// Route: paymentRoutes.post('/')
export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId, userId } = req.user!;
    const { orderId, customerId, amount, mode, reference, notes } = req.body;

    if (!amount || amount <= 0) throw new AppError('Le montant doit être supérieur à 0', 400);

    // Vérifier commande
    if (orderId) {
      const [order] = await db.select().from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.organizationId, organizationId)));

      if (!order) throw new AppError('Commande non trouvée', 404);

      const remaining = order.total - order.amountPaid;
      if (amount > remaining) {
        throw new AppError(`Le montant dépasse le reste à payer (${remaining} DA)`, 400);
      }
    }

    const payment = await paymentService.recordPayment({
      organizationId,
      orderId: orderId || null,
      customerId,
      amount,
      mode,
      reference: reference || null,
      notes: notes || null,
      collectedBy: userId,
    });

    res.status(201).json({ success: true, data: payment });
  } catch (error) { next(error); }
};

// Route: paymentRoutes.get('/:id')
export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.user!;
    const { id } = req.params;

    const [payment] = await db.select().from(payments)
      .where(and(eq(payments.id, id), eq(payments.organizationId, organizationId)));

    if (!payment) throw new AppError('Paiement non trouvé', 404);

    res.json({ success: true, data: payment });
  } catch (error) { next(error); }
};
