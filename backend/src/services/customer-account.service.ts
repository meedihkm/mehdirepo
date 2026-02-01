// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - SERVICE COMPTES CLIENTS
// Gestion des comptes pour l'application mobile client
// ═══════════════════════════════════════════════════════════════════════════════

import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { db } from '../database';
import {
  customerAccounts,
  customers,
  orders,
  orderItems,
  payments,
  products,
} from '../database/schema';
import { NotFoundError, ValidationError } from '../utils/errors';
import { v4 as uuidv4 } from 'uuid';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface CustomerOrderParams {
  page?: number;
  limit?: number;
  status?: string;
}

interface CreateOrderData {
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  notes?: string;
  requestedDeliveryDate?: string;
  requestedTimeSlot?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// OBTENIR LE PROFIL CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

export const getCustomerProfile = async (accountId: string) => {
  const account = await db.query.customerAccounts.findFirst({
    where: eq(customerAccounts.id, accountId),
    with: {
      customer: true,
    },
  });

  if (!account || !account.customer) {
    throw new NotFoundError('Compte client introuvable');
  }

  return {
    account: {
      id: account.id,
      phone: account.phone,
      lastLoginAt: account.lastLoginAt,
    },
    customer: {
      id: account.customer.id,
      code: account.customer.code,
      name: account.customer.name,
      phone: account.customer.phone,
      address: account.customer.address,
      city: account.customer.city,
      currentDebt: account.customer.currentDebt,
      creditLimit: account.customer.creditLimit,
      creditLimitEnabled: account.customer.creditLimitEnabled,
    },
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// CATALOGUE PRODUITS
// ═══════════════════════════════════════════════════════════════════════════════

export const getProductCatalog = async (
  organizationId: string,
  categoryId?: string
) => {
  const conditions = [
    eq(products.organizationId, organizationId),
    eq(products.isActive, true),
  ];

  if (categoryId) {
    conditions.push(eq(products.categoryId, categoryId));
  }

  return db.query.products.findMany({
    where: and(...conditions),
    columns: {
      id: true,
      sku: true,
      name: true,
      description: true,
      categoryId: true,
      unit: true,
      basePrice: true,
      discountPrice: true,
      currentPrice: true,
      stockQuantity: true,
      imageUrl: true,
    },
    orderBy: [products.name],
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// MES COMMANDES
// ═══════════════════════════════════════════════════════════════════════════════

export const getMyOrders = async (
  customerId: string,
  params: CustomerOrderParams
) => {
  const { page = 1, limit = 20, status } = params;
  const offset = (page - 1) * limit;

  const conditions = [eq(orders.customerId, customerId)];

  if (status) {
    conditions.push(eq(orders.status, status as any));
  }

  const [data, countResult] = await Promise.all([
    db.query.orders.findMany({
      where: and(...conditions),
      with: {
        items: {
          with: {
            product: {
              columns: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
          },
        },
      },
      orderBy: desc(orders.createdAt),
      limit,
      offset,
    }),
    db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(and(...conditions)),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total: Number(countResult[0]?.count || 0),
      totalPages: Math.ceil(Number(countResult[0]?.count || 0) / limit),
    },
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// DÉTAIL COMMANDE
// ═══════════════════════════════════════════════════════════════════════════════

export const getOrderDetail = async (customerId: string, orderId: string) => {
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.customerId, customerId)),
    with: {
      items: {
        with: {
          product: true,
        },
      },
    },
  });

  if (!order) {
    throw new NotFoundError('Commande introuvable');
  }

  return order;
};

// ═══════════════════════════════════════════════════════════════════════════════
// CRÉER COMMANDE
// ═══════════════════════════════════════════════════════════════════════════════

export const createOrder = async (
  organizationId: string,
  customerId: string,
  data: CreateOrderData
) => {
  // Vérifier le client
  const customer = await db.query.customers.findFirst({
    where: and(
      eq(customers.id, customerId),
      eq(customers.organizationId, organizationId),
      eq(customers.isActive, true)
    ),
  });

  if (!customer) {
    throw new NotFoundError('Client introuvable');
  }

  // Récupérer les produits
  const productIds = data.items.map((item) => item.productId);
  const productList = await db.query.products.findMany({
    where: and(
      eq(products.organizationId, organizationId),
      eq(products.isActive, true),
      sql`${products.id} IN ${productIds}`
    ),
  });

  const productMap = new Map(productList.map((p) => [p.id, p]));

  // Vérifier que tous les produits existent
  for (const item of data.items) {
    if (!productMap.has(item.productId)) {
      throw new ValidationError(`Produit ${item.productId} introuvable ou inactif`);
    }
  }

  // Calculer les totaux
  let subtotal = 0;
  const orderItems: Array<{
    productId: string;
    productName: string;
    productSku: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    lineTotal: number;
  }> = [];

  for (const item of data.items) {
    const product = productMap.get(item.productId)!;
    const lineTotal = product.currentPrice * item.quantity;
    subtotal += lineTotal;

    orderItems.push({
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      quantity: item.quantity,
      unitPrice: product.currentPrice,
      discount: 0,
      lineTotal,
    });
  }

  // Vérifier la limite de crédit
  if (customer.creditLimitEnabled && customer.creditLimit) {
    const potentialDebt = customer.currentDebt + subtotal;
    if (potentialDebt > customer.creditLimit) {
      throw new ValidationError(
        `Cette commande dépasserait votre limite de crédit (${customer.creditLimit} DA)`
      );
    }
  }

  // Générer le numéro de commande
  const orderNumber = await generateOrderNumber(organizationId);

  // Créer la commande en transaction
  const result = await db.transaction(async (tx) => {
    const orderId = uuidv4();

    const [order] = await tx
      .insert(orders)
      .values({
        id: orderId,
        organizationId,
        customerId,
        orderNumber,
        status: 'pending',
        subtotal,
        discount: 0,
        deliveryFee: 0,
        total: subtotal,
        paidAmount: 0,
        notes: data.notes,
        requestedDeliveryDate: data.requestedDeliveryDate
          ? new Date(data.requestedDeliveryDate)
          : null,
        requestedTimeSlot: data.requestedTimeSlot,
        source: 'customer_app',
      })
      .returning();

    // Créer les lignes de commande
    for (const item of orderItems) {
      await tx.insert(orderItems).values({
        id: uuidv4(),
        orderId,
        ...item,
      });
    }

    return order;
  });

  // Retourner la commande complète
  return getOrderDetail(customerId, result.id);
};

// ═══════════════════════════════════════════════════════════════════════════════
// ANNULER COMMANDE
// ═══════════════════════════════════════════════════════════════════════════════

export const cancelOrder = async (customerId: string, orderId: string) => {
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.customerId, customerId)),
  });

  if (!order) {
    throw new NotFoundError('Commande introuvable');
  }

  // Vérifier que la commande peut être annulée
  const cancellableStatuses = ['pending', 'confirmed'];
  if (!cancellableStatuses.includes(order.status)) {
    throw new ValidationError(
      'Cette commande ne peut plus être annulée car elle est déjà en préparation ou en livraison'
    );
  }

  await db
    .update(orders)
    .set({
      status: 'cancelled',
      adminNotes: 'Annulée par le client depuis l\'application',
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  return { success: true };
};

// ═══════════════════════════════════════════════════════════════════════════════
// RELEVÉ DE COMPTE
// ═══════════════════════════════════════════════════════════════════════════════

export const getAccountStatement = async (
  customerId: string,
  startDate?: string,
  endDate?: string
) => {
  const start = startDate
    ? new Date(startDate)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 jours par défaut
  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(23, 59, 59, 999);

  // Commandes
  const orderList = await db.query.orders.findMany({
    where: and(
      eq(orders.customerId, customerId),
      gte(orders.createdAt, start),
      lte(orders.createdAt, end),
      sql`${orders.status} NOT IN ('cancelled', 'draft')`
    ),
    orderBy: desc(orders.createdAt),
  });

  // Paiements
  const paymentList = await db.query.payments.findMany({
    where: and(
      eq(payments.customerId, customerId),
      gte(payments.createdAt, start),
      lte(payments.createdAt, end)
    ),
    orderBy: desc(payments.createdAt),
  });

  // Combiner et trier
  const transactions = [
    ...orderList.map((o) => ({
      date: o.createdAt,
      type: 'order' as const,
      reference: o.orderNumber,
      description: `Commande #${o.orderNumber}`,
      debit: o.total,
      credit: 0,
    })),
    ...paymentList.map((p) => ({
      date: p.createdAt,
      type: 'payment' as const,
      reference: p.receiptNumber,
      description: `Paiement ${p.mode}`,
      debit: 0,
      credit: p.amount,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculer le solde courant
  let balance = 0;
  const statementLines = transactions.map((t) => {
    balance += t.debit - t.credit;
    return { ...t, balance };
  });

  // Récupérer le client pour le solde actuel
  const customer = await db.query.customers.findFirst({
    where: eq(customers.id, customerId),
  });

  return {
    period: {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    },
    currentDebt: customer?.currentDebt || 0,
    totalOrders: orderList.reduce((sum, o) => sum + o.total, 0),
    totalPayments: paymentList.reduce((sum, p) => sum + p.amount, 0),
    transactions: statementLines,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// RÉCOMPENSER (COMMANDE PRÉCÉDENTE)
// ═══════════════════════════════════════════════════════════════════════════════

export const reorderPreviousOrder = async (
  organizationId: string,
  customerId: string,
  orderId: string
) => {
  const previousOrder = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.customerId, customerId)),
    with: {
      items: true,
    },
  });

  if (!previousOrder) {
    throw new NotFoundError('Commande précédente introuvable');
  }

  // Créer une nouvelle commande avec les mêmes articles
  return createOrder(organizationId, customerId, {
    items: previousOrder.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    })),
    notes: `Récommande de #${previousOrder.orderNumber}`,
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: GÉNÉRER NUMÉRO DE COMMANDE
// ═══════════════════════════════════════════════════════════════════════════════

async function generateOrderNumber(organizationId: string): Promise<string> {
  const today = new Date();
  const prefix = `CMD-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

  const [result] = await db.execute(sql`
    SELECT COUNT(*) + 1 as next_num
    FROM orders
    WHERE organization_id = ${organizationId}
      AND order_number LIKE ${prefix + '%'}
  `);

  const nextNum = String((result as any).next_num || 1).padStart(4, '0');
  return `${prefix}-${nextNum}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  getCustomerProfile,
  getProductCatalog,
  getMyOrders,
  getOrderDetail,
  createOrder,
  cancelOrder,
  getAccountStatement,
  reorderPreviousOrder,
};
