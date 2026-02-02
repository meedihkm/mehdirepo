// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - CONTRÔLEUR CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

import { Request, Response } from 'express';
import { db } from '../database';
import { eq, and, desc, gte, lte, sql, inArray } from 'drizzle-orm';
import {
  customerAccounts,
  customers,
  categories,
  products,
  orders,
  orderItems,
  paymentHistory,
  notifications,
} from '../database/schema';
import { customerService, orderService } from '../services';
import { notificationService } from '../services/notification.service';
import { generateToken } from '../utils/jwt';
import { generateOtp, verifyOtp as verifyOtpCode } from '../utils/otp';
import { AppError } from '../utils/errors';
import { orderStatusEnum, paymentStatusEnum } from '../database/schema';

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHENTIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

export const requestOtp = async (req: Request, res: Response) => {
  const { phone } = req.body;

  // Vérifier si le client existe
  const customerAccount = await db.query.customerAccounts.findFirst({
    where: eq(customerAccounts.phone, phone),
    with: {
      customer: true,
    },
  });

  if (!customerAccount) {
    throw new AppError('Numéro de téléphone non enregistré', 404);
  }

  if (!customerAccount.isActive) {
    throw new AppError('Ce compte est désactivé', 403);
  }

  // Générer et envoyer le code OTP
  const otp = await generateOtp(phone);

  // TODO: Envoyer le SMS via le service SMS
  // Pour le développement, on retourne le code
  res.json({
    success: true,
    message: 'Code OTP envoyé',
    data: {
      // En production, ne pas retourner le code
      ...(process.env.NODE_ENV === 'development' && { otp }),
      expiresIn: 300, // 5 minutes
    },
  });
};

