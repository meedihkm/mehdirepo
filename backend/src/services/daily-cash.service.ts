// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - SERVICE CAISSE JOURNALIÈRE
// Logique métier caisse livreur
// ═══════════════════════════════════════════════════════════════════════════════

import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { db } from '../database';
import {
  dailyCash,
  cashRemittances,
  expenses,
  payments,
  deliveries,
  users,
} from '../database/schema';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';
import { v4 as uuidv4 } from 'uuid';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface DailyCashSummary {
  id: string;
  date: string;
  status: 'open' | 'closed' | 'remitted';
  openingAmount: number;
  collections: {
    cash: number;
    checks: number;
    ccp: number;
    bankTransfer: number;
    total: number;
  };
  expenses: number;
  expectedCash: number;
  actualCash?: number;
  actualChecks?: number;
  variance?: number;
  deliveries: {
    total: number;
    completed: number;
    failed: number;
  };
  openedAt: Date;
  closedAt?: Date;
}

interface CloseData {
  actualCash: number;
  actualChecks: number;
  notes?: string;
  expenses?: Array<{
    amount: number;
    category: string;
    description: string;
  }>;
}

interface RemitData {
  remittedTo: string;
  cashAmount: number;
  checks: Array<{
    checkNumber: string;
    bankName: string;
    amount: number;
  }>;
  notes?: string;
}

