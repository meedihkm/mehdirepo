// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - SERVICE PAIEMENTS
// Encaissement, application FIFO sur dettes, historique
// ═══════════════════════════════════════════════════════════════════════════════

import { eq, and, gte, lte, desc, asc, sql, count, isNull } from 'drizzle-orm';
import { db } from '../database';
import { 
  paymentHistory, 
  orders, 
  customers, 
  deliveryTransactions,
  dailyCash 
} from '../database/schema';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';
import { emitToOrganization } from '../index';
import type { CreatePaymentInput, PaymentQuery } from '../validators/schemas';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface PaymentResult {
  payment: {
    id: string;
    receiptNumber: string;
    amount: number;
    paymentMode: string;
    paymentType: string;
  };
  breakdown: {
    appliedToOrder: number;
    appliedToDebt: number;
    newDebtCreated: number;
  };
  customer: {
    id: string;
    name: string;
    previousDebt: number;
    newDebt: number;
  };
  order?: {
    id: string;
    orderNumber: string;
    previousPaymentStatus: string;
    newPaymentStatus: string;
  };
}

interface PaymentWithDetails {
  id: string;
  receiptNumber: string | null;
  customerId: string;
  customerName: string;
  orderId: string | null;
  orderNumber: string | null;
  amount: number;
  paymentType: string;
  paymentMode: string;
  checkNumber: string | null;
  checkBank: string | null;
  checkDate: Date | null;
  collectedById: string | null;
  collectedByName: string | null;
  deliveryId: string | null;
  notes: string | null;
  paidAt: Date;
}

interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GÉNÉRATION NUMÉRO DE REÇU
// ═══════════════════════════════════════════════════════════════════════════════

