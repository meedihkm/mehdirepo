// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - SERVICE DASHBOARD
// Statistiques, KPIs, rapports financiers
// ═══════════════════════════════════════════════════════════════════════════════

import { eq, and, sql, gte, lte, desc, asc, sum, count } from 'drizzle-orm';
import { db } from '../database';
import {
  orders,
  orderItems,
  deliveries,
  payments,
  customers,
  products,
  users,
} from '../database/schema';
import { cacheGetOrSet, cacheKeys } from '../cache';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface DashboardOverview {
  today: {
    orders: number;
    revenue: number;
    deliveries: number;
    completedDeliveries: number;
    collections: number;
  };
  month: {
    orders: number;
    revenue: number;
    newCustomers: number;
    averageOrderValue: number;
  };
  totals: {
    totalDebt: number;
    activeCustomers: number;
    activeProducts: number;
    lowStockProducts: number;
  };
}

interface DailyStats {
  date: string;
  orders: {
    total: number;
    confirmed: number;
    delivered: number;
    cancelled: number;
  };
  deliveries: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
  };
  revenue: {
    gross: number;
    collected: number;
    debt: number;
  };
  topProducts: Array<{
    id: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// APERÇU GÉNÉRAL
// ═══════════════════════════════════════════════════════════════════════════════

export const getOverview = async (organizationId: string): Promise<DashboardOverview> => {
  return cacheGetOrSet(
    cacheKeys.dashboardStats(organizationId),
    async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      // Stats du jour
      const [todayStats] = await db
        .select({
          orderCount: count(orders.id),
          revenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.organizationId, organizationId),
            gte(orders.createdAt, today)
          )
        );

      const [todayDeliveries] = await db
        .select({
          total: count(deliveries.id),
          completed: sql<number>`COUNT(*) FILTER (WHERE ${deliveries.status} = 'delivered')`,
        })
        .from(deliveries)
        .where(
          and(
            eq(deliveries.organizationId, organizationId),
            gte(deliveries.deliveryDate, today)
          )
        );

      const [todayCollections] = await db
        .select({
          total: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
        })
        .from(payments)
        .where(
          and(
            eq(payments.organizationId, organizationId),
            gte(payments.createdAt, today)
          )
        );

      // Stats du mois
      const [monthStats] = await db
        .select({
          orderCount: count(orders.id),
          revenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
          avgOrderValue: sql<number>`COALESCE(AVG(${orders.total}), 0)`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.organizationId, organizationId),
            gte(orders.createdAt, monthStart)
          )
        );

      const [newCustomersCount] = await db
        .select({
          count: count(customers.id),
        })
        .from(customers)
        .where(
          and(
            eq(customers.organizationId, organizationId),
            gte(customers.createdAt, monthStart)
          )
        );

      // Totaux
      const [totalDebt] = await db
        .select({
          total: sql<number>`COALESCE(SUM(${customers.currentDebt}), 0)`,
        })
        .from(customers)
        .where(
          and(
            eq(customers.organizationId, organizationId),
            eq(customers.isActive, true)
          )
        );

      const [activeCustomersCount] = await db
        .select({
          count: count(customers.id),
        })
        .from(customers)
        .where(
          and(
            eq(customers.organizationId, organizationId),
            eq(customers.isActive, true)
          )
        );

      const [productCounts] = await db
        .select({
          total: count(products.id),
          lowStock: sql<number>`COUNT(*) FILTER (WHERE ${products.stockQuantity} <= ${products.minStockLevel})`,
        })
        .from(products)
        .where(
          and(
            eq(products.organizationId, organizationId),
            eq(products.isActive, true)
          )
        );

      return {
        today: {
          orders: todayStats?.orderCount || 0,
          revenue: Number(todayStats?.revenue) || 0,
          deliveries: todayDeliveries?.total || 0,
          completedDeliveries: Number(todayDeliveries?.completed) || 0,
          collections: Number(todayCollections?.total) || 0,
        },
        month: {
          orders: monthStats?.orderCount || 0,
          revenue: Number(monthStats?.revenue) || 0,
          newCustomers: newCustomersCount?.count || 0,
          averageOrderValue: Number(monthStats?.avgOrderValue) || 0,
        },
        totals: {
          totalDebt: Number(totalDebt?.total) || 0,
          activeCustomers: activeCustomersCount?.count || 0,
          activeProducts: productCounts?.total || 0,
          lowStockProducts: Number(productCounts?.lowStock) || 0,
        },
      };
    },
    60 // 1 minute
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTIQUES JOURNALIÈRES
// ═══════════════════════════════════════════════════════════════════════════════

