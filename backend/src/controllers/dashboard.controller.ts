// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - CONTROLLER DASHBOARD
// Statistiques, KPIs, rapports
// ═══════════════════════════════════════════════════════════════════════════════

import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import dashboardService from '../services/dashboard.service';

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTIQUES GÉNÉRALES
// ═══════════════════════════════════════════════════════════════════════════════

export const getOverview = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;

  const overview = await dashboardService.getOverview(organizationId);

  res.json({
    success: true,
    data: overview,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTIQUES DU JOUR
// ═══════════════════════════════════════════════════════════════════════════════

export const getDailyStats = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const { date } = req.query;

  const stats = await dashboardService.getDailyStats(
    organizationId,
    date as string
  );

  res.json({
    success: true,
    data: stats,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// VENTES PAR PÉRIODE
// ═══════════════════════════════════════════════════════════════════════════════

export const getSalesStats = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const { startDate, endDate, groupBy } = req.query;

  const stats = await dashboardService.getSalesStats(
    organizationId,
    startDate as string,
    endDate as string,
    groupBy as 'day' | 'week' | 'month'
  );

  res.json({
    success: true,
    data: stats,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TOP PRODUITS
// ═══════════════════════════════════════════════════════════════════════════════

export const getTopProducts = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const { startDate, endDate, limit } = req.query;

  const products = await dashboardService.getTopProducts(
    organizationId,
    startDate as string,
    endDate as string,
    parseInt(limit as string) || 10
  );

  res.json({
    success: true,
    data: products,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TOP CLIENTS
// ═══════════════════════════════════════════════════════════════════════════════

export const getTopCustomers = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const { startDate, endDate, limit, sortBy } = req.query;

  const customers = await dashboardService.getTopCustomers(
    organizationId,
    startDate as string,
    endDate as string,
    parseInt(limit as string) || 10,
    sortBy as 'revenue' | 'orders' | 'debt'
  );

  res.json({
    success: true,
    data: customers,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE LIVREURS
// ═══════════════════════════════════════════════════════════════════════════════

export const getDelivererPerformance = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const { startDate, endDate } = req.query;

  const performance = await dashboardService.getDelivererPerformance(
    organizationId,
    startDate as string,
    endDate as string
  );

  res.json({
    success: true,
    data: performance,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// APERÇU DETTES
// ═══════════════════════════════════════════════════════════════════════════════

export const getDebtOverview = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;

  const overview = await dashboardService.getDebtOverview(organizationId);

  res.json({
    success: true,
    data: overview,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RAPPORT AGING
// ═══════════════════════════════════════════════════════════════════════════════

export const getAgingReport = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;

  const report = await dashboardService.getAgingReport(organizationId);

  res.json({
    success: true,
    data: report,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PRÉVISION DE TRÉSORERIE
// ═══════════════════════════════════════════════════════════════════════════════

export const getCashFlowForecast = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const { days } = req.query;

  const forecast = await dashboardService.getCashFlowForecast(
    organizationId,
    parseInt(days as string) || 30
  );

  res.json({
    success: true,
    data: forecast,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ALERTES STOCK
// ═══════════════════════════════════════════════════════════════════════════════

export const getStockAlerts = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;

  const alerts = await dashboardService.getStockAlerts(organizationId);

  res.json({
    success: true,
    data: alerts,
  });
});

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