const generateReceiptNumber = async (organizationId: string): Promise<string> => {
  const today = new Date();
  const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  const [{ count: todayCount }] = await db
    .select({ count: count() })
    .from(paymentHistory)
    .where(
      and(
        eq(paymentHistory.organizationId, organizationId),
        gte(paymentHistory.collectedAt, new Date(today.setHours(0, 0, 0, 0))),
        lte(paymentHistory.collectedAt, new Date(today.setHours(23, 59, 59, 999)))
      )
    );

  const sequence = String(todayCount + 1).padStart(4, '0');
  return `REC-${datePrefix}-${sequence}`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// ENREGISTRER UN PAIEMENT
// ═══════════════════════════════════════════════════════════════════════════════

export const createPayment = async (
  organizationId: string,
  collectedById: string | null,
  input: CreatePaymentInput,
  deliveryId?: string
): Promise<PaymentResult> => {
  // Récupérer le client
  const customer = await db.query.customers.findFirst({
    where: and(
      eq(customers.id, input.customerId),
      eq(customers.organizationId, organizationId)
    ),
  });

  if (!customer) {
    throw new AppError('CUSTOMER_NOT_FOUND', 'Client introuvable', 404);
  }

  const previousDebt = Number(customer.currentDebt);
  let appliedToOrder = 0;
  let appliedToDebt = 0;
  let newDebtCreated = 0;
  let order = null;
  let orderPaymentStatus = null;
  let previousOrderPaymentStatus = null;

  // Si paiement lié à une commande
  if (input.orderId) {
    order = await db.query.orders.findFirst({
      where: and(
        eq(orders.id, input.orderId),
        eq(orders.organizationId, organizationId),
        eq(orders.customerId, input.customerId)
      ),
    });

    if (!order) {
      throw new AppError('ORDER_NOT_FOUND', 'Commande introuvable', 404);
    }

    previousOrderPaymentStatus = order.paymentStatus;
    const orderDue = Number(order.total) - Number(order.amountPaid);

    if (input.amount >= orderDue) {
      // Paiement couvre la commande
      appliedToOrder = orderDue;
      const remaining = input.amount - orderDue;
      
      if (remaining > 0 && previousDebt > 0) {
        // Appliquer le reste sur la dette existante (FIFO)
        appliedToDebt = Math.min(remaining, previousDebt);
      }

      orderPaymentStatus = 'paid';
    } else {
      // Paiement partiel
      appliedToOrder = input.amount;
      orderPaymentStatus = 'partial';
    }
  } else {
    // Paiement de dette uniquement
    appliedToDebt = Math.min(input.amount, previousDebt);
  }

  // Calculer la nouvelle dette
  const newDebt = previousDebt - appliedToDebt;

  // Transaction pour enregistrer le paiement
  const result = await db.transaction(async (tx) => {
    // Générer le numéro de reçu
    const receiptNumber = await generateReceiptNumber(organizationId);

    // Créer le paiement
    const [payment] = await tx.insert(paymentHistory)
      .values({
        organizationId,
        customerId: input.customerId,
        orderId: input.orderId || null,
        deliveryId: deliveryId || null,
        amount: input.amount,
        paymentType: input.paymentType,
        paymentMode: input.mode,
        receiptNumber,
        checkNumber: input.checkNumber || null,
        checkBank: input.checkBank || null,
        checkDate: input.checkDate ? new Date(input.checkDate) : null,
        collectedBy: collectedById,
        notes: input.notes || null,
        collectedAt: new Date(),
      })
      .returning();

    // Mettre à jour la commande si applicable
    if (order && orderPaymentStatus) {
      const newAmountPaid = Number(order.amountPaid) + appliedToOrder;
      
      await tx.update(orders)
        .set({
          amountPaid: newAmountPaid,
          paymentStatus: orderPaymentStatus,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id));
    }

    // Mettre à jour la dette et les stats du client
    await tx.update(customers)
      .set({
        currentDebt: newDebt,
        lastPaymentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(customers.id, input.customerId));

    // Si lié à une livraison, créer la transaction détaillée
    if (deliveryId) {
      await tx.insert(deliveryTransactions)
        .values({
          deliveryId,
          orderAmount: order ? Number(order.total) : 0,
          debtBefore: previousDebt,
          amountPaid: input.amount,
          appliedToOrder,
          appliedToDebt,
          newDebtCreated: 0,
          debtAfter: newDebt,
        });
    }

    // Mettre à jour la caisse journalière du livreur
    if (collectedById && input.mode === 'cash') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existingCash = await tx.query.dailyCash.findFirst({
        where: and(
          eq(dailyCash.delivererId, collectedById),
          eq(dailyCash.date, today)
        ),
      });

      if (existingCash) {
        await tx.update(dailyCash)
          .set({
            actualCollection: Number(existingCash.actualCollection) + input.amount,
            updatedAt: new Date(),
          })
          .where(eq(dailyCash.id, existingCash.id));
      } else {
        await tx.insert(dailyCash)
          .values({
            organizationId,
            delivererId: collectedById,
            date: today,
            expectedCollection: 0,
            actualCollection: input.amount,
            newDebtCreated: 0,
          });
      }
    }

    return payment;
  });

  // Émettre l'événement
  emitToOrganization(organizationId, 'payment:received', {
    paymentId: result.id,
    customerId: input.customerId,
    customerName: customer.name,
    amount: input.amount,
  });

  logger.info(
    `Payment received: ${result.receiptNumber} - ${input.amount} DZD from ${customer.name}`
  );

  return {
    payment: {
      id: result.id,
      receiptNumber: result.receiptNumber!,
      amount: input.amount,
      paymentMode: input.mode,
      paymentType: input.paymentType,
    },
    breakdown: {
      appliedToOrder,
      appliedToDebt,
      newDebtCreated,
    },
    customer: {
      id: customer.id,
      name: customer.name,
      previousDebt,
      newDebt,
    },
    order: order ? {
      id: order.id,
      orderNumber: order.orderNumber,
      previousPaymentStatus: previousOrderPaymentStatus!,
      newPaymentStatus: orderPaymentStatus!,
    } : undefined,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// ENREGISTRER PAIEMENT À LA LIVRAISON
// ═══════════════════════════════════════════════════════════════════════════════

export const processDeliveryPayment = async (
  organizationId: string,
  deliveryId: string,
  orderId: string,
  customerId: string,
  delivererId: string,
  amountCollected: number,
  collectionMode: string = 'cash'
): Promise<PaymentResult> => {
  // Récupérer la commande et le client
  const [order, customer] = await Promise.all([
    db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    }),
    db.query.customers.findFirst({
      where: eq(customers.id, customerId),
    }),
  ]);

  if (!order || !customer) {
    throw new AppError('NOT_FOUND', 'Commande ou client introuvable', 404);
  }

  const orderAmount = Number(order.total);
  const previousDebt = Number(customer.currentDebt);
  const totalDue = orderAmount + previousDebt;

  let appliedToOrder = 0;
  let appliedToDebt = 0;
  let newDebtCreated = 0;
  let orderPaymentStatus: 'unpaid' | 'partial' | 'paid' = 'unpaid';

  if (amountCollected >= orderAmount) {
    // Commande payée en totalité
    appliedToOrder = orderAmount;
    const remaining = amountCollected - orderAmount;
    
    // Appliquer sur dette existante
    appliedToDebt = Math.min(remaining, previousDebt);
    orderPaymentStatus = 'paid';
  } else if (amountCollected > 0) {
    // Paiement partiel
    appliedToOrder = amountCollected;
    newDebtCreated = orderAmount - amountCollected;
    orderPaymentStatus = 'partial';
  } else {
    // Pas de paiement = crédit total
    newDebtCreated = orderAmount;
    orderPaymentStatus = 'unpaid';
  }

  const newDebt = previousDebt - appliedToDebt + newDebtCreated;

  // Transaction
  const result = await db.transaction(async (tx) => {
    const receiptNumber = await generateReceiptNumber(organizationId);

    // Créer le paiement (même si 0, pour traçabilité)
    const [payment] = await tx.insert(paymentHistory)
      .values({
        organizationId,
        customerId,
        orderId,
        deliveryId,
        amount: amountCollected,
        paymentType: amountCollected > orderAmount ? 'order_payment' : 
                     amountCollected > 0 ? 'order_payment' : 'order_payment',
        paymentMode: collectionMode,
        receiptNumber: amountCollected > 0 ? receiptNumber : null,
        collectedBy: delivererId,
        collectedAt: new Date(),
      })
      .returning();

    // Mettre à jour la commande
    await tx.update(orders)
      .set({
        amountPaid: appliedToOrder,
        paymentStatus: orderPaymentStatus,
        status: 'delivered',
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    // Mettre à jour la dette et les stats du client
    await tx.update(customers)
      .set({
        currentDebt: newDebt,
        lastPaymentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customerId));

    // Créer la transaction détaillée
    await tx.insert(deliveryTransactions)
      .values({
        deliveryId,
        orderAmount,
        debtBefore: previousDebt,
        amountPaid: amountCollected,
        appliedToOrder,
        appliedToDebt,
        newDebtCreated,
        debtAfter: newDebt,
      });

    // Mettre à jour la caisse journalière
    if (collectionMode === 'cash') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await tx.execute(sql`
        INSERT INTO daily_cash (organization_id, deliverer_id, date, expected_collection, actual_collection, new_debt_created)
        VALUES (${organizationId}, ${delivererId}, ${today}, ${orderAmount}, ${amountCollected}, ${newDebtCreated})
        ON CONFLICT (deliverer_id, date) 
        DO UPDATE SET 
          actual_collection = daily_cash.actual_collection + ${amountCollected},
          new_debt_created = daily_cash.new_debt_created + ${newDebtCreated},
          expected_collection = daily_cash.expected_collection + ${orderAmount},
          updated_at = NOW()
      `);
    }

    return payment;
  });

  logger.info(
    `Delivery payment: ${amountCollected} DZD collected for order ${order.orderNumber}`
  );

  return {
    payment: {
      id: result.id,
      receiptNumber: result.receiptNumber || '',
      amount: amountCollected,
      paymentMode: collectionMode,
      paymentType: 'order_payment',
    },
    breakdown: {
      appliedToOrder,
      appliedToDebt,
      newDebtCreated,
    },
    customer: {
      id: customer.id,
      name: customer.name,
      previousDebt,
      newDebt,
    },
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      previousPaymentStatus: order.paymentStatus,
      newPaymentStatus: orderPaymentStatus,
    },
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// LISTE DES PAIEMENTS
// ═══════════════════════════════════════════════════════════════════════════════

export const listPayments = async (
  organizationId: string,
  query: PaymentQuery
): Promise<PaginatedResult<PaymentWithDetails>> => {
  const {
    page = 1,
    limit = 20,
    customerId,
    collectedBy,
    mode,
    paymentType,
    startDate,
    endDate,
    minAmount,
    maxAmount,
  } = query;

  const offset = (page - 1) * limit;

  const conditions = [eq(paymentHistory.organizationId, organizationId)];

  if (customerId) {
    conditions.push(eq(paymentHistory.customerId, customerId));
  }

  if (collectedBy) {
    conditions.push(eq(paymentHistory.collectedBy, collectedBy));
  }

  if (mode) {
    conditions.push(eq(paymentHistory.paymentMode, mode));
  }

  if (paymentType) {
    conditions.push(eq(paymentHistory.paymentType, paymentType));
  }

  if (startDate) {
    conditions.push(gte(paymentHistory.collectedAt, new Date(startDate)));
  }

  if (endDate) {
    conditions.push(lte(paymentHistory.collectedAt, new Date(endDate)));
  }

  if (minAmount !== undefined) {
    conditions.push(gte(paymentHistory.amount, minAmount));
  }

  if (maxAmount !== undefined) {
    conditions.push(lte(paymentHistory.amount, maxAmount));
  }

  const [data, [{ total }]] = await Promise.all([
    db.query.paymentHistory.findMany({
      where: and(...conditions),
      orderBy: [desc(paymentHistory.collectedAt)],
      limit,
      offset,
      with: {
        customer: true,
        order: true,
        collectedByUser: true,
      },
    }),
    db.select({ total: count() })
      .from(paymentHistory)
      .where(and(...conditions)),
  ]);

  return {
    data: data.map(formatPayment),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// DÉTAIL PAIEMENT
// ═══════════════════════════════════════════════════════════════════════════════

export const getPaymentById = async (
  organizationId: string,
  paymentId: string
): Promise<PaymentWithDetails> => {
  const payment = await db.query.paymentHistory.findFirst({
    where: and(
      eq(paymentHistory.id, paymentId),
      eq(paymentHistory.organizationId, organizationId)
    ),
    with: {
      customer: true,
      order: true,
      collectedByUser: true,
    },
  });

  if (!payment) {
    throw new AppError('PAYMENT_NOT_FOUND', 'Paiement introuvable', 404);
  }

  return formatPayment(payment);
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Formatter un paiement
// ═══════════════════════════════════════════════════════════════════════════════

const formatPayment = (payment: any): PaymentWithDetails => ({
  id: payment.id,
  receiptNumber: payment.receiptNumber,
  customerId: payment.customerId,
  customerName: payment.customer?.name || '',
  orderId: payment.orderId,
  orderNumber: payment.order?.orderNumber || null,
  amount: Number(payment.amount),
  paymentType: payment.paymentType,
  paymentMode: payment.paymentMode,
  checkNumber: payment.checkNumber,
  checkBank: payment.checkBank,
  checkDate: payment.checkDate,
  collectedById: payment.collectedBy,
  collectedByName: payment.collectedByUser?.name || null,
  deliveryId: payment.deliveryId,
  notes: payment.notes,
  collectedAt: payment.collectedAt,
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  createPayment,
  processDeliveryPayment,
  listPayments,
  getPaymentById,
};
