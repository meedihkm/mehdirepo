// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - SERVICE COMMANDES
// CRUD commandes, workflow statuts, calculs automatiques
// ═══════════════════════════════════════════════════════════════════════════════

import { eq, and, or, gte, lte, desc, asc, sql, count, inArray } from 'drizzle-orm';
import { db } from '../database';
import { 
  orders, 
  orderItems, 
  customers, 
  products, 
  deliveries,
  paymentHistory 
} from '../database/schema';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';
import { emitToOrganization, emitToUser } from '../index';
import type { 
  CreateOrderInput, 
  CreateOrderByCustomerInput,
  UpdateOrderInput, 
  OrderQuery,
  OrderStatus 
} from '../validators/schemas';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface OrderWithDetails {
  id: string;
  orderNumber: string;
  organizationId: string;
  customerId: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    address: string;
    currentDebt: number;
  };
  status: OrderStatus;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  items: OrderItemDetail[];
  deliveryDate: Date | null;
  deliveryTimeSlot: string | null;
  deliveryAddress: string | null;
  deliveryNotes: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface OrderItemDetail {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  notes: string | null;
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
// GÉNÉRATION NUMÉRO DE COMMANDE
// ═══════════════════════════════════════════════════════════════════════════════

const generateOrderNumber = async (organizationId: string): Promise<string> => {
  const today = new Date();
  const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  // Compter les commandes du jour pour cette organisation
  const [{ count: todayCount }] = await db
    .select({ count: count() })
    .from(orders)
    .where(
      and(
        eq(orders.organizationId, organizationId),
        gte(orders.createdAt, new Date(today.setHours(0, 0, 0, 0))),
        lte(orders.createdAt, new Date(today.setHours(23, 59, 59, 999)))
      )
    );

  const sequence = String(todayCount + 1).padStart(3, '0');
  return `${config.business.orderNumberPrefix}-${datePrefix}-${sequence}`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// LISTE DES COMMANDES
// ═══════════════════════════════════════════════════════════════════════════════

export const listOrders = async (
  organizationId: string,
  query: OrderQuery
): Promise<PaginatedResult<OrderWithDetails>> => {
  const {
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    customerId,
    status,
    statuses,
    paymentStatus,
    deliveryDate,
    delivererId,
    search,
    startDate,
    endDate,
    minTotal,
    maxTotal,
  } = query;

  const offset = (page - 1) * limit;

  // Construire les conditions
  const conditions = [eq(orders.organizationId, organizationId)];

  if (customerId) {
    conditions.push(eq(orders.customerId, customerId));
  }

  if (status) {
    conditions.push(eq(orders.status, status));
  }

  if (statuses) {
    const statusList = statuses.split(',') as OrderStatus[];
    conditions.push(inArray(orders.status, statusList));
  }

  if (paymentStatus) {
    conditions.push(eq(orders.paymentStatus, paymentStatus as any));
  }

  if (deliveryDate) {
    conditions.push(eq(orders.deliveryDate, new Date(deliveryDate)));
  }

  if (search) {
    conditions.push(
      or(
        sql`${orders.orderNumber} ILIKE ${`%${search}%`}`,
        sql`EXISTS (
          SELECT 1 FROM customers c 
          WHERE c.id = ${orders.customerId} 
          AND c.name ILIKE ${`%${search}%`}
        )`
      )!
    );
  }

  if (startDate) {
    conditions.push(gte(orders.createdAt, new Date(startDate)));
  }

  if (endDate) {
    conditions.push(lte(orders.createdAt, new Date(endDate)));
  }

  if (minTotal !== undefined) {
    conditions.push(gte(orders.total, minTotal));
  }

  if (maxTotal !== undefined) {
    conditions.push(lte(orders.total, maxTotal));
  }

  if (delivererId) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM deliveries d 
        WHERE d.order_id = ${orders.id} 
        AND d.deliverer_id = ${delivererId}
      )`
    );
  }

  // Ordre de tri
  const orderByColumn = sortBy === 'totalAmount' ? orders.total
    : sortBy === 'deliveryDate' ? orders.deliveryDate
    : orders.createdAt;

  const orderDirection = sortOrder === 'asc' ? asc : desc;

  // Exécuter la requête
  const [data, [{ total }]] = await Promise.all([
    db.query.orders.findMany({
      where: and(...conditions),
      orderBy: [orderDirection(orderByColumn)],
      limit,
      offset,
      with: {
        customer: true,
        items: {
          with: {
            product: true,
          },
        },
      },
    }),
    db.select({ total: count() })
      .from(orders)
      .where(and(...conditions)),
  ]);

  return {
    data: data.map(formatOrder),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// DÉTAIL COMMANDE
// ═══════════════════════════════════════════════════════════════════════════════

export const getOrderById = async (
  organizationId: string,
  orderId: string
): Promise<OrderWithDetails> => {
  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.id, orderId),
      eq(orders.organizationId, organizationId)
    ),
    with: {
      customer: true,
      items: {
        with: {
          product: true,
        },
      },
      delivery: {
        with: {
          deliverer: true,
        },
      },
      payments: true,
    },
  });

  if (!order) {
    throw new AppError('ORDER_NOT_FOUND', 'Commande introuvable', 404);
  }

  return formatOrder(order);
};

// ═══════════════════════════════════════════════════════════════════════════════
// CRÉATION COMMANDE (Admin)
// ═══════════════════════════════════════════════════════════════════════════════

export const createOrder = async (
  organizationId: string,
  userId: string,
  input: CreateOrderInput
): Promise<OrderWithDetails> => {
  // Vérifier le client
  const customer = await db.query.customers.findFirst({
    where: and(
      eq(customers.id, input.customerId),
      eq(customers.organizationId, organizationId),
      eq(customers.isActive, true)
    ),
  });

  if (!customer) {
    throw new AppError('CUSTOMER_NOT_FOUND', 'Client introuvable ou inactif', 404);
  }

  // Récupérer les produits et vérifier leur disponibilité
  const productIds = input.items.map(item => item.productId);
  const productList = await db.query.products.findMany({
    where: and(
      eq(products.organizationId, organizationId),
      inArray(products.id, productIds),
      eq(products.isAvailable, true)
    ),
  });

  if (productList.length !== productIds.length) {
    throw new AppError('PRODUCT_NOT_FOUND', 'Un ou plusieurs produits sont indisponibles', 400);
  }

  const productMap = new Map(productList.map(p => [p.id, p]));

  // Calculer les totaux
  let subtotal = 0;
  const itemsData = input.items.map(item => {
    const product = productMap.get(item.productId)!;
    
    // Prix personnalisé ou prix standard
    const unitPrice = item.unitPrice 
      ?? (customer.customPrices as any)?.[product.id] 
      ?? Number(product.price);
    
    const totalPrice = unitPrice * item.quantity;
    subtotal += totalPrice;

    return {
      productId: item.productId,
      productName: product.name,
      quantity: item.quantity,
      unit: product.unit,
      unitPrice: unitPrice,
      totalPrice,
      notes: item.notes || null,
    };
  });

  // Appliquer la remise
  const discountPercent = input.discountPercent ?? customer.discountPercent ?? 0;
  const discountAmount = input.discountAmount ?? (subtotal * discountPercent / 100);
  const totalAmount = subtotal - discountAmount;

  // Vérifier la limite de crédit
  const newDebt = customer.currentDebt + totalAmount;
  if (customer.creditLimitEnabled && newDebt > customer.creditLimit) {
    throw new AppError(
      'CREDIT_LIMIT_EXCEEDED',
      `Limite de crédit dépassée. Dette actuelle: ${customer.currentDebt} DZD, ` +
      `Limite: ${customer.creditLimit} DZD, Commande: ${totalAmount} DZD`,
      400
    );
  }

  // Générer le numéro de commande
  const orderNumber = await generateOrderNumber(organizationId);

  // Transaction pour créer la commande et les items
  const order = await db.transaction(async (tx) => {
    // Créer la commande
    const [newOrder] = await tx.insert(orders)
      .values({
        organizationId,
        customerId: input.customerId,
        orderNumber,
        status: 'pending',
        paymentStatus: 'unpaid',
        subtotal,
        discountPercent,
        discountAmount,
        totalAmount,
        amountPaid: 0,
        deliveryDate: input.deliveryDate ? new Date(input.deliveryDate) : null,
        deliveryTimeSlot: input.deliveryTimeSlot || null,
        deliveryAddress: input.deliveryAddress || customer.address,
        deliveryNotes: input.deliveryNotes || customer.deliveryNotes,
        notes: input.notes || null,
        createdBy: userId,
      })
      .returning();

    // Créer les items
    await tx.insert(orderItems)
      .values(itemsData.map(item => ({
        orderId: newOrder.id,
        ...item,
      })));

    // Mettre à jour les stats client
    await tx.update(customers)
      .set({
        lastOrderAt: new Date(),
        totalOrders: sql`${customers.totalOrders} + 1`,
        totalRevenue: sql`${customers.totalRevenue} + ${totalAmount}`,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, input.customerId));

    return newOrder;
  });

  // Récupérer la commande complète
  const fullOrder = await getOrderById(organizationId, order.id);

  // Émettre l'événement WebSocket
  emitToOrganization(organizationId, 'order:created', fullOrder);

  logger.info(`Order created: ${order.orderNumber} for customer ${customer.name}`);

  return fullOrder;
};

// ═══════════════════════════════════════════════════════════════════════════════
// CRÉATION COMMANDE (Client App)
// ═══════════════════════════════════════════════════════════════════════════════

export const createOrderByCustomer = async (
  organizationId: string,
  customerId: string,
  input: CreateOrderByCustomerInput
): Promise<OrderWithDetails> => {
  // Convertir en format admin et créer
  const adminInput: CreateOrderInput = {
    customerId,
    items: input.items,
    deliveryDate: input.deliveryDate,
    deliveryTimeSlot: input.deliveryTimeSlot,
    notes: input.notes,
  };

  return createOrder(organizationId, customerId, adminInput);
};

// ═══════════════════════════════════════════════════════════════════════════════
// MISE À JOUR COMMANDE
// ═══════════════════════════════════════════════════════════════════════════════

export const updateOrder = async (
  organizationId: string,
  orderId: string,
  input: UpdateOrderInput
): Promise<OrderWithDetails> => {
  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.id, orderId),
      eq(orders.organizationId, organizationId)
    ),
    with: { customer: true },
  });

  if (!order) {
    throw new AppError('ORDER_NOT_FOUND', 'Commande introuvable', 404);
  }

  // Vérifier que la commande peut être modifiée
  if (['delivered', 'cancelled'].includes(order.status)) {
    throw new AppError(
      'ORDER_NOT_EDITABLE',
      'Cette commande ne peut plus être modifiée',
      400
    );
  }

  let updateData: any = {
    updatedAt: new Date(),
  };

  // Mettre à jour les items si fournis
  if (input.items) {
    // Recalculer les totaux
    const productIds = input.items.map(item => item.productId);
    const productList = await db.query.products.findMany({
      where: and(
        eq(products.organizationId, organizationId),
        inArray(products.id, productIds)
      ),
    });
    const productMap = new Map(productList.map(p => [p.id, p]));

    let subtotal = 0;
    const itemsData = input.items.map(item => {
      const product = productMap.get(item.productId)!;
      const unitPrice = item.unitPrice ?? Number(product.price);
      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;

      return {
        orderId,
        productId: item.productId,
        productName: product.name,
        quantity: item.quantity,
        unit: product.unit,
        unitPrice: unitPrice,
        totalPrice,
        notes: item.notes || null,
      };
    });

    const discountPercent = input.discountPercent ?? order.discountPercent;
    const discountAmount = input.discountAmount ?? (subtotal * discountPercent / 100);
    const totalAmount = subtotal - discountAmount;

    // Vérifier la limite de crédit
    const debtDiff = totalAmount - Number(order.total);
    const newDebt = Number(order.customer.currentDebt) + debtDiff;
    
    if (order.customer.creditLimitEnabled && newDebt > order.customer.creditLimit) {
      throw new AppError('CREDIT_LIMIT_EXCEEDED', 'Limite de crédit dépassée', 400);
    }

    updateData = {
      ...updateData,
      subtotal,
      discountPercent,
      discountAmount,
      totalAmount,
    };

    // Transaction pour mettre à jour les items
    await db.transaction(async (tx) => {
      // Supprimer les anciens items
      await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));
      
      // Insérer les nouveaux items
      await tx.insert(orderItems).values(itemsData);
    });
  }

  // Autres mises à jour
  if (input.deliveryDate !== undefined) {
    updateData.deliveryDate = input.deliveryDate ? new Date(input.deliveryDate) : null;
  }
  if (input.deliveryTimeSlot !== undefined) {
    updateData.deliveryTimeSlot = input.deliveryTimeSlot;
  }
  if (input.deliveryAddress !== undefined) {
    updateData.deliveryAddress = input.deliveryAddress;
  }
  if (input.deliveryNotes !== undefined) {
    updateData.deliveryNotes = input.deliveryNotes;
  }
  if (input.notes !== undefined) {
    updateData.notes = input.notes;
  }

  // Mettre à jour
  await db.update(orders)
    .set(updateData)
    .where(eq(orders.id, orderId));

  const updatedOrder = await getOrderById(organizationId, orderId);

  // Émettre l'événement
  emitToOrganization(organizationId, 'order:updated', updatedOrder);

  logger.info(`Order updated: ${order.orderNumber}`);

  return updatedOrder;
};

// ═══════════════════════════════════════════════════════════════════════════════
// CHANGEMENT DE STATUT
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ['pending', 'cancelled'],
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['assigned', 'cancelled'],
  assigned: ['in_delivery', 'ready', 'cancelled'],
  in_delivery: ['delivered', 'assigned'],
  delivered: [],
  cancelled: [],
};

export const updateOrderStatus = async (
  organizationId: string,
  orderId: string,
  newStatus: OrderStatus,
  reason?: string
): Promise<OrderWithDetails> => {
  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.id, orderId),
      eq(orders.organizationId, organizationId)
    ),
  });

  if (!order) {
    throw new AppError('ORDER_NOT_FOUND', 'Commande introuvable', 404);
  }

  // Vérifier la transition
  const allowedTransitions = STATUS_TRANSITIONS[order.status as OrderStatus];
  if (!allowedTransitions.includes(newStatus)) {
    throw new AppError(
      'INVALID_STATUS_TRANSITION',
      `Impossible de passer de "${order.status}" à "${newStatus}"`,
      400
    );
  }

  // Mettre à jour
  const updateData: any = {
    status: newStatus,
    updatedAt: new Date(),
  };

  if (newStatus === 'cancelled' && reason) {
    updateData.cancelReason = reason;
    updateData.cancelledAt = new Date();
  }

  if (newStatus === 'confirmed') {
    updateData.confirmedAt = new Date();
  }

  await db.update(orders)
    .set(updateData)
    .where(eq(orders.id, orderId));

  const updatedOrder = await getOrderById(organizationId, orderId);

  // Émettre l'événement
  emitToOrganization(organizationId, 'order:status_changed', {
    order: updatedOrder,
    previousStatus: order.status,
    newStatus,
  });

  logger.info(`Order ${order.orderNumber} status changed: ${order.status} → ${newStatus}`);

  return updatedOrder;
};

// ═══════════════════════════════════════════════════════════════════════════════
// ANNULATION
// ═══════════════════════════════════════════════════════════════════════════════

export const cancelOrder = async (
  organizationId: string,
  orderId: string,
  reason?: string
): Promise<OrderWithDetails> => {
  return updateOrderStatus(organizationId, orderId, 'cancelled', reason);
};

// ═══════════════════════════════════════════════════════════════════════════════
// DUPLICATION
// ═══════════════════════════════════════════════════════════════════════════════

export const duplicateOrder = async (
  organizationId: string,
  orderId: string,
  userId: string,
  deliveryDate?: string
): Promise<OrderWithDetails> => {
  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.id, orderId),
      eq(orders.organizationId, organizationId)
    ),
    with: {
      items: true,
    },
  });

  if (!order) {
    throw new AppError('ORDER_NOT_FOUND', 'Commande introuvable', 404);
  }

  // Créer une nouvelle commande avec les mêmes items
  const input: CreateOrderInput = {
    customerId: order.customerId,
    items: order.items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      notes: item.notes || undefined,
    })),
    deliveryDate: deliveryDate || undefined,
    deliveryTimeSlot: order.deliveryTimeSlot || undefined,
    deliveryAddress: order.deliveryAddress || undefined,
    deliveryNotes: order.deliveryNotes || undefined,
    discountPercent: Number(order.discountPercent),
    notes: `Copie de la commande #${order.orderNumber}`,
  };

  return createOrder(organizationId, userId, input);
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Formatter une commande
// ═══════════════════════════════════════════════════════════════════════════════

const formatOrder = (order: any): OrderWithDetails => ({
  id: order.id,
  orderNumber: order.orderNumber,
  organizationId: order.organizationId,
  customerId: order.customerId,
  customer: order.customer ? {
    id: order.customer.id,
    name: order.customer.name,
    phone: order.customer.phone,
    address: order.customer.address,
    currentDebt: Number(order.customer.currentDebt),
  } : null as any,
  status: order.status,
  paymentStatus: order.paymentStatus,
  subtotal: Number(order.subtotal),
  discountPercent: Number(order.discountPercent),
  discountAmount: Number(order.discountAmount),
  totalAmount: Number(order.total),
  amountPaid: Number(order.amountPaid),
  amountDue: Number(order.total) - Number(order.amountPaid),
  items: (order.items || []).map((item: any) => ({
    id: item.id,
    productId: item.productId,
    productName: item.productName || item.product?.name,
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: Number(item.unitPrice),
    totalPrice: Number(item.totalPrice),
    notes: item.notes,
  })),
  deliveryDate: order.deliveryDate,
  deliveryTimeSlot: order.deliveryTimeSlot,
  deliveryAddress: order.deliveryAddress,
  deliveryNotes: order.deliveryNotes,
  notes: order.notes,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export const orderService = {
  list: listOrders,
  getById: getOrderById,
  create: createOrder,
  createByCustomer: createOrderByCustomer,
  update: updateOrder,
  updateStatus: updateOrderStatus,
  cancel: cancelOrder,
  duplicate: duplicateOrder,
};

export class OrderService {
  static list = listOrders;
  static getById = getOrderById;
  static create = createOrder;
  static createByCustomer = createOrderByCustomer;
  static update = updateOrder;
  static updateStatus = updateOrderStatus;
  static cancel = cancelOrder;
  static duplicate = duplicateOrder;
}

export default orderService;
