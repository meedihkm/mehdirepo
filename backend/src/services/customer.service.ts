// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - SERVICE CLIENTS
// CRUD clients, gestion crédit, historique
// ═══════════════════════════════════════════════════════════════════════════════

import { eq, and, or, like, gte, lte, desc, asc, sql, count } from 'drizzle-orm';
import { db } from '../database';
import { customers, customerAccounts, orders, paymentHistory } from '../database/schema';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';
import type { CreateCustomerInput, UpdateCustomerInput, CustomerQuery } from '../validators/schemas';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface CustomerWithStats {
  id: string;
  code: string | null;
  name: string;
  contactName: string | null;
  phone: string;
  phoneSecondary: string | null;
  email: string | null;
  address: string;
  city: string | null;
  wilaya: string | null;
  zone: string | null;
  coordinates: { lat: number; lng: number } | null;
  creditLimit: number;
  creditLimitEnabled: boolean;
  currentDebt: number;
  totalOrders: number;
  totalRevenue: number;
  lastOrderAt: Date | null;
  lastPaymentAt: Date | null;
  discountPercent: number;
  tags: string[];
  isActive: boolean;
  createdAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LISTE DES CLIENTS
// ═══════════════════════════════════════════════════════════════════════════════

export const listCustomers = async (
  organizationId: string,
  query: CustomerQuery
): Promise<PaginatedResult<CustomerWithStats>> => {
  const {
    page = 1,
    limit = 20,
    sortBy = 'name',
    sortOrder = 'asc',
    search,
    zone,
    hasDebt,
    minDebt,
    maxDebt,
    tags,
    isActive,
  } = query;

  const offset = (page - 1) * limit;

  // Construire les conditions
  const conditions = [eq(customers.organizationId, organizationId)];

  if (search) {
    conditions.push(
      or(
        like(customers.name, `%${search}%`),
        like(customers.code, `%${search}%`),
        like(customers.phone, `%${search}%`),
        like(customers.contactName, `%${search}%`)
      )!
    );
  }

  if (zone) {
    conditions.push(eq(customers.zone, zone));
  }

  if (hasDebt === true) {
    conditions.push(sql`${customers.currentDebt} > 0`);
  } else if (hasDebt === false) {
    conditions.push(sql`${customers.currentDebt} = 0`);
  }

  if (minDebt !== undefined) {
    conditions.push(gte(customers.currentDebt, minDebt));
  }

  if (maxDebt !== undefined) {
    conditions.push(lte(customers.currentDebt, maxDebt));
  }

  if (isActive !== undefined) {
    conditions.push(eq(customers.isActive, isActive));
  }

  if (tags) {
    const tagList = tags.split(',').map(t => t.trim());
    // PostgreSQL array overlap
    conditions.push(sql`${customers.tags} && ARRAY[${sql.join(tagList.map(t => sql`${t}`), sql`, `)}]::text[]`);
  }

  // Ordre de tri
  const orderByColumn = sortBy === 'currentDebt' ? customers.currentDebt
    : sortBy === 'createdAt' ? customers.createdAt
    : customers.name;

  const orderDirection = sortOrder === 'desc' ? desc : asc;

  // Exécuter la requête
  const [data, [{ total }]] = await Promise.all([
    db.query.customers.findMany({
      where: and(...conditions),
      orderBy: [orderDirection(orderByColumn)],
      limit,
      offset,
    }),
    db.select({ total: count() })
      .from(customers)
      .where(and(...conditions)),
  ]);

  return {
    data: data.map(formatCustomer),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// DÉTAIL CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

export const getCustomerById = async (
  organizationId: string,
  customerId: string
): Promise<CustomerWithStats> => {
  const customer = await db.query.customers.findFirst({
    where: and(
      eq(customers.id, customerId),
      eq(customers.organizationId, organizationId)
    ),
  });

  if (!customer) {
    throw new AppError('CUSTOMER_NOT_FOUND', 'Client introuvable', 404);
  }

  return formatCustomer(customer);
};

// ═══════════════════════════════════════════════════════════════════════════════
// CRÉATION CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

export const createCustomer = async (
  organizationId: string,
  input: CreateCustomerInput
): Promise<CustomerWithStats> => {
  // Vérifier si le téléphone existe déjà
  const existingPhone = await db.query.customers.findFirst({
    where: and(
      eq(customers.organizationId, organizationId),
      eq(customers.phone, input.phone)
    ),
  });

  if (existingPhone) {
    throw new AppError('PHONE_EXISTS', 'Un client avec ce numéro existe déjà', 409);
  }

  // Vérifier si le code existe déjà (si fourni)
  if (input.code) {
    const existingCode = await db.query.customers.findFirst({
      where: and(
        eq(customers.organizationId, organizationId),
        eq(customers.code, input.code)
      ),
    });

    if (existingCode) {
      throw new AppError('CODE_EXISTS', 'Un client avec ce code existe déjà', 409);
    }
  }

  // Créer le client
  const [customer] = await db.insert(customers)
    .values({
      organizationId,
      code: input.code || null,
      name: input.name,
      contactName: input.contactName || null,
      phone: input.phone,
      phoneSecondary: input.phoneSecondary || null,
      email: input.email || null,
      address: input.address,
      city: input.city || null,
      wilaya: input.wilaya || null,
      zone: input.zone || null,
      coordinates: input.coordinates || null,
      creditLimit: input.creditLimit ?? config.business.defaultCreditLimit,
      creditLimitEnabled: input.creditLimitEnabled ?? true,
      paymentDelayDays: input.paymentDelayDays ?? config.business.defaultPaymentDelayDays,
      discountPercent: input.discountPercent ?? 0,
      customPrices: input.customPrices || {},
      preferredDeliveryTime: input.preferredDeliveryTime || null,
      deliveryNotes: input.deliveryNotes || null,
      notes: input.notes || null,
      tags: input.tags || [],
    })
    .returning();

  logger.info(`Customer created: ${customer.id} - ${customer.name}`);

  return formatCustomer(customer);
};

// ═══════════════════════════════════════════════════════════════════════════════
// MISE À JOUR CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

export const updateCustomer = async (
  organizationId: string,
  customerId: string,
  input: UpdateCustomerInput
): Promise<CustomerWithStats> => {
  // Vérifier que le client existe
  const existing = await db.query.customers.findFirst({
    where: and(
      eq(customers.id, customerId),
      eq(customers.organizationId, organizationId)
    ),
  });

  if (!existing) {
    throw new AppError('CUSTOMER_NOT_FOUND', 'Client introuvable', 404);
  }

  // Vérifier l'unicité du téléphone si modifié
  if (input.phone && input.phone !== existing.phone) {
    const existingPhone = await db.query.customers.findFirst({
      where: and(
        eq(customers.organizationId, organizationId),
        eq(customers.phone, input.phone)
      ),
    });

    if (existingPhone) {
      throw new AppError('PHONE_EXISTS', 'Un client avec ce numéro existe déjà', 409);
    }
  }

  // Vérifier l'unicité du code si modifié
  if (input.code && input.code !== existing.code) {
    const existingCode = await db.query.customers.findFirst({
      where: and(
        eq(customers.organizationId, organizationId),
        eq(customers.code, input.code)
      ),
    });

    if (existingCode) {
      throw new AppError('CODE_EXISTS', 'Un client avec ce code existe déjà', 409);
    }
  }

  // Mettre à jour
  const [updated] = await db.update(customers)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, customerId))
    .returning();

  logger.info(`Customer updated: ${customerId}`);

  return formatCustomer(updated);
};

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPRESSION CLIENT (Soft delete)
// ═══════════════════════════════════════════════════════════════════════════════

export const deleteCustomer = async (
  organizationId: string,
  customerId: string
): Promise<void> => {
  const existing = await db.query.customers.findFirst({
    where: and(
      eq(customers.id, customerId),
      eq(customers.organizationId, organizationId)
    ),
  });

  if (!existing) {
    throw new AppError('CUSTOMER_NOT_FOUND', 'Client introuvable', 404);
  }

  // Vérifier s'il y a des dettes
  if (existing.currentDebt > 0) {
    throw new AppError(
      'CUSTOMER_HAS_DEBT',
      `Impossible de supprimer: dette de ${existing.currentDebt} DZD`,
      400
    );
  }

  // Soft delete
  await db.update(customers)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, customerId));

  logger.info(`Customer deactivated: ${customerId}`);
};

