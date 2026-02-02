// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - CONTROLLER COMMANDES
// CRUD commandes, statuts, duplication
// ═══════════════════════════════════════════════════════════════════════════════

import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import orderService from '../services/order.service';
import { notifyOrderCreated, notifyOrderConfirmed } from '../worker';

// ═══════════════════════════════════════════════════════════════════════════════
// LISTE DES COMMANDES
// ═══════════════════════════════════════════════════════════════════════════════

export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  
  const result = await orderService.listOrders(organizationId, req.query as any);

  res.json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DÉTAIL COMMANDE
// ═══════════════════════════════════════════════════════════════════════════════

export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const { id } = req.params;

  const order = await orderService.getOrderById(organizationId, id);

  res.json({
    success: true,
    data: order,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CRÉATION COMMANDE (Admin)
// ═══════════════════════════════════════════════════════════════════════════════

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const userId = req.user!.id;

  const order = await orderService.createOrder(organizationId, userId, req.body);

  // Notification au client
  await notifyOrderCreated(order.customerId, order.orderNumber);

  res.status(201).json({
    success: true,
    data: order,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CRÉATION COMMANDE (Client App)
// ═══════════════════════════════════════════════════════════════════════════════

export const createOrderByCustomer = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const customerId = req.user!.id; // L'ID du customerAccount

  // Récupérer le vrai customerId depuis customerAccount
  // Note: à implémenter dans le service
  
  const order = await orderService.createOrderByCustomer(organizationId, customerId, req.body);

  res.status(201).json({
    success: true,
    data: order,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MISE À JOUR COMMANDE
// ═══════════════════════════════════════════════════════════════════════════════

export const updateOrder = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const { id } = req.params;

  const order = await orderService.updateOrder(organizationId, id, req.body);

  res.json({
    success: true,
    data: order,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CHANGEMENT DE STATUT
// ═══════════════════════════════════════════════════════════════════════════════

export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const { id } = req.params;
  const { status, reason } = req.body;

  const order = await orderService.updateOrderStatus(organizationId, id, status, reason);

  // Notifications selon le statut
  if (status === 'confirmed') {
    await notifyOrderConfirmed(order.customerId, order.orderNumber);
  }

  res.json({
    success: true,
    data: order,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ANNULATION
// ═══════════════════════════════════════════════════════════════════════════════

export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const { id } = req.params;
  const { reason } = req.body;

  const order = await orderService.cancelOrder(organizationId, id, reason);

  res.json({
    success: true,
    data: order,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DUPLICATION
// ═══════════════════════════════════════════════════════════════════════════════

export const duplicateOrder = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organizationId!;
  const userId = req.user!.id;
  const { id } = req.params;
  const { deliveryDate } = req.body;

  const order = await orderService.duplicateOrder(organizationId, id, userId, deliveryDate);

  res.status(201).json({
    success: true,
    data: order,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STUB - getOrderById
// ═══════════════════════════════════════════════════════════════════════════════

export const getOrderById = asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'getOrderById (stub)',
    data: {}
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  listOrders,
  getOrder,
  createOrder,
  createOrderByCustomer,
  updateOrder,
  updateOrderStatus,
  cancelOrder,
  duplicateOrder,
  getOrderById,
};