export const getDailyStats = async (
  organizationId: string,
  dateStr?: string
): Promise<DailyStats> => {
  const date = dateStr ? new Date(dateStr) : new Date();
  date.setHours(0, 0, 0, 0);
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  const cacheKey = cacheKeys.dailyStats(organizationId, date.toISOString().split('T')[0]);

  return cacheGetOrSet(
    cacheKey,
    async () => {
      // Stats commandes
      const orderStats = await db
        .select({
          status: orders.status,
          count: count(orders.id),
          revenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.organizationId, organizationId),
            gte(orders.createdAt, date),
            lte(orders.createdAt, nextDay)
          )
        )
        .groupBy(orders.status);

      // Stats livraisons
      const deliveryStats = await db
        .select({
          status: deliveries.status,
          count: count(deliveries.id),
        })
        .from(deliveries)
        .where(
          and(
            eq(deliveries.organizationId, organizationId),
            gte(deliveries.deliveryDate, date),
            lte(deliveries.deliveryDate, nextDay)
          )
        )
        .groupBy(deliveries.status);

      // Collections
      const [collections] = await db
        .select({
          total: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
        })
        .from(payments)
        .where(
          and(
            eq(payments.organizationId, organizationId),
            gte(payments.createdAt, date),
            lte(payments.createdAt, nextDay)
          )
        );

      // Top produits du jour
      const topProducts = await db
        .select({
          id: products.id,
          name: products.name,
          quantity: sql<number>`SUM(${orderItems.quantity})`,
          revenue: sql<number>`SUM(${orderItems.quantity} * ${orderItems.unitPrice})`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .innerJoin(products, eq(orderItems.productId, products.id))
        .where(
          and(
            eq(orders.organizationId, organizationId),
            gte(orders.createdAt, date),
            lte(orders.createdAt, nextDay)
          )
        )
        .groupBy(products.id, products.name)
        .orderBy(desc(sql`SUM(${orderItems.quantity})`))
        .limit(5);

      // Agréger les stats
      const orderSummary = {
        total: 0,
        confirmed: 0,
        delivered: 0,
        cancelled: 0,
      };
      let grossRevenue = 0;

      for (const stat of orderStats) {
        orderSummary.total += stat.count;
        if (stat.status === 'confirmed') orderSummary.confirmed = stat.count;
        if (stat.status === 'delivered') orderSummary.delivered = stat.count;
        if (stat.status === 'cancelled') orderSummary.cancelled = stat.count;
        grossRevenue += Number(stat.revenue);
      }

      const deliverySummary = {
        total: 0,
        completed: 0,
        failed: 0,
        pending: 0,
      };

      for (const stat of deliveryStats) {
        deliverySummary.total += stat.count;
        if (stat.status === 'delivered') deliverySummary.completed = stat.count;
        if (stat.status === 'failed') deliverySummary.failed = stat.count;
        if (stat.status === 'pending' || stat.status === 'assigned')
          deliverySummary.pending += stat.count;
      }

      const collected = Number(collections?.total) || 0;

      return {
        date: date.toISOString().split('T')[0],
        orders: orderSummary,
        deliveries: deliverySummary,
        revenue: {
          gross: grossRevenue,
          collected,
          debt: grossRevenue - collected,
        },
        topProducts: topProducts.map((p) => ({
          id: p.id,
          name: p.name,
          quantity: Number(p.quantity),
          revenue: Number(p.revenue),
        })),
      };
    },
    300 // 5 minutes
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTIQUES DES VENTES
// ═══════════════════════════════════════════════════════════════════════════════

export const getSalesStats = async (
  organizationId: string,
  startDate: string,
  endDate: string,
  groupBy: 'day' | 'week' | 'month' = 'day'
) => {
  const dateFormat = {
    day: 'YYYY-MM-DD',
    week: 'IYYY-IW',
    month: 'YYYY-MM',
  };

  const stats = await db.execute(sql`
    SELECT 
      TO_CHAR(created_at, ${dateFormat[groupBy]}) as period,
      COUNT(*) as order_count,
      COALESCE(SUM(total_amount), 0) as revenue,
      COALESCE(AVG(total_amount), 0) as avg_order_value
    FROM orders
    WHERE organization_id = ${organizationId}
      AND created_at >= ${startDate}::date
      AND created_at <= ${endDate}::date + INTERVAL '1 day'
      AND status NOT IN ('cancelled', 'draft')
    GROUP BY TO_CHAR(created_at, ${dateFormat[groupBy]})
    ORDER BY period
  `);

  return stats.rows;
};

// ═══════════════════════════════════════════════════════════════════════════════
// TOP PRODUITS
// ═══════════════════════════════════════════════════════════════════════════════

export const getTopProducts = async (
  organizationId: string,
  startDate: string,
  endDate: string,
  limit: number = 10
) => {
  const topProducts = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      category: sql<string>`c.name`,
      totalQuantity: sql<number>`SUM(${orderItems.quantity})`,
      totalRevenue: sql<number>`SUM(${orderItems.quantity} * ${orderItems.unitPrice})`,
      orderCount: sql<number>`COUNT(DISTINCT ${orders.id})`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(products, eq(orderItems.productId, products.id))
    .leftJoin(sql`categories c`, sql`c.id = ${products.categoryId}`)
    .where(
      and(
        eq(orders.organizationId, organizationId),
        gte(orders.createdAt, new Date(startDate)),
        lte(orders.createdAt, new Date(endDate)),
        sql`${orders.status} NOT IN ('cancelled', 'draft')`
      )
    )
    .groupBy(products.id, products.sku, products.name, sql`c.name`)
    .orderBy(desc(sql`SUM(${orderItems.quantity} * ${orderItems.unitPrice})`))
    .limit(limit);

  return topProducts;
};

// ═══════════════════════════════════════════════════════════════════════════════
// TOP CLIENTS
// ═══════════════════════════════════════════════════════════════════════════════

export const getTopCustomers = async (
  organizationId: string,
  startDate: string,
  endDate: string,
  limit: number = 10,
  sortBy: 'revenue' | 'orders' | 'debt' = 'revenue'
) => {
  const orderByClause = {
    revenue: desc(sql`total_revenue`),
    orders: desc(sql`order_count`),
    debt: desc(customers.currentDebt),
  };

  const topCustomers = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      currentDebt: customers.currentDebt,
      totalRevenue: sql<number>`COALESCE(SUM(o.total_amount), 0) as total_revenue`,
      orderCount: sql<number>`COUNT(o.id) as order_count`,
      avgOrderValue: sql<number>`COALESCE(AVG(o.total_amount), 0)`,
    })
    .from(customers)
    .leftJoin(
      sql`orders o`,
      sql`o.customer_id = ${customers.id} 
          AND o.created_at >= ${startDate}::date 
          AND o.created_at <= ${endDate}::date + INTERVAL '1 day'
          AND o.status NOT IN ('cancelled', 'draft')`
    )
    .where(
      and(
        eq(customers.organizationId, organizationId),
        eq(customers.isActive, true)
      )
    )
    .groupBy(customers.id)
    .orderBy(orderByClause[sortBy])
    .limit(limit);

  return topCustomers;
};

// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE LIVREURS
// ═══════════════════════════════════════════════════════════════════════════════

export const getDelivererPerformance = async (
  organizationId: string,
  startDate: string,
  endDate: string
) => {
  const performance = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      totalDeliveries: sql<number>`COUNT(${deliveries.id})`,
      completedDeliveries: sql<number>`COUNT(*) FILTER (WHERE ${deliveries.status} = 'delivered')`,
      failedDeliveries: sql<number>`COUNT(*) FILTER (WHERE ${deliveries.status} = 'failed')`,
      totalCollected: sql<number>`COALESCE(SUM(${deliveries.amountCollected}), 0)`,
      avgDeliveryTime: sql<number>`AVG(EXTRACT(EPOCH FROM (${deliveries.completedAt} - ${deliveries.startedAt})) / 60)`,
    })
    .from(users)
    .leftJoin(
      deliveries,
      and(
        eq(deliveries.delivererId, users.id),
        gte(deliveries.deliveryDate, new Date(startDate)),
        lte(deliveries.deliveryDate, new Date(endDate))
      )
    )
    .where(
      and(
        eq(users.organizationId, organizationId),
        eq(users.role, 'deliverer'),
        eq(users.isActive, true)
      )
    )
    .groupBy(users.id, users.name, users.email)
    .orderBy(desc(sql`COUNT(${deliveries.id})`));

  return performance.map((p) => ({
    ...p,
    successRate:
      p.totalDeliveries > 0
        ? Math.round((Number(p.completedDeliveries) / Number(p.totalDeliveries)) * 100)
        : 0,
    avgDeliveryTime: p.avgDeliveryTime ? Math.round(Number(p.avgDeliveryTime)) : null,
  }));
};

