// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - SERVICE DE SYNCHRONISATION OFFLINE
// Gestion des données offline pour les livreurs
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '../database';
import { deliveries, orders, customers, products, paymentHistory, dailyCash, syncLog, users } from '../database/schema';
import { eq, and, gte, gt, inArray, sql } from 'drizzle-orm';
import { logger } from '../utils/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface SyncPushTransaction {
  id: string; // Local ID
  type: 'delivery_complete' | 'delivery_fail' | 'payment' | 'position_update' | 'debt_collection';
  data: Record<string, any>;
  createdAt: string;
  retryCount?: number;
}

export interface SyncPullResult {
  deliveries: any[];
  customers: any[];
  products: any[];
  payments: any[];
  lastSyncAt: Date;
  syncToken: string;
}

export interface SyncStatus {
  lastSyncAt: Date | null;
  pendingTransactions: number;
  isOnline: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class SyncService {
  
  // ───────────────────────────────────────────────────────────────────────────
  // DONNÉES INITIALES (Première sync ou reset)
  // ───────────────────────────────────────────────────────────────────────────
  
  async getInitialData(
    delivererId: string,
    organizationId: string,
    date?: Date
  ): Promise<{
    deliveries: any[];
    customers: any[];
    products: any[];
    myRoute: any[];
  }> {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Récupérer la tournée du jour
    const myRoute = await db.query.deliveries.findMany({
      where: and(
        eq(deliveries.delivererId, delivererId),
        gte(deliveries.scheduledDate, startOfDay),
        gte(deliveries.scheduledDate, endOfDay)
      ),
      with: {
        order: {
          with: {
            customer: true,
            items: {
              with: {
                product: true,
              },
            },
          },
        },
      },
      orderBy: [deliveries.sequenceNumber],
    });
    
    // Récupérer tous les clients de l'organisation
    const customersList = await db.query.customers.findMany({
      where: eq(customers.organizationId, organizationId),
      columns: {
        id: true,
        name: true,
        phone: true,
        address: true,
        city: true,
        zone: true,
        coordinates: true,
        creditLimit: true,
        currentDebt: true,
        deliveryNotes: true,
        customPrices: true,
        discountPercent: true,
      },
    });
    
    // Récupérer tous les produits actifs
    const productsList = await db.query.products.findMany({
      where: and(
        eq(products.organizationId, organizationId),
        eq(products.isActive, true),
        eq(products.isAvailable, true)
      ),
      columns: {
        id: true,
        name: true,
        description: true,
        price: true,
        unit: true,
        categoryId: true,
        imageUrl: true,
      },
    });
    
    // Récupérer toutes les livraisons en cours
    const activeDeliveries = await db.query.deliveries.findMany({
      where: and(
        eq(deliveries.organizationId, organizationId),
        eq(deliveries.delivererId, delivererId),
        inArray(deliveries.status, ['assigned', 'picked_up', 'in_transit', 'arrived'])
      ),
      with: {
        order: {
          with: {
            customer: true,
            items: true,
          },
        },
      },
    });
    
    return {
      deliveries: activeDeliveries,
      customers: customersList,
      products: productsList,
      myRoute,
    };
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // PULL - Récupérer les mises à jour depuis le serveur
  // ───────────────────────────────────────────────────────────────────────────
  
  async pullUpdates(
    delivererId: string,
    organizationId: string,
    lastSyncAt: Date,
    entities: ('deliveries' | 'customers' | 'products' | 'payments')[] = ['deliveries', 'customers']
  ): Promise<SyncPullResult> {
    const result: SyncPullResult = {
      deliveries: [],
      customers: [],
      products: [],
      payments: [],
      lastSyncAt: new Date(),
      syncToken: this.generateSyncToken(),
    };
    
    // Livraisons mises à jour depuis lastSyncAt
    if (entities.includes('deliveries')) {
      result.deliveries = await db.query.deliveries.findMany({
        where: and(
          eq(deliveries.organizationId, organizationId),
          eq(deliveries.delivererId, delivererId),
          gt(deliveries.updatedAt, lastSyncAt)
        ),
        with: {
          order: {
            with: {
              customer: true,
              items: true,
            },
          },
        },
      });
    }
    
    // Clients mis à jour
    if (entities.includes('customers')) {
      result.customers = await db.query.customers.findMany({
        where: and(
          eq(customers.organizationId, organizationId),
          gt(customers.updatedAt, lastSyncAt)
        ),
      });
    }
    
    // Produits mis à jour
    if (entities.includes('products')) {
      result.products = await db.query.products.findMany({
        where: and(
          eq(products.organizationId, organizationId),
          gt(products.updatedAt, lastSyncAt)
        ),
      });
    }
    
    // Paiements récents
    if (entities.includes('payments')) {
      result.payments = await db.query.paymentHistory.findMany({
        where: and(
          eq(paymentHistory.organizationId, organizationId),
          eq(paymentHistory.collectedBy, delivererId),
          gt(paymentHistory.createdAt, lastSyncAt)
        ),
      });
    }
    
    // Enregistrer le sync log
    await db.insert(syncLog).values({
      userId: delivererId,
      syncType: 'incremental',
      direction: 'pull',
      entitiesSynced: {
        deliveries: result.deliveries.length,
        customers: result.customers.length,
        products: result.products.length,
        payments: result.payments.length,
      },
      status: 'success',
      lastSyncAt: result.lastSyncAt,
      syncToken: result.syncToken,
      completedAt: new Date(),
    });
    
    return result;
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // PUSH - Envoyer les transactions offline au serveur
  // ───────────────────────────────────────────────────────────────────────────
  
  async pushTransactions(
    delivererId: string,
    organizationId: string,
    transactions: SyncPushTransaction[]
  ): Promise<{
    processed: string[];
    failed: { id: string; error: string }[];
  }> {
    const result = {
      processed: [] as string[],
      failed: [] as { id: string; error: string }[],
    };
    
    for (const tx of transactions) {
      try {
        await this.processTransaction(delivererId, organizationId, tx);
        result.processed.push(tx.id);
      } catch (error: any) {
        logger.error(`Failed to process transaction ${tx.id}:`, error);
        result.failed.push({
          id: tx.id,
          error: error.message || 'Unknown error',
        });
      }
    }
    
    // Enregistrer le sync log
    await db.insert(syncLog).values({
      userId: delivererId,
      syncType: 'incremental',
      direction: 'push',
      entitiesSynced: {
        processed: result.processed.length,
        failed: result.failed.length,
      },
      status: result.failed.length === 0 ? 'success' : (result.processed.length > 0 ? 'partial' : 'failed'),
      errorMessage: result.failed.length > 0 ? `${result.failed.length} transactions failed` : undefined,
      completedAt: new Date(),
    });
    
    return result;
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // TRAITER UNE TRANSACTION
  // ───────────────────────────────────────────────────────────────────────────
  
  private async processTransaction(
    delivererId: string,
    organizationId: string,
    tx: SyncPushTransaction
  ): Promise<void> {
    switch (tx.type) {
      case 'delivery_complete':
        await this.processDeliveryComplete(delivererId, organizationId, tx.data);
        break;
        
      case 'delivery_fail':
        await this.processDeliveryFail(delivererId, organizationId, tx.data);
        break;
        
      case 'payment':
        await this.processPayment(delivererId, organizationId, tx.data);
        break;
        
      case 'debt_collection':
        await this.processDebtCollection(delivererId, organizationId, tx.data);
        break;
        
      case 'position_update':
        await this.processPositionUpdate(delivererId, tx.data);
        break;
        
      default:
        throw new Error(`Unknown transaction type: ${tx.type}`);
    }
  }
  
  private async processDeliveryComplete(
    delivererId: string,
    organizationId: string,
    data: any
  ): Promise<void> {
    // Importer le service de livraison
    const { deliveryService } = await import('./delivery.service');
    
    await deliveryService.completeDelivery(
      data.deliveryId,
      {
        amountCollected: data.amountCollected,
        collectionMode: data.collectionMode || 'cash',
        notes: data.notes,
        signature: data.signature,
        location: data.location,
      },
      delivererId
    );
  }
  
  private async processDeliveryFail(
    delivererId: string,
    organizationId: string,
    data: any
  ): Promise<void> {
    const { deliveryService } = await import('./delivery.service');
    
    await deliveryService.failDelivery(
      data.deliveryId,
      {
        reason: data.reason,
        location: data.location,
      },
      delivererId
    );
  }
  
  private async processPayment(
    delivererId: string,
    organizationId: string,
    data: any
  ): Promise<void> {
    const { createPayment } = await import('./payment.service');
    
    await createPayment(
      organizationId,
      delivererId,
      {
        customerId: data.customerId,
        amount: data.amount,
        mode: data.mode || 'cash',
        paymentType: data.paymentType || 'debt_payment',
        orderId: data.orderId,
        notes: data.notes,
      },
      data.deliveryId
    );
  }
  
  private async processDebtCollection(
    delivererId: string,
    organizationId: string,
    data: any
  ): Promise<void> {
    const { deliveryService } = await import('./delivery.service');
    
    await deliveryService.collectDebt(
      organizationId,
      data.customerId,
      data.amount,
      data.collectionMode || 'cash',
      delivererId,
      data.notes
    );
  }
  
  private async processPositionUpdate(
    delivererId: string,
    data: any
  ): Promise<void> {
    await db.update(users)
      .set({
        lastPosition: {
          lat: data.lat,
          lng: data.lng,
          accuracy: data.accuracy,
          updatedAt: new Date(),
        },
      })
      .where(eq(users.id, delivererId));
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // STATUT DE SYNCHRONISATION
  // ───────────────────────────────────────────────────────────────────────────
  
  async getSyncStatus(delivererId: string): Promise<{
    lastSyncAt: Date | null;
    totalSyncs: number;
    lastSyncStatus: string | null;
  }> {
    const lastSync = await db.query.syncLog.findFirst({
      where: eq(syncLog.userId, delivererId),
      orderBy: [syncLog.startedAt],
    });
    
    const totalSyncs = await db.select({ count: sql`COUNT(*)` })
      .from(syncLog)
      .where(eq(syncLog.userId, delivererId));
    
    return {
      lastSyncAt: lastSync?.completedAt || null,
      totalSyncs: Number(totalSyncs[0]?.count || 0),
      lastSyncStatus: lastSync?.status || null,
    };
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ───────────────────────────────────────────────────────────────────────────
  
  private generateSyncToken(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // RÉSOLUTION DE CONFLITS
  // ───────────────────────────────────────────────────────────────────────────
  
  async resolveConflict(
    entityType: 'delivery' | 'payment',
    localData: any,
    serverData: any,
    strategy: 'server_wins' | 'client_wins' | 'merge' = 'server_wins'
  ): Promise<any> {
    switch (strategy) {
      case 'server_wins':
        return serverData;
        
      case 'client_wins':
        // Mettre à jour le serveur avec les données locales
        return localData;
        
      case 'merge':
        // Fusionner les données (stratégie spécifique selon l'entité)
        return { ...serverData, ...localData, updatedAt: new Date() };
        
      default:
        return serverData;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTIONS STANDALONE (pour compatibilité)
// ═══════════════════════════════════════════════════════════════════════════════

async function getInitialDownload(
  delivererId: string,
  organizationId: string,
  date?: Date
): Promise<{
  deliveries: any[];
  customers: any[];
  products: any[];
  myRoute: any[];
}> {
  return syncService.getInitialData(delivererId, organizationId, date);
}

async function processOfflineTransactions(
  delivererId: string,
  organizationId: string,
  transactions: SyncPushTransaction[]
): Promise<{
  processed: string[];
  failed: { id: string; error: string }[];
}> {
  return syncService.pushTransactions(delivererId, organizationId, transactions);
}

async function getUpdates(
  delivererId: string,
  organizationId: string,
  lastSyncAt: Date,
  entities: ('deliveries' | 'customers' | 'products' | 'payments')[] = ['deliveries', 'customers']
): Promise<SyncPullResult> {
  return syncService.pullUpdates(delivererId, organizationId, lastSyncAt, entities);
}

async function checkConflicts(
  delivererId: string,
  localData: any[],
  serverData: any[]
): Promise<{ entityId: string; local: any; server: any }[]> {
  // TODO: Implémentation complète de la détection de conflits
  const conflicts: { entityId: string; local: any; server: any }[] = [];
  
  for (const local of localData) {
    const server = serverData.find((s: any) => s.id === local.id);
    if (server && new Date(local.updatedAt) < new Date(server.updatedAt)) {
      conflicts.push({
        entityId: local.id,
        local,
        server,
      });
    }
  }
  
  return conflicts;
}

async function resolveConflict(
  entityType: 'delivery' | 'payment',
  localData: any,
  serverData: any,
  strategy: 'server_wins' | 'client_wins' | 'merge' = 'server_wins'
): Promise<any> {
  return syncService.resolveConflict(entityType, localData, serverData, strategy);
}

async function getSyncStatus(delivererId: string): Promise<{
  lastSyncAt: Date | null;
  totalSyncs: number;
  lastSyncStatus: string | null;
}> {
  return syncService.getSyncStatus(delivererId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export const syncService = {
  getInitialDownload,
  processOfflineTransactions,
  getUpdates,
  checkConflicts,
  resolveConflict,
  getSyncStatus,
};

export class SyncServiceStatic {
  static getInitialDownload = getInitialDownload;
  static processOfflineTransactions = processOfflineTransactions;
  static getUpdates = getUpdates;
  static checkConflicts = checkConflicts;
  static resolveConflict = resolveConflict;
  static getSyncStatus = getSyncStatus;
}

export default syncService;