interface ExpenseData {
  amount: number;
  category: string;
  description: string;
  receiptPhoto?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// OBTENIR LA CAISSE DU JOUR
// ═══════════════════════════════════════════════════════════════════════════════

export const getDailyCash = async (
  organizationId: string,
  userId: string,
  dateStr?: string
): Promise<DailyCashSummary | null> => {
  const date = dateStr ? new Date(dateStr) : new Date();
  date.setHours(0, 0, 0, 0);
  const dateString = date.toISOString().split('T')[0];

  // Chercher la caisse existante
  const existing = await db.query.dailyCash.findFirst({
    where: and(
      eq(dailyCash.organizationId, organizationId),
      eq(dailyCash.userId, oderId),
      eq(dailyCash.date, dateString)
    ),
  });

  if (!existing) {
    return null;
  }

  // Calculer les collections du jour
  const collections = await calculateCollections(organizationId, userId, date);

  // Calculer les dépenses du jour
  const expensesTotal = await calculateExpenses(organizationId, userId, date);

  // Stats livraisons
  const deliveryStats = await calculateDeliveryStats(organizationId, userId, date);

  const expectedCash =
    existing.openingAmount + collections.cash - expensesTotal;

  return {
    id: existing.id,
    date: dateString,
    status: existing.status,
    openingAmount: existing.openingAmount,
    collections,
    expenses: expensesTotal,
    expectedCash,
    actualCash: existing.actualCash,
    actualChecks: existing.actualChecks,
    variance: existing.actualCash ? existing.actualCash - expectedCash : undefined,
    deliveries: deliveryStats,
    openedAt: existing.openedAt,
    closedAt: existing.closedAt,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// HISTORIQUE CAISSE
// ═══════════════════════════════════════════════════════════════════════════════

export const getDailyCashHistory = async (
  organizationId: string,
  userId: string,
  startDate: string,
  endDate: string
) => {
  const history = await db.query.dailyCash.findMany({
    where: and(
      eq(dailyCash.organizationId, organizationId),
      eq(dailyCash.userId, userId),
      gte(dailyCash.date, startDate),
      lte(dailyCash.date, endDate)
    ),
    orderBy: desc(dailyCash.date),
  });

  return history;
};

// ═══════════════════════════════════════════════════════════════════════════════
// OUVRIR LA CAISSE
// ═══════════════════════════════════════════════════════════════════════════════

export const openDailyCash = async (
  organizationId: string,
  userId: string,
  openingAmount: number,
  dateStr?: string
) => {
  const date = dateStr ? new Date(dateStr) : new Date();
  date.setHours(0, 0, 0, 0);
  const dateString = date.toISOString().split('T')[0];

  // Vérifier qu'il n'y a pas déjà une caisse ouverte
  const existing = await db.query.dailyCash.findFirst({
    where: and(
      eq(dailyCash.organizationId, organizationId),
      eq(dailyCash.userId, userId),
      eq(dailyCash.date, dateString)
    ),
  });

  if (existing) {
    throw new ConflictError('Une caisse est déjà ouverte pour cette date');
  }

  const [cash] = await db
    .insert(dailyCash)
    .values({
      id: uuidv4(),
      organizationId,
      userId,
      date: dateString,
      openingAmount,
      status: 'open',
      openedAt: new Date(),
    })
    .returning();

  return cash;
};

// ═══════════════════════════════════════════════════════════════════════════════
// CLÔTURER LA CAISSE
// ═══════════════════════════════════════════════════════════════════════════════

export const closeDailyCash = async (
  organizationId: string,
  userId: string,
  data: CloseData
) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateString = today.toISOString().split('T')[0];

  // Trouver la caisse ouverte
  const existing = await db.query.dailyCash.findFirst({
    where: and(
      eq(dailyCash.organizationId, organizationId),
      eq(dailyCash.userId, userId),
      eq(dailyCash.date, dateString),
      eq(dailyCash.status, 'open')
    ),
  });

  if (!existing) {
    throw new NotFoundError('Aucune caisse ouverte trouvée pour aujourd\'hui');
  }

  // Calculer les totaux
  const collections = await calculateCollections(organizationId, userId, today);
  const expensesTotal = await calculateExpenses(organizationId, userId, today);

  const expectedCash = existing.openingAmount + collections.cash - expensesTotal;
  const variance = data.actualCash - expectedCash;

  // Ajouter les dépenses déclarées
  if (data.expenses && data.expenses.length > 0) {
    for (const expense of data.expenses) {
      await addExpense(organizationId, userId, expense);
    }
  }

  // Mettre à jour la caisse
  const [cash] = await db
    .update(dailyCash)
    .set({
      status: 'closed',
      actualCash: data.actualCash,
      actualChecks: data.actualChecks,
      expectedCash,
      variance,
      totalCollected: collections.total,
      totalExpenses: expensesTotal,
      closingNotes: data.notes,
      closedAt: new Date(),
    })
    .where(eq(dailyCash.id, existing.id))
    .returning();

  return {
    ...cash,
    collections,
    variance,
    variancePercent: expectedCash > 0 ? (variance / expectedCash) * 100 : 0,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// REMETTRE LA CAISSE
// ═══════════════════════════════════════════════════════════════════════════════

export const remitCash = async (
  organizationId: string,
  userId: string,
  data: RemitData
) => {
  // Vérifier que la caisse est clôturée
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateString = today.toISOString().split('T')[0];

  const cash = await db.query.dailyCash.findFirst({
    where: and(
      eq(dailyCash.organizationId, organizationId),
      eq(dailyCash.userId, userId),
      eq(dailyCash.date, dateString),
      eq(dailyCash.status, 'closed')
    ),
  });

  if (!cash) {
    throw new NotFoundError('Caisse non clôturée ou déjà remise');
  }

  // Créer la remise
  const checksTotal = data.checks.reduce((sum, c) => sum + c.amount, 0);

  const [remittance] = await db
    .insert(cashRemittances)
    .values({
      id: uuidv4(),
      organizationId,
      dailyCashId: cash.id,
      fromUserId: userId,
      toUserId: data.remittedTo,
      cashAmount: data.cashAmount,
      checksAmount: checksTotal,
      checksDetail: data.checks,
      notes: data.notes,
      status: 'pending',
    })
    .returning();

  // Mettre à jour la caisse
  await db
    .update(dailyCash)
    .set({ status: 'remitted' })
    .where(eq(dailyCash.id, cash.id));

  return remittance;
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIRMER REMISE (Admin)
// ═══════════════════════════════════════════════════════════════════════════════

export const confirmRemittance = async (
  organizationId: string,
  remittanceId: string,
  adminId: string,
  notes?: string
) => {
  const remittance = await db.query.cashRemittances.findFirst({
    where: and(
      eq(cashRemittances.id, remittanceId),
      eq(cashRemittances.organizationId, organizationId),
      eq(cashRemittances.status, 'pending')
    ),
  });

  if (!remittance) {
    throw new NotFoundError('Remise non trouvée ou déjà confirmée');
  }

  const [updated] = await db
    .update(cashRemittances)
    .set({
      status: 'confirmed',
      confirmedBy: adminId,
      confirmedAt: new Date(),
      confirmationNotes: notes,
    })
    .where(eq(cashRemittances.id, remittanceId))
    .returning();

  return updated;
};

// ═══════════════════════════════════════════════════════════════════════════════
// AJOUTER UNE DÉPENSE
// ═══════════════════════════════════════════════════════════════════════════════

export const addExpense = async (
  organizationId: string,
  userId: string,
  data: ExpenseData
) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateString = today.toISOString().split('T')[0];

  // Vérifier que la caisse est ouverte
  const cash = await db.query.dailyCash.findFirst({
    where: and(
      eq(dailyCash.organizationId, organizationId),
      eq(dailyCash.userId, userId),
      eq(dailyCash.date, dateString),
      eq(dailyCash.status, 'open')
    ),
  });

  if (!cash) {
    throw new ValidationError('Aucune caisse ouverte pour enregistrer une dépense');
  }

  const [expense] = await db
    .insert(expenses)
    .values({
      id: uuidv4(),
      organizationId,
      dailyCashId: cash.id,
      userId,
      amount: data.amount,
      category: data.category,
      description: data.description,
      receiptPhoto: data.receiptPhoto,
    })
    .returning();

  return expense;
};

// ═══════════════════════════════════════════════════════════════════════════════
// VUE ADMIN - TOUTES LES CAISSES
// ═══════════════════════════════════════════════════════════════════════════════

export const getAllDailyCash = async (
  organizationId: string,
  dateStr?: string,
  status?: string
) => {
  const date = dateStr || new Date().toISOString().split('T')[0];

  const conditions = [
    eq(dailyCash.organizationId, organizationId),
    eq(dailyCash.date, date),
  ];

  if (status) {
    conditions.push(eq(dailyCash.status, status as any));
  }

  const cashes = await db.query.dailyCash.findMany({
    where: and(...conditions),
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  // Enrichir avec les stats
  const enriched = await Promise.all(
    cashes.map(async (cash) => {
      const dateObj = new Date(cash.date);
      const collections = await calculateCollections(
        organizationId,
        cash.userId,
        dateObj
      );
      const deliveryStats = await calculateDeliveryStats(
        organizationId,
        cash.userId,
        dateObj
      );

      return {
        ...cash,
        collections,
        deliveries: deliveryStats,
      };
    })
  );

  return enriched;
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

async function calculateCollections(
  organizationId: string,
  userId: string,
  date: Date
) {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  const result = await db
    .select({
      mode: payments.mode,
      total: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.organizationId, organizationId),
        eq(payments.collectedById, userId),
        gte(payments.createdAt, date),
        lte(payments.createdAt, nextDay)
      )
    )
    .groupBy(payments.mode);

  const collections = {
    cash: 0,
    checks: 0,
    ccp: 0,
    bankTransfer: 0,
    total: 0,
  };

  for (const row of result) {
    const amount = Number(row.total);
    collections.total += amount;

    switch (row.mode) {
      case 'cash':
        collections.cash = amount;
        break;
      case 'check':
        collections.checks = amount;
        break;
      case 'ccp':
        collections.ccp = amount;
        break;
      case 'bank_transfer':
        collections.bankTransfer = amount;
        break;
    }
  }

  return collections;
}

async function calculateExpenses(
  organizationId: string,
  userId: string,
  date: Date
) {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  const [result] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.organizationId, organizationId),
        eq(expenses.userId, userId),
        gte(expenses.createdAt, date),
        lte(expenses.createdAt, nextDay)
      )
    );

  return Number(result?.total) || 0;
}

async function calculateDeliveryStats(
  organizationId: string,
  userId: string,
  date: Date
) {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  const result = await db
    .select({
      status: deliveries.status,
      count: sql<number>`COUNT(*)`,
    })
    .from(deliveries)
    .where(
      and(
        eq(deliveries.organizationId, organizationId),
        eq(deliveries.delivererId, userId),
        gte(deliveries.deliveryDate, date),
        lte(deliveries.deliveryDate, nextDay)
      )
    )
    .groupBy(deliveries.status);

  const stats = {
    total: 0,
    completed: 0,
    failed: 0,
  };

  for (const row of result) {
    stats.total += Number(row.count);
    if (row.status === 'delivered') {
      stats.completed = Number(row.count);
    } else if (row.status === 'failed') {
      stats.failed = Number(row.count);
    }
  }

  return stats;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  getDailyCash,
  getDailyCashHistory,
  openDailyCash,
  closeDailyCash,
  remitCash,
  confirmRemittance,
  addExpense,
  getAllDailyCash,
};