// ═══════════════════════════════════════════════════════════════════════════════
// MISE À JOUR LIMITE DE CRÉDIT
// ═══════════════════════════════════════════════════════════════════════════════

export const updateCreditLimit = async (
  organizationId: string,
  customerId: string,
  creditLimit: number,
  creditLimitEnabled?: boolean
): Promise<CustomerWithStats> => {
  const existing = await db.query.customers.findFirst({
    where: and(
      eq(customers.id, customerId),
      eq(customers.organizationId, organizationId)
    ),
  });

  if (!existing) {
    throw new AppError('CUSTOMER_NOT_FOUND', 'Client introuvable', 404);
  }

  const [updated] = await db.update(customers)
    .set({
      creditLimit,
      creditLimitEnabled: creditLimitEnabled ?? existing.creditLimitEnabled,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, customerId))
    .returning();

  logger.info(`Credit limit updated for customer ${customerId}: ${creditLimit} DZD`);

  return formatCustomer(updated);
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMMANDES DU CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

export const getCustomerOrders = async (
  organizationId: string,
  customerId: string,
  query: { page?: number; limit?: number; status?: string }
): Promise<PaginatedResult<any>> => {
  const { page = 1, limit = 20, status } = query;
  const offset = (page - 1) * limit;

  const conditions = [
    eq(orders.customerId, customerId),
    eq(orders.organizationId, organizationId),
  ];

  if (status) {
    conditions.push(eq(orders.status, status as any));
  }

  const [data, [{ total }]] = await Promise.all([
    db.query.orders.findMany({
      where: and(...conditions),
      orderBy: [desc(orders.createdAt)],
      limit,
      offset,
      with: {
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
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// PAIEMENTS DU CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

export const getCustomerPayments = async (
  organizationId: string,
  customerId: string,
  query: { page?: number; limit?: number; startDate?: string; endDate?: string }
): Promise<PaginatedResult<any>> => {
  const { page = 1, limit = 20, startDate, endDate } = query;
  const offset = (page - 1) * limit;

  const conditions = [
    eq(paymentHistory.customerId, customerId),
    eq(paymentHistory.organizationId, organizationId),
  ];

  if (startDate) {
    conditions.push(gte(paymentHistory.collectedAt, new Date(startDate)));
  }

  if (endDate) {
    conditions.push(lte(paymentHistory.collectedAt, new Date(endDate)));
  }

  const [data, [{ total }]] = await Promise.all([
    db.query.paymentHistory.findMany({
      where: and(...conditions),
      orderBy: [desc(paymentHistory.collectedAt)],
      limit,
      offset,
      with: {
        order: true,
        collectedBy: true,
      },
    }),
    db.select({ total: count() })
      .from(paymentHistory)
      .where(and(...conditions)),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// RELEVÉ DE COMPTE
// ═══════════════════════════════════════════════════════════════════════════════

export const getCustomerStatement = async (
  organizationId: string,
  customerId: string,
  startDate?: string,
  endDate?: string
): Promise<{
  customer: CustomerWithStats;
  period: { start: Date; end: Date };
  openingBalance: number;
  closingBalance: number;
  totalOrders: number;
  totalPayments: number;
  transactions: any[];
}> => {
  const customer = await getCustomerById(organizationId, customerId);

  const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const end = endDate ? new Date(endDate) : new Date();

  // Récupérer les commandes et paiements de la période
  const [customerOrders, payments] = await Promise.all([
    db.query.orders.findMany({
      where: and(
        eq(orders.customerId, customerId),
        gte(orders.createdAt, start),
        lte(orders.createdAt, end)
      ),
      orderBy: [asc(orders.createdAt)],
    }),
    db.query.paymentHistory.findMany({
      where: and(
        eq(paymentHistory.customerId, customerId),
        gte(paymentHistory.collectedAt, start),
        lte(paymentHistory.collectedAt, end)
      ),
      orderBy: [asc(paymentHistory.collectedAt)],
    }),
  ]);

  // Calculer les totaux
  const totalOrders = customerOrders.reduce((sum, o) => sum + Number(o.total), 0);
  const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  // Fusionner et trier les transactions
  const transactions = [
    ...customerOrders.map(o => ({
      type: 'order' as const,
      date: o.createdAt,
      reference: o.orderNumber,
      debit: Number(o.total),
      credit: 0,
      description: `Commande #${o.orderNumber}`,
    })),
    ...payments.map(p => ({
      type: 'payment' as const,
      date: p.collectedAt,
      reference: p.receiptNumber || '-',
      debit: 0,
      credit: Number(p.amount),
      description: `Paiement ${p.paymentMode}`,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculer le solde d'ouverture
  // (dette actuelle - commandes période + paiements période)
  const openingBalance = customer.currentDebt - totalOrders + totalPayments;

  return {
    customer,
    period: { start, end },
    openingBalance,
    closingBalance: customer.currentDebt,
    totalOrders,
    totalPayments,
    transactions,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Formatter un client
// ═══════════════════════════════════════════════════════════════════════════════

const formatCustomer = (customer: any): CustomerWithStats => ({
  id: customer.id,
  code: customer.code,
  name: customer.name,
  contactName: customer.contactName,
  phone: customer.phone,
  phoneSecondary: customer.phoneSecondary,
  email: customer.email,
  address: customer.address,
  city: customer.city,
  wilaya: customer.wilaya,
  zone: customer.zone,
  coordinates: customer.coordinates,
  creditLimit: Number(customer.creditLimit),
  creditLimitEnabled: customer.creditLimitEnabled,
  currentDebt: Number(customer.currentDebt),
  totalOrders: customer.totalOrders || 0,
  totalRevenue: Number(customer.totalRevenue || 0),
  lastOrderAt: customer.lastOrderAt,
  lastPaymentAt: customer.lastPaymentAt,
  discountPercent: Number(customer.discountPercent || 0),
  tags: customer.tags || [],
  isActive: customer.isActive,
  createdAt: customer.createdAt,
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

// Export nommé pour compatibilité
export const customerService = {
  list: listCustomers,
  getById: getCustomerById,
  create: createCustomer,
  update: updateCustomer,
  remove: deleteCustomer,
  updateCreditLimit,
  getOrders: getCustomerOrders,
  getPayments: getCustomerPayments,
  getStatement: getCustomerStatement,
};

// Alias pour compatibilité classe
export class CustomerService {
  static list = listCustomers;
  static getById = getCustomerById;
  static create = createCustomer;
  static update = updateCustomer;
  static remove = deleteCustomer;
  static updateCreditLimit = updateCreditLimit;
  static getOrders = getCustomerOrders;
  static getPayments = getCustomerPayments;
  static getStatement = getCustomerStatement;
}

export default customerService;
