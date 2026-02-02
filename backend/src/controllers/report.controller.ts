// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - CONTRÔLEUR RAPPORTS
// Génération de rapports PDF et Excel
// ═══════════════════════════════════════════════════════════════════════════════

import { Request, Response, NextFunction } from 'express';
import reportService from '../services/report.service';
import { AuthRequest } from '../middlewares/auth.middleware';
import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// SCHÉMAS DE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
});

const dailyReportSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
});

const customerReportSchema = z.object({
  customerId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRÔLEUR
// ═══════════════════════════════════════════════════════════════════════════════

export class ReportController {
  private reportService: typeof reportService;

  constructor() {
    this.reportService = reportService;
  }

  /**
   * Rapport journalier des ventes
   * GET /api/reports/daily
   */
  async getDailyReport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { date } = dailyReportSchema.parse(req.query);
      const organizationId = req.user!.organizationId;

      const report = await this.reportService.generateDailySalesReport(
        organizationId,
        date
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export rapport journalier en PDF
   * GET /api/reports/daily/pdf
   */
  async exportDailyPdf(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { date } = dailyReportSchema.parse(req.query);
      const organizationId = req.user!.organizationId;

      const pdfBuffer = await this.reportService.exportDailyReportToPdf(
        organizationId,
        date
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=rapport-journalier-${date}.pdf`
      );
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Rapport des ventes par période
   * GET /api/reports/sales
   */
  async getSalesReport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = dateRangeSchema.parse(req.query);
      const organizationId = req.user!.organizationId;
      const groupBy = (req.query.groupBy as string) || 'day';

      const report = await this.reportService.generateSalesReport(
        organizationId,
        startDate,
        endDate,
        groupBy as 'day' | 'week' | 'month'
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export rapport des ventes en Excel
   * GET /api/reports/sales/excel
   */
  async exportSalesExcel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = dateRangeSchema.parse(req.query);
      const organizationId = req.user!.organizationId;

      const excelBuffer = await this.reportService.exportSalesReportToExcel(
        organizationId,
        startDate,
        endDate
      );

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=rapport-ventes-${startDate}-${endDate}.xlsx`
      );
      res.send(excelBuffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Rapport des dettes (aging report)
   * GET /api/reports/debt-aging
   */
  async getDebtAgingReport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;

      const report = await this.reportService.generateDebtAgingReport(organizationId);

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export rapport des dettes en Excel
   * GET /api/reports/debt-aging/excel
   */
  async exportDebtAgingExcel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;

      const excelBuffer = await this.reportService.exportDebtAgingToExcel(organizationId);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=rapport-dettes-${new Date().toISOString().split('T')[0]}.xlsx`
      );
      res.send(excelBuffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Relevé de compte client
   * GET /api/reports/customer-statement
   */
  async getCustomerStatement(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { customerId, startDate, endDate } = customerReportSchema.parse(req.query);
      const organizationId = req.user!.organizationId;

      const statement = await this.reportService.generateCustomerStatement(
        organizationId,
        customerId,
        startDate,
        endDate
      );

      res.json({
        success: true,
        data: statement,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export relevé client en PDF
   * GET /api/reports/customer-statement/pdf
   */
  async exportCustomerStatementPdf(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { customerId, startDate, endDate } = customerReportSchema.parse(req.query);
      const organizationId = req.user!.organizationId;

      const pdfBuffer = await this.reportService.exportCustomerStatementToPdf(
        organizationId,
        customerId,
        startDate,
        endDate
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=releve-compte-${customerId}-${startDate}-${endDate}.pdf`
      );
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Rapport de performance des livreurs
   * GET /api/reports/deliverer-performance
   */
  async getDelivererPerformance(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = dateRangeSchema.parse(req.query);
      const organizationId = req.user!.organizationId;

      const report = await this.reportService.generateDelivererPerformanceReport(
        organizationId,
        startDate,
        endDate
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Rapport des produits
   * GET /api/reports/products
   */
  async getProductsReport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = dateRangeSchema.parse(req.query);
      const organizationId = req.user!.organizationId;

      const report = await this.reportService.generateProductsReport(
        organizationId,
        startDate,
        endDate
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export rapport des produits en Excel
   * GET /api/reports/products/excel
   */
  async exportProductsExcel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = dateRangeSchema.parse(req.query);
      const organizationId = req.user!.organizationId;

      const excelBuffer = await this.reportService.exportProductsReportToExcel(
        organizationId,
        startDate,
        endDate
      );

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=rapport-produits-${startDate}-${endDate}.xlsx`
      );
      res.send(excelBuffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Rapport de caisse journalier par livreur
   * GET /api/reports/daily-cash/:delivererId
   */
  async getDailyCashReport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { delivererId } = req.params;
      const { date } = dailyReportSchema.parse(req.query);
      const organizationId = req.user!.organizationId;

      const report = await this.reportService.generateDailyCashReport(
        organizationId,
        delivererId,
        date
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Rapport mensuel récapitulatif
   * GET /api/reports/monthly
   */
  async getMonthlyReport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const year = parseInt(req.query.year as string);
      const month = parseInt(req.query.month as string);
      const organizationId = req.user!.organizationId;

      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        return res.status(400).json({
          success: false,
          message: 'Paramètres année/mois invalides',
        });
      }

      const report = await this.reportService.generateMonthlyReport(
        organizationId,
        year,
        month
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export rapport mensuel en PDF
   * GET /api/reports/monthly/pdf
   */
  async exportMonthlyPdf(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const year = parseInt(req.query.year as string);
      const month = parseInt(req.query.month as string);
      const organizationId = req.user!.organizationId;

      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        return res.status(400).json({
          success: false,
          message: 'Paramètres année/mois invalides',
        });
      }

      const pdfBuffer = await this.reportService.exportMonthlyReportToPdf(
        organizationId,
        year,
        month
      );

      const monthStr = String(month).padStart(2, '0');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=rapport-mensuel-${year}-${monthStr}.pdf`
      );
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }
}

// Instance singleton
export const reportController = new ReportController();

// ═══════════════════════════════════════════════════════════════════════════════
// STUBS - Additional Report Functions
// ═══════════════════════════════════════════════════════════════════════════════

import { asyncHandler } from '../middlewares/error.middleware';

export const generateDailyReport = asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'generateDailyReport (stub)',
    data: {}
  });
});

export const generateWeeklyReport = asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'generateWeeklyReport (stub)',
    data: {}
  });
});

export const generateMonthlyReport = asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'generateMonthlyReport (stub)',
    data: {}
  });
});

export const generateDelivererPerformanceReport = asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'generateDelivererPerformanceReport (stub)',
    data: {}
  });
});

export const generateCustomerStatement = asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'generateCustomerStatement (stub)',
    data: {}
  });
});

export const exportReport = asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'exportReport (stub)',
    data: {}
  });
});
