// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - CONTROLLER LIVRAISONS
// Tournée, assignation, encaissement, statuts
// ═══════════════════════════════════════════════════════════════════════════════

import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import deliveryService from '../services/delivery.service';
import paymentService from '../services/payment.service';
import { notifyDeliveryStarted, notifyDeliveryCompleted, notifyNewDeliveryAssigned } from '../worker';

// ═══════════════════════════════════════════════════════════════════════════════
// LISTE DES LIVRAISONS (Admin)
// ═══════════════════════════════════════════════════════════════════════════════

export const listDeliveries = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  
  const result = await deliveryService.listDeliveries(organizationId, req.query as any);

  res.json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MA TOURNÉE DU JOUR (Livreur)
// ═══════════════════════════════════════════════════════════════════════════════

export const getMyRoute = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const delivererId = req.user!.id;
  const { date } = req.query;

  const route = await deliveryService.getDelivererRoute(
    organizationId,
    delivererId,
    date as string
  );

  res.json({
    success: true,
    data: route,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DÉTAIL LIVRAISON
// ═══════════════════════════════════════════════════════════════════════════════

export const getDelivery = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const { id } = req.params;

  const delivery = await deliveryService.getDeliveryById(organizationId, id);

  res.json({
    success: true,
    data: delivery,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ASSIGNER LIVRAISONS À UN LIVREUR
// ═══════════════════════════════════════════════════════════════════════════════

export const assignDeliveries = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const { delivererId, orderIds, date } = req.body;

  const deliveries = await deliveryService.assignDeliveries(
    organizationId,
    delivererId,
    orderIds,
    date
  );

  // Notifier le livreur
  for (const delivery of deliveries) {
    await notifyNewDeliveryAssigned(
      delivererId,
      delivery.customer.name,
      delivery.order.orderNumber
    );
  }

  res.json({
    success: true,
    data: deliveries,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// OPTIMISER LA TOURNÉE
// ═══════════════════════════════════════════════════════════════════════════════

export const optimizeRoute = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const { delivererId, date, startLocation } = req.body;

  const optimizedRoute = await deliveryService.optimizeRoute(
    organizationId,
    delivererId,
    date,
    startLocation
  );

  res.json({
    success: true,
    data: optimizedRoute,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// METTRE À JOUR LE STATUT
// ═══════════════════════════════════════════════════════════════════════════════

export const updateDeliveryStatus = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const delivererId = req.user!.id;
  const { id } = req.params;
  const { status, location } = req.body;

  const delivery = await deliveryService.updateDeliveryStatus(
    organizationId,
    id,
    status,
    delivererId,
    location
  );

  // Notifier le client si la livraison est en cours
  if (status === 'in_transit') {
    await notifyDeliveryStarted(
      delivery.customer.id,
      delivery.order.orderNumber,
      req.user!.email // Nom du livreur
    );
  }

  res.json({
    success: true,
    data: delivery,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLÉTER UNE LIVRAISON
// ═══════════════════════════════════════════════════════════════════════════════

export const completeDelivery = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const delivererId = req.user!.id;
  const { id } = req.params;
  const {
    amountCollected,
    collectionMode,
    signatureData,
    signatureName,
    proofPhotos,
    notes,
    printReceipt,
    printDeliveryNote,
  } = req.body;

  // Récupérer la livraison
  const delivery = await deliveryService.getDeliveryById(organizationId, id);

  // Vérifier que c'est bien le livreur assigné
  if (delivery.delivererId !== delivererId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Vous n\'êtes pas assigné à cette livraison',
      },
    });
  }

  // Traiter le paiement
  const paymentResult = await paymentService.processDeliveryPayment(
    organizationId,
    id,
    delivery.orderId,
    delivery.customerId,
    delivererId,
    amountCollected,
    collectionMode
  );

  // Compléter la livraison
  const completedDelivery = await deliveryService.completeDelivery(
    organizationId,
    id,
    {
      amountCollected,
      collectionMode,
      signatureData,
      signatureName,
      proofPhotos,
      notes,
    }
  );

  // Notifier le client
  await notifyDeliveryCompleted(
    delivery.customerId,
    delivery.order.orderNumber,
    amountCollected,
    paymentResult.customer.newDebt
  );

  // Générer les URLs d'impression si demandé
  let printUrls = null;
  if (printReceipt || printDeliveryNote) {
    printUrls = {
      receipt: printReceipt ? `/print/receipt/${paymentResult.payment.id}` : null,
      deliveryNote: printDeliveryNote ? `/print/delivery/${id}` : null,
    };
  }

  res.json({
    success: true,
    data: {
      delivery: completedDelivery,
      payment: paymentResult.payment,
      breakdown: paymentResult.breakdown,
      customer: paymentResult.customer,
      printUrls,
    },
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MARQUER COMME ÉCHOUÉE
// ═══════════════════════════════════════════════════════════════════════════════

export const failDelivery = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const delivererId = req.user!.id;
  const { id } = req.params;
  const { reason, notes, location } = req.body;

  const delivery = await deliveryService.failDelivery(
    organizationId,
    id,
    delivererId,
    reason,
    notes,
    location
  );

  res.json({
    success: true,
    data: delivery,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// COLLECTER DETTE SANS COMMANDE
// ═══════════════════════════════════════════════════════════════════════════════

export const collectDebt = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const delivererId = req.user!.id;
  const { customerId, amount, mode, notes } = req.body;

  const paymentResult = await paymentService.createPayment(
    organizationId,
    delivererId,
    {
      customerId,
      amount,
      mode,
      paymentType: 'debt_payment',
      notes,
    }
  );

  res.json({
    success: true,
    data: paymentResult,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// METTRE À JOUR LA POSITION
// ═══════════════════════════════════════════════════════════════════════════════

export const updatePosition = asyncHandler(async (req: Request, res: Response) => {
  const delivererId = req.user!.id;
  const { latitude, longitude, accuracy, speed, heading } = req.body;

  await deliveryService.updateDelivererPosition(delivererId, {
    latitude,
    longitude,
    accuracy,
    speed,
    heading,
    timestamp: new Date(),
  });

  res.json({
    success: true,
    message: 'Position mise à jour',
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STUBS
// ═══════════════════════════════════════════════════════════════════════════════

export const getDelivererRoute = asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'getDelivererRoute (stub)',
    data: {}
  });
});

export const getDeliveryById = asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'getDeliveryById (stub)',
    data: {}
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  listDeliveries,
  getMyRoute,
  getDelivery,
  assignDeliveries,
  optimizeRoute,
  updateDeliveryStatus,
  completeDelivery,
  failDelivery,
  collectDebt,
  updatePosition,
  getDelivererRoute,
  getDeliveryById,
};
