// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - SERVICE DE LIVRAISON
// Logique métier pour les livraisons et encaissements
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '../database';
import { and, eq, sql, desc, asc, inArray, gte, lte } from 'drizzle-orm';
import {
  deliveries,
  orders,
  customers,
  users,
  paymentHistory,
  deliveryTransactions,
  dailyCash,
} from '../database/schema';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { emitToOrganization } from '../index';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CompleteDeliveryInput {
  amountCollected: number;
  collectionMode: 'cash' | 'check' | 'bank_transfer';
  notes?: string;
  signature?: {
    data: string;
    name: string;
  };
  location?: {
    lat: number;
    lng: number;
  };
}

export interface FailDeliveryInput {
  reason: string;
  location?: {
    lat: number;
    lng: number;
  };
}

export interface DeliveryCompletionResult {
  delivery: any;
  transaction: {
    orderAmount: number;
    debtBefore: number;
    amountPaid: number;
    appliedToOrder: number;
    appliedToDebt: number;
    newDebtCreated: number;
    debtAfter: number;
  };
  customer: {
    id: string;
    name: string;
    currentDebt: number;
    creditLimit: number;
  };
  printUrls?: {
    receiptUrl?: string;
    deliveryUrl?: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class DeliveryService {
  
  // ───────────────────────────────────────────────────────────────────────────
  // RÉCUPÉRER LA TOURNÉE DU JOUR
  // ───────────────────────────────────────────────────────────────────────────
  
  async getMyRoute(delivererId: string, date?: Date): Promise<any[]> {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const result = await db.query.deliveries.findMany({
      where: and(
        eq(deliveries.delivererId, delivererId),
        gte(deliveries.scheduledDate, startOfDay),
        lte(deliveries.scheduledDate, endOfDay),
      ),
      with: {
        order: {
          with: {
            items: {
              with: {
                product: true,
              },
            },
            customer: true,
          },
        },
      },
      orderBy: [asc(deliveries.sequenceNumber)],
    });
    
    // Enrichir avec la dette actuelle du client
    return result.map(d => ({
      ...d,
      existingDebt: d.order?.customer?.currentDebt || 0,
      totalToCollect: Number(d.orderAmount) + Number(d.order?.customer?.currentDebt || 0),
    }));
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // LISTER LES LIVRAISONS (stub)
  // ───────────────────────────────────────────────────────────────────────────
  
  async listDeliveries(organizationId: string, query: any): Promise<any> {
    const { page = 1, limit = 20, status, delivererId, date } = query;
    const conditions = [eq(deliveries.organizationId, organizationId)];
    
    if (status) conditions.push(eq(deliveries.status, status));
    if (delivererId) conditions.push(eq(deliveries.delivererId, delivererId));
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(gte(deliveries.scheduledDate, startOfDay));
      conditions.push(lte(deliveries.scheduledDate, endOfDay));
    }
    
    const result = await db.query.deliveries.findMany({
      where: and(...conditions),
      with: { order: { with: { customer: true } }, deliverer: true },
      limit,
      offset: (page - 1) * limit,
      orderBy: desc(deliveries.createdAt),
    });
    
    return {
      data: result,
      pagination: { page, limit, total: result.length },
    };
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // RÉCUPÉRER UNE LIVRAISON PAR ID (stub)
  // ───────────────────────────────────────────────────────────────────────────
  
  async getDeliveryById(deliveryId: string, organizationId: string): Promise<any> {
    const delivery = await db.query.deliveries.findFirst({
      where: and(eq(deliveries.id, deliveryId), eq(deliveries.organizationId, organizationId)),
      with: { order: { with: { customer: true, items: { with: { product: true } } } }, deliverer: true },
    });
    
    if (!delivery) {
      throw new AppError('NOT_FOUND', 'Livraison non trouvée');
    }
    
    return delivery;
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // METTRE À JOUR LE STATUT (stub)
  // ───────────────────────────────────────────────────────────────────────────
  
  async updateDeliveryStatus(deliveryId: string, status: string, organizationId: string): Promise<any> {
    const [updated] = await db.update(deliveries)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(deliveries.id, deliveryId), eq(deliveries.organizationId, organizationId)))
      .returning();
    
    if (!updated) {
      throw new AppError('NOT_FOUND', 'Livraison non trouvée');
    }
    
    return updated;
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // METTRE À JOUR LA POSITION (stub)
  // ───────────────────────────────────────────────────────────────────────────
  
  async updateDelivererPosition(delivererId: string, location: { lat: number; lng: number }): Promise<void> {
    await db.update(users)
      .set({ currentLatitude: location.lat, currentLongitude: location.lng, updatedAt: new Date() })
      .where(eq(users.id, delivererId));
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // COMPLÉTER UNE LIVRAISON
  // ───────────────────────────────────────────────────────────────────────────
  
  async completeDelivery(
    deliveryId: string,
    input: CompleteDeliveryInput,
    delivererId: string,
  ): Promise<DeliveryCompletionResult> {
    // Récupérer la livraison avec commande et client
    const delivery = await db.query.deliveries.findFirst({
      where: eq(deliveries.id, deliveryId),
      with: {
        order: {
          with: {
            customer: true,
          },
        },
      },
    });
    
    if (!delivery) {
      throw new AppError('NOT_FOUND', 'Livraison non trouvée');
    }
    
    if (delivery.delivererId !== delivererId) {
      throw new AppError('FORBIDDEN', 'Cette livraison n\'est pas assignée à vous');
    }
    
    if (delivery.status === 'delivered' || delivery.status === 'failed') {
      throw new AppError('BAD_REQUEST', 'Cette livraison est déjà finalisée');
    }
    
    const order = delivery.order!;
    const customer = order.customer!;
    const amountCollected = input.amountCollected;
    const orderAmount = Number(delivery.orderAmount);
    const existingDebt = Number(customer.currentDebt);
    
    // ═══════════════════════════════════════════════════════════════════════
    // CALCUL DE LA RÉPARTITION DU PAIEMENT
    // ═══════════════════════════════════════════════════════════════════════
    
    // Règle: Payer d'abord la commande actuelle, puis les anciennes dettes (FIFO)
    let appliedToOrder = 0;
    let appliedToDebt = 0;
    let newDebtCreated = 0;
    let remainingPayment = amountCollected;
    
    // 1. Appliquer à la commande actuelle
    if (remainingPayment >= orderAmount) {
      appliedToOrder = orderAmount;
      remainingPayment -= orderAmount;
    } else {
      appliedToOrder = remainingPayment;
      newDebtCreated = orderAmount - remainingPayment;
      remainingPayment = 0;
    }
    
    // 2. Appliquer le reste à la dette existante (FIFO)
    if (remainingPayment > 0 && existingDebt > 0) {
      appliedToDebt = Math.min(remainingPayment, existingDebt);
      remainingPayment -= appliedToDebt;
    }
    
    // Calculer la nouvelle dette
    const debtAfter = existingDebt - appliedToDebt + newDebtCreated;
    
    // Vérifier la limite de crédit si nouvelle dette créée
    if (newDebtCreated > 0 && customer.creditLimitEnabled) {
      if (debtAfter > Number(customer.creditLimit)) {
        // Notifier l'admin (de manière asynchrone)
        this.notifyCreditLimitExceeded(delivery.organizationId, customer.name, debtAfter, Number(customer.creditLimit));
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // TRANSACTION BASE DE DONNÉES
    // ═══════════════════════════════════════════════════════════════════════
    
    const result = await db.transaction(async (tx) => {
      // 1. Mettre à jour la livraison
      await tx.update(deliveries)
        .set({
          status: 'delivered',
          amountCollected,
          collectionMode: input.collectionMode,
          completedAt: new Date(),
          proofOfDelivery: {
            signatureData: input.signature?.data,
            signatureName: input.signature?.name,
            location: input.location,
          },
          notes: input.notes,
          updatedAt: new Date(),
        })
        .where(eq(deliveries.id, deliveryId));
      
      // 2. Mettre à jour la commande
      const orderPaymentStatus = 
        appliedToOrder >= orderAmount ? 'paid' : 
        appliedToOrder > 0 ? 'partial' : 'unpaid';
      
      await tx.update(orders)
        .set({
          status: 'delivered',
          paymentStatus: orderPaymentStatus,
          amountPaid: appliedToOrder,
          amountDue: orderAmount - appliedToOrder,
          deliveredAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id));
      
      // 3. Mettre à jour la dette du client
      await tx.update(customers)
        .set({
          currentDebt: debtAfter,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, customer.id));
      
      // 4. Enregistrer le paiement dans l'historique
      if (amountCollected > 0) {
        const receiptNumber = await this.generateReceiptNumber(delivery.organizationId, tx);
        
        await tx.insert(paymentHistory).values({
          organizationId: delivery.organizationId,
          customerId: customer.id,
          deliveryId: deliveryId,
          orderId: order.id,
          amount: amountCollected,
          mode: input.collectionMode,
          paymentType: 'order_payment',
          collectedBy: delivererId,
          collectedAt: new Date(),
          receiptNumber,
          customerDebtBefore: existingDebt,
          customerDebtAfter: debtAfter,
          appliedTo: appliedToOrder > 0 ? [{ orderId: order.id, amount: appliedToOrder }] : [],
          notes: input.notes,
        });
      }
      
      // 5. Enregistrer la transaction détaillée de livraison
      await tx.insert(deliveryTransactions).values({
        organizationId: delivery.organizationId,
        deliveryId: deliveryId,
        orderId: order.id,
        customerId: customer.id,
        type: appliedToOrder >= orderAmount ? 'full_payment' : 'partial_payment',
        orderAmount,
        debtBefore: existingDebt,
        amountPaid: amountCollected,
        appliedToOrder,
        appliedToDebt,
        newDebtCreated,
        debtAfter,
        collectedBy: delivererId,
      });
      
      // 6. Mettre à jour la caisse journalière du livreur
      await this.updateDailyCash(tx, delivererId, delivery.organizationId, {
        collection: amountCollected,
        newDebt: newDebtCreated,
        deliveryCompleted: true,
      });
      
      // 7. Appliquer FIFO si dette remboursée
      if (appliedToDebt > 0) {
        await this.applyFifoDebtPayment(
          tx,
          customer.id,
          appliedToDebt,
          delivererId,
          deliveryId,
        );
      }
      
      return { debtAfter };
    });
    
    // ═══════════════════════════════════════════════════════════════════════
    // NOTIFICATIONS (asynchrone)
    // ═══════════════════════════════════════════════════════════════════════
    
    this.sendDeliveryNotification(customer.id, order.orderNumber, amountCollected);
    
    // ═══════════════════════════════════════════════════════════════════════
    // ÉMETTRE ÉVÉNEMENT TEMPS RÉEL
    // ═══════════════════════════════════════════════════════════════════════
    
    emitToOrganization(delivery.organizationId, 'delivery:completed', {
      deliveryId,
      orderId: order.id,
      customerId: customer.id,
      amountCollected,
      debtAfter: result.debtAfter,
    });
    
    // ═══════════════════════════════════════════════════════════════════════
    // RETOUR
    // ═══════════════════════════════════════════════════════════════════════
    
    return {
      delivery: {
        ...delivery,
        status: 'delivered',
        amountCollected,
        completedAt: new Date(),
      },
      transaction: {
        orderAmount,
        debtBefore: existingDebt,
        amountPaid: amountCollected,
        appliedToOrder,
        appliedToDebt,
        newDebtCreated,
        debtAfter: result.debtAfter,
      },
      customer: {
        id: customer.id,
        name: customer.name,
        currentDebt: result.debtAfter,
        creditLimit: Number(customer.creditLimit),
      },
      printUrls: {
        receiptUrl: amountCollected > 0 ? `/api/print/receipt/${deliveryId}` : undefined,
        deliveryUrl: `/api/print/delivery/${deliveryId}`,
      },
    };
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // APPLICATION FIFO DES PAIEMENTS SUR ANCIENNES DETTES
  // ───────────────────────────────────────────────────────────────────────────
  
  private async applyFifoDebtPayment(
    tx: any,
    customerId: string,
    amount: number,
    collectedBy: string,
    deliveryId: string,
  ): Promise<any[]> {
    // Récupérer les commandes impayées, les plus anciennes d'abord
    const unpaidOrders = await tx.query.orders.findMany({
      where: and(
        eq(orders.customerId, customerId),
        inArray(orders.paymentStatus, ['unpaid', 'partial']),
        eq(orders.status, 'delivered'),
      ),
      orderBy: [asc(orders.createdAt)],
    });
    
    const applications: any[] = [];
    let remaining = amount;
    
    for (const order of unpaidOrders) {
      if (remaining <= 0) break;
      
      const orderDue = Number(order.total) - Number(order.amountPaid);
      const toApply = Math.min(remaining, orderDue);
      
      if (toApply > 0) {
        // Mettre à jour la commande
        const newAmountPaid = Number(order.amountPaid) + toApply;
        const newPaymentStatus = 
          newAmountPaid >= Number(order.total) ? 'paid' : 'partial';
        
        await tx.update(orders)
          .set({
            amountPaid: newAmountPaid,
            amountDue: Number(order.total) - newAmountPaid,
            paymentStatus: newPaymentStatus,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, order.id));
        
        applications.push({
          orderId: order.id,
          amount: toApply,
          orderDate: order.createdAt,
        });
        
        remaining -= toApply;
      }
    }
    
    return applications;
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // MISE À JOUR DE LA CAISSE JOURNALIÈRE
  // ───────────────────────────────────────────────────────────────────────────
  
  private async updateDailyCash(
    tx: any,
    delivererId: string,
    organizationId: string,
    update: {
      collection?: number;
      newDebt?: number;
      deliveryCompleted?: boolean;
      deliveryFailed?: boolean;
    },
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Chercher ou créer la caisse du jour
    let cash = await tx.query.dailyCash.findFirst({
      where: and(
        eq(dailyCash.delivererId, delivererId),
        eq(dailyCash.date, today),
      ),
    });
    
    if (!cash) {
      // Créer la caisse du jour
      const [insertResult] = await tx.insert(dailyCash)
        .values({
          organizationId,
          delivererId,
          date: today,
          expectedCollection: 0,
          actualCollection: 0,
          newDebtCreated: 0,
          deliveriesTotal: 0,
          deliveriesCompleted: 0,
          deliveriesFailed: 0,
          isClosed: false,
        })
        .returning();
      cash = insertResult;
    }
    
    // Mettre à jour
    await tx.update(dailyCash)
      .set({
        actualCollection: sql`${dailyCash.actualCollection} + ${update.collection || 0}`,
        newDebtCreated: sql`${dailyCash.newDebtCreated} + ${update.newDebt || 0}`,
        deliveriesCompleted: update.deliveryCompleted
          ? sql`${dailyCash.deliveriesCompleted} + 1`
          : sql`${dailyCash.deliveriesCompleted}`,
        deliveriesFailed: update.deliveryFailed
          ? sql`${dailyCash.deliveriesFailed} + 1`
          : sql`${dailyCash.deliveriesFailed}`,
        updatedAt: new Date(),
      })
      .where(eq(dailyCash.id, cash.id));
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // ÉCHEC DE LIVRAISON
  // ───────────────────────────────────────────────────────────────────────────
  
  async failDelivery(
    deliveryId: string,
    input: FailDeliveryInput,
    delivererId: string,
  ): Promise<any> {
    const delivery = await db.query.deliveries.findFirst({
      where: eq(deliveries.id, deliveryId),
      with: { 
        order: { 
          with: { 
            customer: true 
          } 
        } 
      },
    });
    
    if (!delivery) {
      throw new AppError('NOT_FOUND', 'Livraison non trouvée');
    }
    
    if (delivery.delivererId !== delivererId) {
      throw new AppError('FORBIDDEN', 'Cette livraison n\'est pas assignée à vous');
    }
    
    await db.transaction(async (tx) => {
      // Marquer la livraison comme échouée
      await tx.update(deliveries)
        .set({
          status: 'failed',
          failureReason: input.reason,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(deliveries.id, deliveryId));
      
      // Mettre à jour la commande
      await tx.update(orders)
        .set({
          status: 'ready', // Remettre à ready pour réassignation
          updatedAt: new Date(),
        })
        .where(eq(orders.id, delivery.orderId));
      
      // Mettre à jour la caisse
      await this.updateDailyCash(tx, delivererId, delivery.organizationId, {
        deliveryFailed: true,
      });
      
      // Créer une transaction d'échec
      await tx.insert(deliveryTransactions).values({
        organizationId: delivery.organizationId,
        deliveryId: deliveryId,
        orderId: delivery.orderId,
        customerId: delivery.order!.customerId,
        type: 'failed',
        orderAmount: delivery.orderAmount,
        debtBefore: delivery.order!.customer?.currentDebt || 0,
        amountPaid: 0,
        appliedToOrder: 0,
        appliedToDebt: 0,
        newDebtCreated: 0,
        debtAfter: delivery.order!.customer?.currentDebt || 0,
        collectedBy: delivererId,
      });
    });
    
    // Notifier l'admin
    this.notifyDeliveryFailed(delivery.organizationId, delivery.order!.orderNumber, input.reason);
    
    // Émettre événement
    emitToOrganization(delivery.organizationId, 'delivery:failed', {
      deliveryId,
      orderId: delivery.orderId,
      reason: input.reason,
    });
    
    return { ...delivery, status: 'failed' };
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // COLLECTER DETTE SANS COMMANDE
  // ───────────────────────────────────────────────────────────────────────────
  
  async collectDebt(
    organizationId: string,
    customerId: string,
    amount: number,
    collectionMode: string,
    delivererId: string,
    notes?: string,
  ): Promise<{ customer: any; payment: any }> {
    const customer = await db.query.customers.findFirst({
      where: and(
        eq(customers.id, customerId),
        eq(customers.organizationId, organizationId),
      ),
    });
    
    if (!customer) {
      throw new AppError('NOT_FOUND', 'Client non trouvé');
    }
    
    if (amount <= 0) {
      throw new AppError('BAD_REQUEST', 'Le montant doit être positif');
    }
    
    if (amount > Number(customer.currentDebt)) {
      throw new AppError('BAD_REQUEST', `Le montant dépasse la dette actuelle (${customer.currentDebt} DZD)`);
    }
    
    const debtAfter = Number(customer.currentDebt) - amount;
    const receiptNumber = await this.generateReceiptNumber(organizationId);
    
    const result = await db.transaction(async (tx) => {
      // Mettre à jour le client
      await tx.update(customers)
        .set({
          currentDebt: debtAfter,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, customerId));
      
      // Enregistrer le paiement
      const [payment] = await tx.insert(paymentHistory)
        .values({
          organizationId,
          customerId,
          amount,
          mode: collectionMode as any,
          paymentType: 'debt_payment',
          collectedBy: delivererId,
          collectedAt: new Date(),
          receiptNumber,
          customerDebtBefore: Number(customer.currentDebt),
          customerDebtAfter: debtAfter,
          notes,
        })
        .returning();
      
      // Mettre à jour la caisse
      await this.updateDailyCash(tx, delivererId, organizationId, {
        collection: amount,
      });
      
      // Appliquer FIFO
      await this.applyFifoDebtPayment(tx, customerId, amount, delivererId, '');
      
      return payment;
    });
    
    // Notifier
    this.notifyPaymentReceived(customerId, amount);
    
    return {
      customer: {
        id: customer.id,
        name: customer.name,
        currentDebt: debtAfter,
      },
      payment: result,
    };
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // ASSIGNER DES LIVRAISONS
  // ───────────────────────────────────────────────────────────────────────────
  
  async assignDeliveries(
    organizationId: string,
    orderIds: string[],
    delivererId: string,
    scheduledDate: Date,
    optimizeRoute: boolean = false,
  ): Promise<any[]> {
    // Vérifier que le livreur existe et est actif
    const deliverer = await db.query.users.findFirst({
      where: and(
        eq(users.id, delivererId),
        eq(users.organizationId, organizationId),
        eq(users.role, 'deliverer'),
        eq(users.isActive, true),
      ),
    });
    
    if (!deliverer) {
      throw new AppError('NOT_FOUND', 'Livreur non trouvé ou inactif');
    }
    
    // Récupérer les commandes
    const ordersToAssign = await db.query.orders.findMany({
      where: and(
        inArray(orders.id, orderIds),
        eq(orders.organizationId, organizationId),
        inArray(orders.status, ['ready']),
      ),
      with: { customer: true },
    });
    
    if (ordersToAssign.length !== orderIds.length) {
      throw new AppError('BAD_REQUEST', 'Certaines commandes ne sont pas prêtes ou n\'existent pas');
    }
    
    // Optimiser l'itinéraire si demandé
    let sequencedOrders = ordersToAssign;
    if (optimizeRoute && ordersToAssign.length > 1) {
      sequencedOrders = await this.optimizeRouteOrder(ordersToAssign);
    }
    
    // Créer les livraisons
    const createdDeliveries = await db.transaction(async (tx) => {
      const results: any[] = [];
      
      for (let i = 0; i < sequencedOrders.length; i++) {
        const order = sequencedOrders[i];
        
        // Créer la livraison
        const [delivery] = await tx.insert(deliveries)
          .values({
            organizationId,
            orderId: order.id,
            delivererId,
            status: 'assigned',
            scheduledDate,
            sequenceNumber: i + 1,
            orderAmount: order.total,
            existingDebt: order.customer?.currentDebt || 0,
            totalToCollect: Number(order.total) + Number(order.customer?.currentDebt || 0),
            assignedAt: new Date(),
          })
          .returning();
        
        // Mettre à jour le statut de la commande
        await tx.update(orders)
          .set({
            status: 'assigned',
            updatedAt: new Date(),
          })
          .where(eq(orders.id, order.id));
        
        results.push({ ...delivery, order });
      }
      
      // Mettre à jour le total des livraisons dans la caisse du jour
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const existingCash = await tx.query.dailyCash.findFirst({
        where: and(
          eq(dailyCash.delivererId, delivererId),
          eq(dailyCash.date, today),
        ),
      });
      
      if (existingCash) {
        await tx.update(dailyCash)
          .set({
            deliveriesTotal: sql`${dailyCash.deliveriesTotal} + ${results.length}`,
            expectedCollection: sql`${dailyCash.expectedCollection} + ${results.reduce((sum, d) => sum + Number(d.totalToCollect), 0)}`,
            updatedAt: new Date(),
          })
          .where(eq(dailyCash.id, existingCash.id));
      } else {
        await tx.insert(dailyCash)
          .values({
            organizationId,
            delivererId,
            date: today,
            deliveriesTotal: results.length,
            expectedCollection: results.reduce((sum, d) => sum + Number(d.totalToCollect), 0),
            actualCollection: 0,
            newDebtCreated: 0,
            isClosed: false,
          });
      }
      
      return results;
    });
    
    // Notifier le livreur
    this.notifyDeliveriesAssigned(delivererId, createdDeliveries.length, scheduledDate);
    
    // Notifier les clients
    for (const delivery of createdDeliveries) {
      this.notifyDeliveryAssigned(delivery.order.customerId, delivery.order.orderNumber, deliverer.name);
    }
    
    return createdDeliveries;
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // OPTIMISATION D'ITINÉRAIRE (simplifié)
  // ───────────────────────────────────────────────────────────────────────────
  
  private async optimizeRouteOrder(orders: any[]): Promise<any[]> {
    // Pour une vraie optimisation, utiliser OSRM ou Google OR-Tools
    // Ici, on fait un tri simple par zone puis par nom
    return [...orders].sort((a, b) => {
      const zoneA = a.customer?.zone || '';
      const zoneB = b.customer?.zone || '';
      if (zoneA !== zoneB) return zoneA.localeCompare(zoneB);
      return (a.customer?.name || '').localeCompare(b.customer?.name || '');
    });
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // GÉNÉRATION NUMÉRO DE REÇU
  // ───────────────────────────────────────────────────────────────────────────
  
  private async generateReceiptNumber(organizationId: string, tx?: any): Promise<string> {
    const dbClient = tx || db;
    const today = new Date();
    const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    const [{ count }] = await dbClient
      .select({ count: sql`COUNT(*)` })
      .from(paymentHistory)
      .where(
        and(
          eq(paymentHistory.organizationId, organizationId),
          gte(paymentHistory.createdAt, new Date(today.setHours(0, 0, 0, 0))),
        )
      );
    
    const sequence = String(Number(count) + 1).padStart(4, '0');
    return `REC-${datePrefix}-${sequence}`;
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // NOTIFICATIONS (asynchrones)
  // ───────────────────────────────────────────────────────────────────────────
  
  private async notifyCreditLimitExceeded(organizationId: string, customerName: string, debt: number, limit: number): Promise<void> {
    try {
      const { notificationService } = await import('./notification.service');
      await notificationService.notifyAdmin(
        organizationId,
        'CREDIT_LIMIT_EXCEEDED',
        `Le client ${customerName} a dépassé sa limite de crédit: ${debt} DZD (limite: ${limit} DZD)`,
        { customerName, debt, limit }
      );
    } catch (error) {
      logger.error('Failed to notify credit limit:', error);
    }
  }
  
  private async notifyDeliveryFailed(organizationId: string, orderNumber: string, reason: string): Promise<void> {
    try {
      const { notificationService } = await import('./notification.service');
      await notificationService.notifyAdmin(
        organizationId,
        'DELIVERY_FAILED',
        `Échec de livraison #${orderNumber}: ${reason}`,
        { orderNumber, reason }
      );
    } catch (error) {
      logger.error('Failed to notify delivery failed:', error);
    }
  }
  
  private async notifyDeliveriesAssigned(delivererId: string, count: number, date: Date): Promise<void> {
    try {
      const { notificationService } = await import('./notification.service');
      await notificationService.sendToUser(
        delivererId,
        'DELIVERIES_ASSIGNED',
        'Nouvelles livraisons',
        `${count} livraison(s) assignée(s) pour le ${date.toLocaleDateString('fr-FR')}`,
        { count, date }
      );
    } catch (error) {
      logger.error('Failed to notify deliveries assigned:', error);
    }
  }
  
  private async notifyDeliveryAssigned(customerId: string, orderNumber: string, delivererName: string): Promise<void> {
    try {
      const { notificationService } = await import('./notification.service');
      await notificationService.sendToCustomer(
        customerId,
        'DELIVERY_ASSIGNED',
        'Livreur assigné',
        `${delivererName} livrera votre commande ${orderNumber}`,
        { orderNumber, delivererName }
      );
    } catch (error) {
      logger.error('Failed to notify delivery assigned:', error);
    }
  }
  
  private async notifyPaymentReceived(customerId: string, amount: number): Promise<void> {
    try {
      const { notificationService } = await import('./notification.service');
      await notificationService.sendToCustomer(
        customerId,
        'PAYMENT_RECEIVED',
        'Paiement reçu',
        `Nous avons reçu votre paiement de ${amount} DZD`,
        { amount }
      );
    } catch (error) {
      logger.error('Failed to notify payment received:', error);
    }
  }
  
  private async sendDeliveryNotification(customerId: string, orderNumber: string, amount: number): Promise<void> {
    try {
      const { notificationService } = await import('./notification.service');
      await notificationService.sendToCustomer(
        customerId,
        'DELIVERY_COMPLETED',
        'Livraison effectuée',
        `Commande ${orderNumber} livrée. Montant collecté: ${amount} DZD`,
        { orderNumber, amount }
      );
    } catch (error) {
      logger.error('Failed to send delivery notification:', error);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INSTANCE ET EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

const deliveryServiceInstance = new DeliveryService();

export const deliveryService = {
  list: deliveryServiceInstance.listDeliveries.bind(deliveryServiceInstance),
  getById: deliveryServiceInstance.getDeliveryById.bind(deliveryServiceInstance),
  getDelivererRoute: deliveryServiceInstance.getMyRoute.bind(deliveryServiceInstance),
  assign: deliveryServiceInstance.assignDeliveries.bind(deliveryServiceInstance),
  updateStatus: deliveryServiceInstance.updateDeliveryStatus.bind(deliveryServiceInstance),
  complete: deliveryServiceInstance.completeDelivery.bind(deliveryServiceInstance),
  fail: deliveryServiceInstance.failDelivery.bind(deliveryServiceInstance),
  optimize: deliveryServiceInstance.optimizeRouteOrder.bind(deliveryServiceInstance),
  updateDelivererPosition: deliveryServiceInstance.updateDelivererPosition.bind(deliveryServiceInstance),
  collectDebt: deliveryServiceInstance.collectDebt.bind(deliveryServiceInstance),
};

// Aliases pour compatibilité
export const listDeliveries = deliveryService.list;
export const getDeliveryById = deliveryService.getById;
export const getDelivererRoute = deliveryService.getDelivererRoute;
export const assignDeliveries = deliveryService.assign;
export const updateDeliveryStatus = deliveryService.updateStatus;
export const completeDelivery = deliveryService.complete;
export const failDelivery = deliveryService.fail;
export const optimizeRoute = deliveryService.optimize;
export const updateDelivererPosition = deliveryService.updateDelivererPosition;
export const collectDebt = deliveryService.collectDebt;

export default deliveryService;
