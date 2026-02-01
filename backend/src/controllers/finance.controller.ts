// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - FINANCE CONTROLLER
// Méthodes: overview, debts, agingReport, dailySummary, reconciliation
// ═══════════════════════════════════════════════════════════════════════════════

import { Request, Response, NextFunction } from 'express';
import { db } from '../database';
import { customers, orders, paymentHistory, dailyCash } from '../database/schema';
import { eq, and, gte, lte, desc, sql, count, sum } from 'drizzle-orm';

// Route: financeRoutes.get('/overview')
export const overview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.user!;
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate as string) : new Date(new Date().setDate(1));
    const end = endDate ? new Date(endDate as string) : new Date();

    const [revenue] = await db
      .select({ totalOrders: count(), totalRevenue: sum(orders.total) })
      .from(orders)
      .where(and(
        eq(orders.organizationId, organizationId),
        eq(orders.status, 'delivered'),
        gte(orders.createdAt, start), lte(orders.createdAt, end)
      ));

    const [collections] = await db
      .select({ totalPayments: count(), totalCollected: sum(paymentHistory.amount) })
      .from(paymentHistory)
      .where(and(
        eq(paymentHistory.organizationId, organizationId),
        gte(paymentHistory.createdAt, start), lte(paymentHistory.createdAt, end)
      ));

    const [debtsData] = await db
      .select({ totalDebt: sum(customers.currentDebt), count: count() })
      .from(customers)
      .where(and(
        eq(customers.organizationId, organizationId),
        sql`${customers.currentDebt} > 0`
      ));

    const totalRev = Number(revenue.totalRevenue) || 0;
    const totalCol = Number(collections.totalCollected) || 0;

    res.json({
      success: true,
      data: {
        period: { start, end },
        revenue: { totalOrders: revenue.totalOrders, totalRevenue: totalRev },
        collections: { totalPayments: collections.totalPayments, totalCollected: totalCol },
        debts: { totalDebt: Number(debtsData.totalDebt) || 0, customersWithDebt: debtsData.count },
        collectionRate: totalRev > 0 ? ((totalCol / totalRev) * 100).toFixed(1) : 0,
      },
    });
  } catch (error) { next(error); }
};

// Route: financeRoutes.get('/debts')
export const debts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.user!;
    const { limit = '50', sortBy = 'debt' } = req.query;

    const result = await db
      .select({
        id: customers.id, code: customers.code, name: customers.name,
        phone: customers.phone, currentDebt: customers.currentDebt,
        creditLimit: customers.creditLimit, creditLimitEnabled: customers.creditLimitEnabled,
      })
      .from(customers)
      .where(and(
        eq(customers.organizationId, organizationId),
        sql`${customers.currentDebt} > 0`
      ))
      .orderBy(desc(customers.currentDebt))
      .limit(parseInt(limit as string, 10));

    const [totals] = await db
      .select({ totalDebt: sum(customers.currentDebt), count: count() })
      .from(customers)
      .where(and(
        eq(customers.organizationId, organizationId),
        sql`${customers.currentDebt} > 0`
      ));

    res.json({
      success: true,
      data: result,
      summary: { totalDebt: Number(totals.totalDebt) || 0, customersWithDebt: totals.count },
    });
  } catch (error) { next(error); }
};

// Route: financeRoutes.get('/aging-report')
export const agingReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.user!;
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 86400000);
    const d60 = new Date(now.getTime() - 60 * 86400000);
    const d90 = new Date(now.getTime() - 90 * 86400000);

    // Commandes impayées groupées par ancienneté
    const aging = await db
      .select({
        bucket: sql<string>`
          CASE
            WHEN ${orders.createdAt} >= ${d30} THEN '0-30'
            WHEN ${orders.createdAt} >= ${d60} THEN '31-60'
            WHEN ${orders.createdAt} >= ${d90} THEN '61-90'
            ELSE '90+'
          END`,
        count: count(),
        total: sql<number>`SUM(${orders.total} - ${orders.amountPaid})`,
      })
      .from(orders)
      .where(and(
        eq(orders.organizationId, organizationId),
        sql`${orders.total} > ${orders.amountPaid}`,
        sql`${orders.status} != 'cancelled'`
      ))
      .groupBy(sql`1`);

    res.json({
      success: true,
      data: {
        buckets: [
          { range: '0-30 jours', ...findBucket(aging, '0-30') },
          { range: '31-60 jours', ...findBucket(aging, '31-60') },
          { range: '61-90 jours', ...findBucket(aging, '61-90') },
          { range: '90+ jours', ...findBucket(aging, '90+') },
        ],
        totalOutstanding: aging.reduce((s, b) => s + Number(b.total || 0), 0),
      },
    });
  } catch (error) { next(error); }
};