// ═══════════════════════════════════════════════════════════════════════════════
// APERÇU DETTES
// ═══════════════════════════════════════════════════════════════════════════════

export const getDebtOverview = async (organizationId: string) => {
  const [totals] = await db
    .select({
      totalDebt: sql<number>`COALESCE(SUM(${customers.currentDebt}), 0)`,
      customerCount: sql<number>`COUNT(*) FILTER (WHERE ${customers.currentDebt} > 0)`,
      avgDebt: sql<number>`COALESCE(AVG(${customers.currentDebt}) FILTER (WHERE ${customers.currentDebt} > 0), 0)`,
      maxDebt: sql<number>`COALESCE(MAX(${customers.currentDebt}), 0)`,
    })
    .from(customers)
    .where(
      and(
        eq(customers.organizationId, organizationId),
        eq(customers.isActive, true)
      )
    );

  // Distribution par tranche
  const distribution = await db.execute(sql`
    SELECT 
      CASE 
        WHEN current_debt = 0 THEN '0'
        WHEN current_debt <= 10000 THEN '1-10K'
        WHEN current_debt <= 50000 THEN '10K-50K'
        WHEN current_debt <= 100000 THEN '50K-100K'
        ELSE '100K+'
      END as range,
      COUNT(*) as count,
      COALESCE(SUM(current_debt), 0) as total
    FROM customers
    WHERE organization_id = ${organizationId} AND is_active = true
    GROUP BY 1
    ORDER BY MIN(current_debt)
  `);

  return {
    totals: {
      totalDebt: Number(totals?.totalDebt) || 0,
      customerCount: Number(totals?.customerCount) || 0,
      avgDebt: Number(totals?.avgDebt) || 0,
      maxDebt: Number(totals?.maxDebt) || 0,
    },
    distribution: distribution.rows,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// RAPPORT AGING
// ═══════════════════════════════════════════════════════════════════════════════

export const getAgingReport = async (organizationId: string) => {
  const report = await db.execute(sql`
    WITH customer_aging AS (
      SELECT 
        c.id,
        c.name,
        c.current_debt,
        c.credit_limit,
        COALESCE(
          (SELECT MAX(created_at) FROM payments WHERE customer_id = c.id),
          c.created_at
        ) as last_payment_date
      FROM customers c
      WHERE c.organization_id = ${organizationId} 
        AND c.is_active = true
        AND c.current_debt > 0
    )
    SELECT 
      id,
      name,
      current_debt,
      credit_limit,
      last_payment_date,
      CURRENT_DATE - last_payment_date::date as days_since_payment,
      CASE 
        WHEN CURRENT_DATE - last_payment_date::date <= 30 THEN 'current'
        WHEN CURRENT_DATE - last_payment_date::date <= 60 THEN '30-60'
        WHEN CURRENT_DATE - last_payment_date::date <= 90 THEN '60-90'
        ELSE '90+'
      END as aging_bucket
    FROM customer_aging
    ORDER BY current_debt DESC
  `);

  // Agréger par bucket
  const buckets = {
    current: { count: 0, total: 0 },
    '30-60': { count: 0, total: 0 },
    '60-90': { count: 0, total: 0 },
    '90+': { count: 0, total: 0 },
  };

  for (const row of report.rows as any[]) {
    const bucket = row.aging_bucket as keyof typeof buckets;
    buckets[bucket].count++;
    buckets[bucket].total += Number(row.current_debt);
  }

  return {
    details: report.rows,
    summary: buckets,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// PRÉVISION DE TRÉSORERIE
// ═══════════════════════════════════════════════════════════════════════════════

export const getCashFlowForecast = async (
  organizationId: string,
  days: number = 30
) => {
  // Moyenne des collections quotidiennes sur les 30 derniers jours
  const [avgCollections] = await db.execute(sql`
    SELECT 
      COALESCE(AVG(daily_total), 0) as avg_daily_collection
    FROM (
      SELECT 
        DATE(created_at) as day,
        SUM(amount) as daily_total
      FROM payments
      WHERE organization_id = ${organizationId}
        AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
    ) daily
  `);

  // Commandes en attente de livraison
  const [pendingOrders] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
      count: count(orders.id),
    })
    .from(orders)
    .where(
      and(
        eq(orders.organizationId, organizationId),
        sql`${orders.status} IN ('confirmed', 'preparing', 'ready')`
      )
    );

  // Dette totale recouvrable
  const [totalDebt] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${customers.currentDebt}), 0)`,
    })
    .from(customers)
    .where(
      and(
        eq(customers.organizationId, organizationId),
        eq(customers.isActive, true)
      )
    );

  const avgDaily = Number((avgCollections as any).avg_daily_collection) || 0;

  // Projection simple
  const forecast = [];
  for (let i = 1; i <= days; i++) {
    forecast.push({
      day: i,
      projected: avgDaily * i,
      pendingOrders: Number(pendingOrders?.total) || 0,
      totalRecoverable: (Number(pendingOrders?.total) || 0) + (Number(totalDebt?.total) || 0),
    });
  }

  return {
    avgDailyCollection: avgDaily,
    pendingOrders: {
      count: pendingOrders?.count || 0,
      total: Number(pendingOrders?.total) || 0,
    },
    totalDebt: Number(totalDebt?.total) || 0,
    forecast,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// ALERTES STOCK
// ═══════════════════════════════════════════════════════════════════════════════

export const getStockAlerts = async (organizationId: string) => {
  const lowStock = await db.query.products.findMany({
    where: and(
      eq(products.organizationId, organizationId),
      eq(products.isActive, true),
      sql`${products.stockQuantity} <= ${products.minStockLevel}`
    ),
    with: {
      category: true,
    },
    orderBy: asc(products.stockQuantity),
  });

  const outOfStock = lowStock.filter((p) => p.stockQuantity === 0);
  const critical = lowStock.filter(
    (p) => p.stockQuantity > 0 && p.stockQuantity <= p.minStockLevel / 2
  );
  const warning = lowStock.filter(
    (p) => p.stockQuantity > p.minStockLevel / 2 && p.stockQuantity <= p.minStockLevel
  );

  return {
    summary: {
      outOfStock: outOfStock.length,
      critical: critical.length,
      warning: warning.length,
    },
    outOfStock,
    critical,
    warning,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  getOverview,
  getDailyStats,
  getSalesStats,
  getTopProducts,
  getTopCustomers,
  getDelivererPerformance,
  getDebtOverview,
  getAgingReport,
  getCashFlowForecast,
  getStockAlerts,
};
