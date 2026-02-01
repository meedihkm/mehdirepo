// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - CONTROLLER SYNCHRONISATION
// Sync offline, download initial, push/pull
// ═══════════════════════════════════════════════════════════════════════════════

import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import syncService from '../services/sync.service';
import { logger } from '../utils/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// TÉLÉCHARGEMENT INITIAL (pour livreur)
// ═══════════════════════════════════════════════════════════════════════════════

export const initialDownload = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const userId = req.user!.id;
  const userRole = req.user!.role;

  logger.info(`Initial download requested by ${userRole}:${userId}`);

  const data = await syncService.getInitialDownload(organizationId, userId, userRole);

  res.json({
    success: true,
    data,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUSH TRANSACTIONS OFFLINE
// ═══════════════════════════════════════════════════════════════════════════════

export const pushTransactions = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const userId = req.user!.id;
  const { transactions } = req.body;

  logger.info(`Pushing ${transactions.length} offline transactions from ${userId}`);

  const result = await syncService.processOfflineTransactions(
    organizationId,
    userId,
    transactions
  );

  res.json({
    success: true,
    data: result,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PULL UPDATES
// ═══════════════════════════════════════════════════════════════════════════════

export const pullUpdates = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const userId = req.user!.id;
  const { lastSyncAt } = req.query;

  const updates = await syncService.getUpdates(
    organizationId,
    userId,
    lastSyncAt as string
  );

  res.json({
    success: true,
    data: updates,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ÉTAT DE SYNCHRONISATION
// ═══════════════════════════════════════════════════════════════════════════════

export const getSyncStatus = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const userId = req.user!.id;

  const status = await syncService.getSyncStatus(organizationId, userId);

  res.json({
    success: true,
    data: status,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// VÉRIFIER CONFLITS
// ═══════════════════════════════════════════════════════════════════════════════

export const checkConflicts = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const { items } = req.body;

  const conflicts = await syncService.checkConflicts(organizationId, items);

  res.json({
    success: true,
    data: {
      hasConflicts: conflicts.length > 0,
      conflicts,
    },
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  initialDownload,
  pushTransactions,
  pullUpdates,
  getSyncStatus,
  checkConflicts,
};