// Route: financeRoutes.get('/daily-summary')
export const dailySummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.user!;
    const { days = '30' } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string, 10));

    const dailyRevenue = await db
      .select({
        date: sql<string>`DATE(${orders.createdAt})`,
        orders: count(),
        revenue: sum(orders.total),
      })
      .from(orders)
      .where(and(
        eq(orders.organizationId, organizationId),
        eq(orders.status, 'delivered'),
        gte(orders.createdAt, startDate)
      ))
      .groupBy(sql`DATE(${orders.createdAt})`)
      .orderBy(sql`DATE(${orders.createdAt})`);

    const dailyPayments = await db
      .select({
        date: sql<string>`DATE(${paymentHistory.createdAt})`,
        payments: count(),
        collected: sum(paymentHistory.amount),
      })
      .from(paymentHistory)
      .where(and(
        eq(paymentHistory.organizationId, organizationId),
        gte(paymentHistory.createdAt, startDate)
      ))
      .groupBy(sql`DATE(${paymentHistory.createdAt})`)
      .orderBy(sql`DATE(${paymentHistory.createdAt})`);

    res.json({
      success: true,
      data: {
        revenue: dailyRevenue.map(d => ({ date: d.date, orders: d.orders, revenue: Number(d.revenue) || 0 })),
        payments: dailyPayments.map(d => ({ date: d.date, payments: d.payments, collected: Number(d.collected) || 0 })),
      },
    });
  } catch (error) { next(error); }
};

// Route: financeRoutes.get('/reconciliation')
export const reconciliation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.user!;
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate as string) : new Date(new Date().setDate(1));
    const end = endDate ? new Date(endDate as string) : new Date();

    // Totaux commandes
    const [orderTotals] = await db
      .select({ count: count(), total: sum(orders.total), paid: sum(orders.amountPaid) })
      .from(orders)
      .where(and(
        eq(orders.organizationId, organizationId),
        sql`${orders.status} != 'cancelled'`,
        gte(orders.createdAt, start), lte(orders.createdAt, end)
      ));

    // Totaux paiements par mode
    const paymentsByMode = await db
      .select({ mode: paymentHistory.mode, count: count(), total: sum(paymentHistory.amount) })
      .from(paymentHistory)
      .where(and(
        eq(paymentHistory.organizationId, organizationId),
        gte(paymentHistory.createdAt, start), lte(paymentHistory.createdAt, end)
      ))
      .groupBy(paymentHistory.mode);

    // Sessions caisse
    const cashSessions = await db
      .select()
      .from(dailyCash)
      .where(and(
        eq(dailyCash.organizationId, organizationId),
        gte(dailyCash.date, start.toISOString().split('T')[0]),
        lte(dailyCash.date, end.toISOString().split('T')[0])
      ))
      .orderBy(desc(dailyCash.date));

    const totalOrders = Number(orderTotals.total) || 0;
    const totalPaid = Number(orderTotals.paid) || 0;

    res.json({
      success: true,
      data: {
        period: { start, end },
        orders: { count: orderTotals.count, total: totalOrders, paid: totalPaid, outstanding: totalOrders - totalPaid },
        paymentsByMode: paymentsByMode.map(p => ({
          mode: p.mode,
          count: p.count,
          total: Number(p.total) || 0,
        })),
        cashSessions: cashSessions.length,
      },
    });
  } catch (error) { next(error); }
};

// Helper
function findBucket(aging: any[], key: string) {
  const found = aging.find(a => a.bucket === key);
  return { count: found?.count || 0, total: Number(found?.total) || 0 };
}
