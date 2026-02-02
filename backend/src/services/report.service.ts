// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - SERVICE RAPPORTS
// Génération de rapports et exports
// ═══════════════════════════════════════════════════════════════════════════════

import { eq, and, gte, lte, sql, desc, count, sum } from 'drizzle-orm';
import { db } from '../database';
import {
  orders,
  orderItems,
  deliveries,
  payments,
  customers,
  products,
  users,
  dailyCash,
} from '../database/schema';
import ExcelJS from 'exceljs';
import { createReadStream } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';

// ═══════════════════════════════════════════════════════════════════════════════
// RAPPORT JOURNALIER
// ═══════════════════════════════════════════════════════════════════════════════

export const generateDailyReport = async (
  organizationId: string,
  date: string
) => {
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);

  // Commandes
  const ordersData = await db
    .select({
      status: orders.status,
      count: count(orders.id),
      total: sum(orders.total),
    })
    .from(orders)
    .where(
      and(
        eq(orders.organizationId, organizationId),
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate)
      )
    )
    .groupBy(orders.status);

  // Livraisons
  const deliveriesData = await db
    .select({
      status: deliveries.status,
      count: count(deliveries.id),
      collected: sum(deliveries.amountCollected),
    })
    .from(deliveries)
    .where(
      and(
        eq(deliveries.organizationId, organizationId),
        gte(deliveries.deliveryDate, startDate),
        lte(deliveries.deliveryDate, endDate)
      )
    )
    .groupBy(deliveries.status);

  // Paiements
  const paymentsData = await db
    .select({
      mode: payments.mode,
      count: count(payments.id),
      total: sum(payments.amount),
    })
    .from(payments)
    .where(
      and(
        eq(payments.organizationId, organizationId),
        gte(payments.createdAt, startDate),
        lte(payments.createdAt, endDate)
      )
    )
    .groupBy(payments.mode);

  // Top produits
  const topProducts = await db
    .select({
      productId: orderItems.productId,
      productName: orderItems.productName,
      quantity: sum(orderItems.quantity),
      revenue: sql<number>`SUM(${orderItems.quantity} * ${orderItems.unitPrice})`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.organizationId, organizationId),
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate),
        sql`${orders.status} NOT IN ('cancelled', 'draft')`
      )
    )
    .groupBy(orderItems.productId, orderItems.productName)
    .orderBy(desc(sql`SUM(${orderItems.quantity} * ${orderItems.unitPrice})`))
    .limit(10);

  // Performance livreurs
  const delivererPerformance = await db
    .select({
      delivererId: deliveries.delivererId,
      delivererName: users.name,
      total: count(deliveries.id),
      completed: sql<number>`COUNT(*) FILTER (WHERE ${deliveries.status} = 'delivered')`,
      failed: sql<number>`COUNT(*) FILTER (WHERE ${deliveries.status} = 'failed')`,
      collected: sum(deliveries.amountCollected),
    })
    .from(deliveries)
    .innerJoin(users, eq(deliveries.delivererId, users.id))
    .where(
      and(
        eq(deliveries.organizationId, organizationId),
        gte(deliveries.deliveryDate, startDate),
        lte(deliveries.deliveryDate, endDate)
      )
    )
    .groupBy(deliveries.delivererId, users.name);

  // Calculer les totaux
  const ordersSummary = {
    total: ordersData.reduce((sum, o) => sum + Number(o.count), 0),
    revenue: ordersData.reduce((sum, o) => sum + Number(o.total || 0), 0),
    byStatus: Object.fromEntries(
      ordersData.map((o) => [o.status, { count: Number(o.count), total: Number(o.total || 0) }])
    ),
  };

  const deliveriesSummary = {
    total: deliveriesData.reduce((sum, d) => sum + Number(d.count), 0),
    completed: deliveriesData.find((d) => d.status === 'delivered')?.count || 0,
    failed: deliveriesData.find((d) => d.status === 'failed')?.count || 0,
    collected: deliveriesData.reduce((sum, d) => sum + Number(d.collected || 0), 0),
  };

  const paymentsSummary = {
    total: paymentsData.reduce((sum, p) => sum + Number(p.total || 0), 0),
    count: paymentsData.reduce((sum, p) => sum + Number(p.count), 0),
    byMode: Object.fromEntries(
      paymentsData.map((p) => [p.mode, { count: Number(p.count), total: Number(p.total || 0) }])
    ),
  };

  return {
    date,
    orders: ordersSummary,
    deliveries: deliveriesSummary,
    payments: paymentsSummary,
    topProducts,
    delivererPerformance: delivererPerformance.map((d) => ({
      ...d,
      successRate: d.total > 0 
        ? Math.round((Number(d.completed) / Number(d.total)) * 100) 
        : 0,
    })),
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// RAPPORT HEBDOMADAIRE
// ═══════════════════════════════════════════════════════════════════════════════

export const generateWeeklyReport = async (
  organizationId: string,
  weekStart: string
) => {
  const startDate = new Date(weekStart);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 7);

  // Stats par jour
  const dailyStats = await db.execute(sql`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as orders,
      COALESCE(SUM(total_amount), 0) as revenue
    FROM orders
    WHERE organization_id = ${organizationId}
      AND created_at >= ${startDate}
      AND created_at < ${endDate}
      AND status NOT IN ('cancelled', 'draft')
    GROUP BY DATE(created_at)
    ORDER BY date
  `);

  // Collections par jour
  const dailyCollections = await db.execute(sql`
    SELECT 
      DATE(created_at) as date,
      COALESCE(SUM(amount), 0) as collected
    FROM payments
    WHERE organization_id = ${organizationId}
      AND created_at >= ${startDate}
      AND created_at < ${endDate}
    GROUP BY DATE(created_at)
    ORDER BY date
  `);

  // Comparaison avec semaine précédente
  const prevWeekStart = new Date(startDate);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);

  const [currentWeek] = await db
    .select({
      orders: count(orders.id),
      revenue: sum(orders.total),
    })
    .from(orders)
    .where(
      and(
        eq(orders.organizationId, organizationId),
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate),
        sql`${orders.status} NOT IN ('cancelled', 'draft')`
      )
    );

  const [previousWeek] = await db
    .select({
      orders: count(orders.id),
      revenue: sum(orders.total),
    })
    .from(orders)
    .where(
      and(
        eq(orders.organizationId, organizationId),
        gte(orders.createdAt, prevWeekStart),
        lte(orders.createdAt, startDate),
        sql`${orders.status} NOT IN ('cancelled', 'draft')`
      )
    );

  const growth = {
    orders: previousWeek?.orders
      ? ((Number(currentWeek?.orders) - Number(previousWeek?.orders)) /
          Number(previousWeek?.orders)) *
        100
      : 0,
    revenue: previousWeek?.revenue
      ? ((Number(currentWeek?.revenue || 0) - Number(previousWeek?.revenue || 0)) /
          Number(previousWeek?.revenue || 1)) *
        100
      : 0,
  };

  return {
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
    summary: {
      orders: Number(currentWeek?.orders) || 0,
      revenue: Number(currentWeek?.revenue) || 0,
      avgOrderValue:
        currentWeek?.orders && currentWeek?.revenue
          ? Number(currentWeek.revenue) / Number(currentWeek.orders)
          : 0,
    },
    growth,
    dailyStats: dailyStats.rows,
    dailyCollections: dailyCollections.rows,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// RAPPORT MENSUEL
// ═══════════════════════════════════════════════════════════════════════════════

export const generateMonthlyReport = async (
  organizationId: string,
  year: number,
  month: number
) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  // Stats globales
  const [monthStats] = await db
    .select({
      totalOrders: count(orders.id),
      totalRevenue: sum(orders.total),
      avgOrderValue: sql<number>`AVG(${orders.total})`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.organizationId, organizationId),
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate),
        sql`${orders.status} NOT IN ('cancelled', 'draft')`
      )
    );

  const [collectionsStats] = await db
    .select({
      totalCollected: sum(payments.amount),
      paymentCount: count(payments.id),
    })
    .from(payments)
    .where(
      and(
        eq(payments.organizationId, organizationId),
        gte(payments.createdAt, startDate),
        lte(payments.createdAt, endDate)
      )
    );

  // Nouveaux clients
  const [newCustomers] = await db
    .select({
      count: count(customers.id),
    })
    .from(customers)
    .where(
      and(
        eq(customers.organizationId, organizationId),
        gte(customers.createdAt, startDate),
        lte(customers.createdAt, endDate)
      )
    );

  // Évolution dette
  const [debtStats] = await db
    .select({
      totalDebt: sum(customers.currentDebt),
      customersWithDebt: sql<number>`COUNT(*) FILTER (WHERE ${customers.currentDebt} > 0)`,
    })
    .from(customers)
    .where(
      and(
        eq(customers.organizationId, organizationId),
        eq(customers.isActive, true)
      )
    );

  // Stats par semaine
  const weeklyStats = await db.execute(sql`
    SELECT 
      DATE_TRUNC('week', created_at) as week_start,
      COUNT(*) as orders,
      COALESCE(SUM(total_amount), 0) as revenue
    FROM orders
    WHERE organization_id = ${organizationId}
      AND created_at >= ${startDate}
      AND created_at <= ${endDate}
      AND status NOT IN ('cancelled', 'draft')
    GROUP BY DATE_TRUNC('week', created_at)
    ORDER BY week_start
  `);

  return {
    period: {
      year,
      month,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
    summary: {
      totalOrders: Number(monthStats?.totalOrders) || 0,
      totalRevenue: Number(monthStats?.totalRevenue) || 0,
      avgOrderValue: Number(monthStats?.avgOrderValue) || 0,
      totalCollected: Number(collectionsStats?.totalCollected) || 0,
      collectionRate: monthStats?.totalRevenue
        ? (Number(collectionsStats?.totalCollected || 0) / Number(monthStats.totalRevenue)) * 100
        : 0,
    },
    customers: {
      new: Number(newCustomers?.count) || 0,
      totalDebt: Number(debtStats?.totalDebt) || 0,
      withDebt: Number(debtStats?.customersWithDebt) || 0,
    },
    weeklyStats: weeklyStats.rows,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// RELEVÉ CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

export const generateCustomerStatement = async (
  organizationId: string,
  customerId: string,
  startDate: string,
  endDate: string
) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  // Info client
  const customer = await db.query.customers.findFirst({
    where: and(
      eq(customers.id, customerId),
      eq(customers.organizationId, organizationId)
    ),
  });

  if (!customer) {
    throw new Error('Client introuvable');
  }

  // Commandes
  const ordersList = await db.query.orders.findMany({
    where: and(
      eq(orders.customerId, customerId),
      gte(orders.createdAt, start),
      lte(orders.createdAt, end),
      sql`${orders.status} NOT IN ('cancelled', 'draft')`
    ),
    orderBy: [orders.createdAt],
  });

  // Paiements
  const paymentsList = await db.query.payments.findMany({
    where: and(
      eq(payments.customerId, customerId),
      gte(payments.createdAt, start),
      lte(payments.createdAt, end)
    ),
    orderBy: [payments.createdAt],
  });

  // Construire les mouvements
  const movements = [
    ...ordersList.map((o) => ({
      date: o.createdAt,
      type: 'order' as const,
      reference: o.orderNumber,
      description: `Commande #${o.orderNumber}`,
      debit: o.total,
      credit: 0,
    })),
    ...paymentsList.map((p) => ({
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
  const lines = movements.map((m) => {
    balance += m.debit - m.credit;
    return { ...m, balance };
  });

  return {
    customer: {
      id: customer.id,
      code: customer.code,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
    },
    period: { startDate, endDate },
    summary: {
      totalDebits: ordersList.reduce((sum, o) => sum + o.total, 0),
      totalCredits: paymentsList.reduce((sum, p) => sum + p.amount, 0),
      currentBalance: customer.currentDebt,
    },
    movements: lines,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT EXCEL
// ═══════════════════════════════════════════════════════════════════════════════

export const exportToExcel = async (
  organizationId: string,
  type: string,
  params: Record<string, any>
): Promise<string> => {
  const workbook = new ExcelJS.Workbook();

  switch (type) {
    case 'orders':
      await exportOrders(workbook, organizationId, params);
      break;
    case 'customers':
      await exportCustomers(workbook, organizationId, params);
      break;
    case 'products':
      await exportProducts(workbook, organizationId, params);
      break;
    case 'payments':
      await exportPayments(workbook, organizationId, params);
      break;
    case 'deliveries':
      await exportDeliveries(workbook, organizationId, params);
      break;
    default:
      throw new Error(`Type d'export inconnu: ${type}`);
  }

  // Sauvegarder dans un fichier temporaire
  const filename = `${type}-${uuidv4()}.xlsx`;
  const filepath = join(tmpdir(), filename);
  await workbook.xlsx.writeFile(filepath);

  return filepath;
};

async function exportOrders(
  workbook: ExcelJS.Workbook,
  organizationId: string,
  params: { startDate?: string; endDate?: string }
) {
  const sheet = workbook.addWorksheet('Commandes');

  // En-têtes
  sheet.columns = [
    { header: 'Numéro', key: 'orderNumber', width: 20 },
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Client', key: 'customerName', width: 30 },
    { header: 'Statut', key: 'status', width: 15 },
    { header: 'Sous-total', key: 'subtotal', width: 15 },
    { header: 'Remise', key: 'discount', width: 12 },
    { header: 'Total', key: 'total', width: 15 },
    { header: 'Payé', key: 'paid', width: 15 },
    { header: 'Reste', key: 'remaining', width: 15 },
  ];

  // Style en-têtes
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // Données
  const conditions = [eq(orders.organizationId, organizationId)];
  if (params.startDate) {
    conditions.push(gte(orders.createdAt, new Date(params.startDate)));
  }
  if (params.endDate) {
    conditions.push(lte(orders.createdAt, new Date(params.endDate)));
  }

  const data = await db.query.orders.findMany({
    where: and(...conditions),
    with: {
      customer: true,
    },
    orderBy: [desc(orders.createdAt)],
  });

  for (const order of data) {
    sheet.addRow({
      orderNumber: order.orderNumber,
      date: order.createdAt.toLocaleDateString('fr-FR'),
      customerName: order.customer?.name || 'N/A',
      status: order.status,
      subtotal: order.subtotal,
      discount: order.discount,
      total: order.total,
      paid: order.paidAmount,
      remaining: order.total - order.amountPaid,
    });
  }
}

async function exportCustomers(
  workbook: ExcelJS.Workbook,
  organizationId: string,
  params: { hasDebt?: boolean }
) {
  const sheet = workbook.addWorksheet('Clients');

  sheet.columns = [
    { header: 'Code', key: 'code', width: 15 },
    { header: 'Nom', key: 'name', width: 30 },
    { header: 'Téléphone', key: 'phone', width: 15 },
    { header: 'Adresse', key: 'address', width: 40 },
    { header: 'Ville', key: 'city', width: 15 },
    { header: 'Dette actuelle', key: 'debt', width: 15 },
    { header: 'Limite crédit', key: 'creditLimit', width: 15 },
    { header: 'Actif', key: 'isActive', width: 10 },
  ];

  sheet.getRow(1).font = { bold: true };

  const conditions = [eq(customers.organizationId, organizationId)];
  if (params.hasDebt) {
    conditions.push(sql`${customers.currentDebt} > 0`);
  }

  const data = await db.query.customers.findMany({
    where: and(...conditions),
    orderBy: [customers.name],
  });

  for (const customer of data) {
    sheet.addRow({
      code: customer.code,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      city: customer.city,
      debt: customer.currentDebt,
      creditLimit: customer.creditLimit,
      isActive: customer.isActive ? 'Oui' : 'Non',
    });
  }
}

async function exportProducts(
  workbook: ExcelJS.Workbook,
  organizationId: string,
  params: { lowStock?: boolean }
) {
  const sheet = workbook.addWorksheet('Produits');

  sheet.columns = [
    { header: 'SKU', key: 'sku', width: 15 },
    { header: 'Nom', key: 'name', width: 30 },
    { header: 'Catégorie', key: 'category', width: 20 },
    { header: 'Prix de base', key: 'basePrice', width: 15 },
    { header: 'Prix promo', key: 'discountPrice', width: 15 },
    { header: 'Prix actuel', key: 'currentPrice', width: 15 },
    { header: 'Stock', key: 'stock', width: 12 },
    { header: 'Seuil min', key: 'minStock', width: 12 },
    { header: 'Actif', key: 'isActive', width: 10 },
  ];

  sheet.getRow(1).font = { bold: true };

  const conditions = [eq(products.organizationId, organizationId)];
  if (params.lowStock) {
    conditions.push(sql`${products.stockQuantity} <= ${products.minStockLevel}`);
  }

  const data = await db.query.products.findMany({
    where: and(...conditions),
    with: {
      category: true,
    },
    orderBy: [products.name],
  });

  for (const product of data) {
    sheet.addRow({
      sku: product.sku,
      name: product.name,
      category: product.category?.name || 'N/A',
      basePrice: product.basePrice,
      discountPrice: product.discountPrice,
      currentPrice: product.currentPrice,
      stock: product.stockQuantity,
      minStock: product.minStockLevel,
      isActive: product.isActive ? 'Oui' : 'Non',
    });
  }
}

async function exportPayments(
  workbook: ExcelJS.Workbook,
  organizationId: string,
  params: { startDate?: string; endDate?: string }
) {
  const sheet = workbook.addWorksheet('Paiements');

  sheet.columns = [
    { header: 'Reçu', key: 'receipt', width: 20 },
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Client', key: 'customer', width: 30 },
    { header: 'Mode', key: 'mode', width: 15 },
    { header: 'Montant', key: 'amount', width: 15 },
    { header: 'Type', key: 'type', width: 15 },
    { header: 'Encaissé par', key: 'collectedBy', width: 20 },
  ];

  sheet.getRow(1).font = { bold: true };

  const conditions = [eq(payments.organizationId, organizationId)];
  if (params.startDate) {
    conditions.push(gte(payments.createdAt, new Date(params.startDate)));
  }
  if (params.endDate) {
    conditions.push(lte(payments.createdAt, new Date(params.endDate)));
  }

  const data = await db.query.payments.findMany({
    where: and(...conditions),
    with: {
      customer: true,
      collectedBy: true,
    },
    orderBy: [desc(payments.createdAt)],
  });

  for (const payment of data) {
    sheet.addRow({
      receipt: payment.receiptNumber,
      date: payment.createdAt.toLocaleDateString('fr-FR'),
      customer: payment.customer?.name || 'N/A',
      mode: payment.mode,
      amount: payment.amount,
      type: payment.paymentType,
      collectedBy: payment.collectedBy?.name || 'N/A',
    });
  }
}

async function exportDeliveries(
  workbook: ExcelJS.Workbook,
  organizationId: string,
  params: { startDate?: string; endDate?: string; delivererId?: string }
) {
  const sheet = workbook.addWorksheet('Livraisons');

  sheet.columns = [
    { header: 'Commande', key: 'order', width: 20 },
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Client', key: 'customer', width: 30 },
    { header: 'Livreur', key: 'deliverer', width: 20 },
    { header: 'Statut', key: 'status', width: 15 },
    { header: 'À encaisser', key: 'toCollect', width: 15 },
    { header: 'Encaissé', key: 'collected', width: 15 },
    { header: 'Mode', key: 'mode', width: 15 },
  ];

  sheet.getRow(1).font = { bold: true };

  const conditions = [eq(deliveries.organizationId, organizationId)];
  if (params.startDate) {
    conditions.push(gte(deliveries.deliveryDate, new Date(params.startDate)));
  }
  if (params.endDate) {
    conditions.push(lte(deliveries.deliveryDate, new Date(params.endDate)));
  }
  if (params.delivererId) {
    conditions.push(eq(deliveries.delivererId, params.delivererId));
  }

  const data = await db.query.deliveries.findMany({
    where: and(...conditions),
    with: {
      order: true,
      customer: true,
      deliverer: true,
    },
    orderBy: [desc(deliveries.deliveryDate)],
  });

  for (const delivery of data) {
    sheet.addRow({
      order: delivery.order?.orderNumber || 'N/A',
      date: delivery.deliveryDate.toLocaleDateString('fr-FR'),
      customer: delivery.customer?.name || 'N/A',
      deliverer: delivery.deliverer?.name || 'N/A',
      status: delivery.status,
      toCollect: delivery.amountToCollect,
      collected: delivery.amountCollected,
      mode: delivery.collectionMode || '-',
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALIASES ET STUBS
// ═══════════════════════════════════════════════════════════════════════════════

export const exportReport = exportToExcel;

// Stubs pour compatibilité
export const generateDelivererPerformanceReport = async (organizationId: string, params: any): Promise<any> => {
  return { success: true, message: 'Stub - à implémenter', data: [] };
};

export const generateSalesReport = async (organizationId: string, params: any): Promise<any> => {
  return { success: true, message: 'Stub - à implémenter', data: [] };
};

export const generateDebtAgingReport = async (organizationId: string, params: any): Promise<any> => {
  return { success: true, message: 'Stub - à implémenter', data: [] };
};

export const generateProductsReport = async (organizationId: string, params: any): Promise<any> => {
  return { success: true, message: 'Stub - à implémenter', data: [] };
};

export const generateDailyCashReport = async (organizationId: string, params: any): Promise<any> => {
  return { success: true, message: 'Stub - à implémenter', data: [] };
};

export const exportToPdf = async (data: any, options?: any): Promise<Buffer> => {
  return Buffer.from('PDF stub');
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export const reportService = {
  daily: generateDailyReport,
  weekly: generateWeeklyReport,
  monthly: generateMonthlyReport,
  delivererPerformance: generateDelivererPerformanceReport,
  customerStatement: generateCustomerStatement,
  exportData: exportToExcel,
};

export class ReportService {
  static daily = generateDailyReport;
  static weekly = generateWeeklyReport;
  static monthly = generateMonthlyReport;
  static delivererPerformance = generateDelivererPerformanceReport;
  static customerStatement = generateCustomerStatement;
  static exportData = exportToExcel;
}

export default reportService;
