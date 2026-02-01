// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - CONTROLLER CAISSE JOURNALIÈRE
// Gestion caisse livreur, clôture, remise
// ═══════════════════════════════════════════════════════════════════════════════

import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import dailyCashService from '../services/daily-cash.service';

// ═══════════════════════════════════════════════════════════════════════════════
// ÉTAT DE LA CAISSE DU JOUR
// ═══════════════════════════════════════════════════════════════════════════════

export const getMyDailyCash = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const userId = req.user!.id;
  const { date } = req.query;

  const cash = await dailyCashService.getDailyCash(
    organizationId,
    userId,
    date as string
  );

  res.json({
    success: true,
    data: cash,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// HISTORIQUE CAISSE
// ═══════════════════════════════════════════════════════════════════════════════

export const getDailyCashHistory = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const userId = req.user!.id;
  const { startDate, endDate } = req.query;

  const history = await dailyCashService.getDailyCashHistory(
    organizationId,
    userId,
    startDate as string,
    endDate as string
  );

  res.json({
    success: true,
    data: history,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// OUVRIR LA CAISSE
// ═══════════════════════════════════════════════════════════════════════════════

export const openDailyCash = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const userId = req.user!.id;
  const { openingAmount, date } = req.body;

  const cash = await dailyCashService.openDailyCash(
    organizationId,
    userId,
    openingAmount,
    date
  );

  res.json({
    success: true,
    data: cash,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CLÔTURER LA CAISSE
// ═══════════════════════════════════════════════════════════════════════════════

export const closeDailyCash = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const userId = req.user!.id;
  const { 
    actualCash, 
    actualChecks, 
    notes,
    expenses,
  } = req.body;

  const cash = await dailyCashService.closeDailyCash(
    organizationId,
    userId,
    {
      actualCash,
      actualChecks,
      notes,
      expenses,
    }
  );

  res.json({
    success: true,
    data: cash,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REMETTRE LA CAISSE (à un manager/admin)
// ═══════════════════════════════════════════════════════════════════════════════

export const remitDailyCash = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const userId = req.user!.id;
  const { 
    remittedTo,
    cashAmount,
    checks,
    notes,
  } = req.body;

  const remittance = await dailyCashService.remitCash(
    organizationId,
    userId,
    {
      remittedTo,
      cashAmount,
      checks,
      notes,
    }
  );

  res.json({
    success: true,
    data: remittance,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AJOUTER UNE DÉPENSE
// ═══════════════════════════════════════════════════════════════════════════════

export const addExpense = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const userId = req.user!.id;
  const { amount, category, description, receiptPhoto } = req.body;

  const expense = await dailyCashService.addExpense(
    organizationId,
    userId,
    {
      amount,
      category,
      description,
      receiptPhoto,
    }
  );

  res.json({
    success: true,
    data: expense,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// VUE ADMIN - TOUTES LES CAISSES
// ═══════════════════════════════════════════════════════════════════════════════

export const getAllDailyCash = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const { date, status } = req.query;

  const cashes = await dailyCashService.getAllDailyCash(
    organizationId,
    date as string,
    status as string
  );

  res.json({
    success: true,
    data: cashes,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// VUE ADMIN - CONFIRMER REMISE
// ═══════════════════════════════════════════════════════════════════════════════

export const confirmRemittance = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const adminId = req.user!.id;
  const { remittanceId } = req.params;
  const { notes } = req.body;

  const remittance = await dailyCashService.confirmRemittance(
    organizationId,
    remittanceId,
    adminId,
    notes
  );

  res.json({
    success: true,
    data: remittance,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  getMyDailyCash,
  getDailyCashHistory,
  openDailyCash,
  closeDailyCash,
  remitDailyCash,
  addExpense,
  getAllDailyCash,
  confirmRemittance,
};