export const verifyOtp = async (req: Request, res: Response) => {
  const { phone, otp, deviceId } = req.body;

  // Vérifier le code OTP
  const isValid = await verifyOtpCode(phone, otp);
  if (!isValid) {
    throw new AppError('Code OTP invalide ou expiré', 400);
  }

  // Récupérer le compte client
  const customerAccount = await db.query.customerAccounts.findFirst({
    where: eq(customerAccounts.phone, phone),
    with: {
      customer: {
        with: {
          organization: true,
        },
      },
    },
  });

  if (!customerAccount) {
    throw new AppError('Compte non trouvé', 404);
  }

  // Mettre à jour la dernière connexion
  await db
    .update(customerAccounts)
    .set({
      lastLoginAt: new Date(),
      deviceId: deviceId || customerAccount.deviceId,
    })
    .where(eq(customerAccounts.id, customerAccount.id));

  // Générer le token JWT
  const token = generateToken({
    userId: customerAccount.id,
    customerId: customerAccount.customerId,
    organizationId: customerAccount.customer.organizationId,
    role: 'customer',
  });

  res.json({
    success: true,
    data: {
      accessToken: token,
      user: {
        id: customerAccount.id,
        customerId: customerAccount.customerId,
        phone: customerAccount.phone,
        name: customerAccount.customer.name,
        email: customerAccount.customer.email,
        organizationName: customerAccount.customer.organization.name,
        organizationLogo: customerAccount.customer.organization.logoUrl,
        currentDebt: customerAccount.customer.currentDebt,
        creditLimit: customerAccount.customer.creditLimit,
      },
    },
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// PROFIL
// ═══════════════════════════════════════════════════════════════════════════════

export const getProfile = async (req: Request, res: Response) => {
  const customerId = req.user!.customerId!;

  const customer = await db.query.customers.findFirst({
    where: eq(customers.id, customerId),
    with: {
      organization: true,
    },
  });

  if (!customer) {
    throw new AppError('Client non trouvé', 404);
  }

  res.json({
    success: true,
    data: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      city: customer.city,
      zone: customer.zone,
      organizationName: customer.organization.name,
      organizationLogo: customer.organization.logoUrl,
      currentDebt: customer.currentDebt,
      creditLimit: customer.creditLimit,
      creditLimitEnabled: customer.creditLimitEnabled,
    },
  });
};

export const getStatement = async (req: Request, res: Response) => {
  const customerId = req.user!.customerId!;
  const organizationId = req.user!.organizationId;

  const { startDate, endDate } = req.query;

  const start = startDate
    ? new Date(startDate as string)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 jours par défaut

  const end = endDate ? new Date(endDate as string) : new Date();

  // Récupérer le solde d'ouverture
  const openingBalanceResult = await db.execute(sql`
    SELECT COALESCE(SUM(total), 0) - COALESCE(SUM(amount_paid), 0) as balance
    FROM ${orders}
    WHERE ${orders.customerId} = ${customerId}
    AND ${orders.organizationId} = ${organizationId}
    AND ${orders.createdAt} < ${start}
    AND ${orders.status} != 'cancelled'
  `);

  const openingBalance = Number(openingBalanceResult.rows[0]?.balance || 0);

  // Récupérer les transactions (commandes et paiements)
  const ordersData = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      date: orders.createdAt,
      total: orders.total,
      amountPaid: orders.amountPaid,
      status: orders.status,
    })
    .from(orders)
    .where(
      and(
        eq(orders.customerId, customerId),
        eq(orders.organizationId, organizationId),
        gte(orders.createdAt, start),
        lte(orders.createdAt, end),
        sql`${orders.status} != 'cancelled'`
      )
    )
    .orderBy(orders.createdAt);

  const paymentsData = await db
    .select({
      id: paymentHistory.id,
      date: paymentHistory.createdAt,
      amount: paymentHistory.amount,
      mode: paymentHistory.mode,
      
    })
    .from(paymentHistory)
    .where(
      and(
        eq(paymentHistory.customerId, customerId),
        eq(paymentHistory.organizationId, organizationId),
        gte(paymentHistory.createdAt, start),
        lte(paymentHistory.createdAt, end)
      )
    )
    .orderBy(paymentHistory.createdAt);

  // Combiner et trier les transactions
  const transactions = [
    ...ordersData.map((o) => ({
      id: o.id,
      type: 'order',
      date: o.date,
      orderNumber: o.orderNumber,
      orderAmount: o.total,
      paymentAmount: o.amountPaid,
      description: `Commande ${o.orderNumber}`,
    })),
    ...paymentsData.map((p) => ({
      id: p.id,
      type: 'payment',
      date: p.date,
      orderNumber: null,
      orderAmount: 0,
      paymentAmount: p.amount,
      paymentMode: p.mode,
      description: `Paiement ${p.mode}`,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculer les soldes
  let balance = openingBalance;
  const transactionsWithBalance = transactions.map((t) => {
    balance += (t.orderAmount || 0) - (t.paymentAmount || 0);
    return { ...t, balanceAfter: balance };
  });

  const totalOrders = ordersData.reduce((sum, o) => sum + Number(o.total), 0);
  const totalPayments = paymentsData.reduce((sum, p) => sum + Number(p.amount), 0);

  res.json({
    success: true,
    data: {
      startDate: start,
      endDate: end,
      openingBalance,
      closingBalance: balance,
      totalOrders,
      totalPayments,
      transactions: transactionsWithBalance,
    },
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// CATÉGORIES
// ═══════════════════════════════════════════════════════════════════════════════

export const getCategories = async (req: Request, res: Response) => {
  const organizationId = req.user!.organizationId;

  const data = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      icon: categories.icon,
      color: categories.color,
      sortOrder: categories.sortOrder,
    })
    .from(categories)
    .where(eq(categories.organizationId, organizationId))
    .orderBy(categories.sortOrder);

  res.json({
    success: true,
    data,
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUITS
// ═══════════════════════════════════════════════════════════════════════════════

export const getProducts = async (req: Request, res: Response) => {
  const organizationId = req.user!.organizationId;
  const customerId = req.user!.customerId!;

  const { categoryId, search, featured } = req.query;

  // Construire la requête de base
  let query = db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      price: products.price,
      unit: products.unit,
      unitQuantity: products.unitQuantity,
      categoryId: products.categoryId,
      imageUrl: products.imageUrl,
      thumbnailUrl: products.thumbnailUrl,
      isAvailable: products.isAvailable,
      isFeatured: products.isFeatured,
      sortOrder: products.sortOrder,
    })
    .from(products)
    .where(
      and(
        eq(products.organizationId, organizationId),
        eq(products.isAvailable, true)
      )
    );

  // Appliquer les filtres
  if (categoryId) {
    query = query.where(eq(products.categoryId, categoryId as string));
  }

  if (featured === 'true') {
    query = query.where(eq(products.isFeatured, true));
  }

  if (search) {
    query = query.where(
      sql`${products.name} ILIKE ${`%${search}%`} OR ${products.description} ILIKE ${`%${search}%`}`
    );
  }

  const data = await query.orderBy(products.sortOrder);

  // Récupérer les prix personnalisés pour ce client
  const customer = await db.query.customers.findFirst({
    where: eq(customers.id, customerId),
  });

  const productsWithCustomPrice = data.map((p) => ({
    ...p,
    customPrice: customer?.customPrices?.[p.id] || null,
  }));

  res.json({
    success: true,
    data: productsWithCustomPrice,
  });
};

export const getProduct = async (req: Request, res: Response) => {
  const organizationId = req.user!.organizationId;
  const customerId = req.user!.customerId!;
  const { id } = req.params;

  const product = await db.query.products.findFirst({
    where: and(eq(products.id, id), eq(products.organizationId, organizationId)),
  });

  if (!product) {
    throw new AppError('Produit non trouvé', 404);
  }

  // Récupérer le prix personnalisé
  const customer = await db.query.customers.findFirst({
    where: eq(customers.id, customerId),
  });

  res.json({
    success: true,
    data: {
      ...product,
      customPrice: customer?.customPrices?.[product.id] || null,
    },
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMMANDES
// ═══════════════════════════════════════════════════════════════════════════════

export const createOrder = async (req: Request, res: Response) => {
  const customerId = req.user!.customerId!;
  const organizationId = req.user!.organizationId;

  const {
    items,
    deliveryDate,
    deliveryTimeSlot,
    deliveryAddress,
    deliveryNotes,
    notes,
  } = req.body;

  // Vérifier le plafond de crédit
  const customer = await db.query.customers.findFirst({
    where: eq(customers.id, customerId),
  });

  if (!customer) {
    throw new AppError('Client non trouvé', 404);
  }

  if (customer.creditLimitEnabled && customer.creditLimit) {
    const newDebt = Number(customer.currentDebt) + calculateOrderTotal(items, customer);
    if (newDebt > Number(customer.creditLimit)) {
      throw new AppError(
        `Dépassement du plafond de crédit. Disponible: ${(
          Number(customer.creditLimit) - Number(customer.currentDebt)
        ).toFixed(2)} DA`,
        400
      );
    }
  }

  // Créer la commande
  const order = await orderService.createOrder({
    organizationId,
    customerId,
    items: items.map((item: any) => ({
      productId: item.productId,
      quantity: item.quantity,
      notes: item.notes,
    })),
    deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
    deliveryTimeSlot,
    deliveryAddress,
    deliveryNotes,
    notes,
    createdBy: customerId,
    source: 'mobile_app',
  });

  // Envoyer une notification
  await notificationService.notifyOrderCreated(customerId, order.orderNumber);

  res.status(201).json({
    success: true,
    data: order,
  });
};

export const getOrders = async (req: Request, res: Response) => {
  const customerId = req.user!.customerId!;
  const organizationId = req.user!.organizationId;

  const { status, page = '1', limit = '20' } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const offset = (pageNum - 1) * limitNum;

  // Construire les conditions
  const conditions = [
    eq(orders.customerId, customerId),
    eq(orders.organizationId, organizationId),
  ];

  if (status) {
    conditions.push(eq(orders.status, status as any));
  }

  // Récupérer les commandes
  const data = await db.query.orders.findMany({
    where: and(...conditions),
    with: {
      items: {
        with: {
          product: true,
        },
      },
    },
    orderBy: [desc(orders.createdAt)],
    limit: limitNum,
    offset,
  });

  res.json({
    success: true,
    data,
  });
};

export const getOrder = async (req: Request, res: Response) => {
  const customerId = req.user!.customerId!;
  const organizationId = req.user!.organizationId;
  const { id } = req.params;

  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.id, id),
      eq(orders.customerId, customerId),
      eq(orders.organizationId, organizationId)
    ),
    with: {
      items: {
        with: {
          product: true,
        },
      },
    },
  });

  if (!order) {
    throw new AppError('Commande non trouvée', 404);
  }

  res.json({
    success: true,
    data: order,
  });
};

export const cancelOrder = async (req: Request, res: Response) => {
  const customerId = req.user!.customerId!;
  const organizationId = req.user!.organizationId;
  const { id } = req.params;
  const { reason } = req.body;

  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.id, id),
      eq(orders.customerId, customerId),
      eq(orders.organizationId, organizationId)
    ),
  });

  if (!order) {
    throw new AppError('Commande non trouvée', 404);
  }

  // Vérifier si la commande peut être annulée
  const cancellableStatuses = ['draft', 'pending', 'confirmed'];
  if (!cancellableStatuses.includes(order.status)) {
    throw new AppError(
      `Impossible d'annuler une commande en statut "${order.status}"`,
      400
    );
  }

  // Annuler la commande
  await orderService.cancelOrder(id, reason || 'Annulé par le client');

  res.json({
    success: true,
    message: 'Commande annulée avec succès',
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const getNotifications = async (req: Request, res: Response) => {
  const customerId = req.user!.customerId!;
  const organizationId = req.user!.organizationId;

  const { unreadOnly, page = '1', limit = '20' } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const offset = (pageNum - 1) * limitNum;

  // Construire les conditions
  const conditions = [
    eq(notifications.customerId, customerId),
    eq(notifications.organizationId, organizationId),
  ];

  if (unreadOnly === 'true') {
    conditions.push(eq(notifications.isRead, false));
  }

  const data = await db.query.notifications.findMany({
    where: and(...conditions),
    orderBy: [desc(notifications.createdAt)],
    limit: limitNum,
    offset,
  });

  res.json({
    success: true,
    data,
  });
};

export const markNotificationRead = async (req: Request, res: Response) => {
  const customerId = req.user!.customerId!;
  const organizationId = req.user!.organizationId;
  const { id } = req.params;

  await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.customerId, customerId),
        eq(notifications.organizationId, organizationId)
      )
    );

  res.json({
    success: true,
    message: 'Notification marquée comme lue',
  });
};

export const markAllNotificationsRead = async (req: Request, res: Response) => {
  const customerId = req.user!.customerId!;
  const organizationId = req.user!.organizationId;

  await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(notifications.customerId, customerId),
        eq(notifications.organizationId, organizationId),
        eq(notifications.isRead, false)
      )
    );

  res.json({
    success: true,
    message: 'Toutes les notifications marquées comme lues',
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function calculateOrderTotal(
  items: Array<{ productId: string; quantity: number }>,
  customer: any
): number {
  // Cette fonction est simplifiée - en production, il faudrait récupérer
  // les prix des produits depuis la base de données
  return 0;
}

export const customerController = {
  requestOtp,
  verifyOtp,
  getProfile,
  getStatement,
  getCategories,
  getProducts,
  getProduct,
  createOrder,
  getOrders,
  getOrder,
  cancelOrder,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
