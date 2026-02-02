// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - CONTRÔLEUR API CLIENT MOBILE
// Endpoints spécifiques pour l'application mobile client
// ═══════════════════════════════════════════════════════════════════════════════

import { Request, Response, NextFunction } from 'express';
import { CustomerService } from '../services';
import { OrderService } from '../services';
import { ProductService } from '../services';
import { PaymentService } from '../services';
import { AuthenticatedUser } from '../middlewares/auth.middleware';
import { z } from 'zod';
import { db } from '../database';
import { customers, orders, orderItems, products, categories, notifications } from '../database/schema';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';

// ═══════════════════════════════════════════════════════════════════════════════
// SCHÉMAS DE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
    note: z.string().optional(),
  })).min(1, 'Au moins un article requis'),
  deliveryNote: z.string().optional(),
  requestedDeliveryDate: z.string().datetime().optional(),
});

const cancelOrderSchema = z.object({
  reason: z.string().min(5, 'Raison requise (min 5 caractères)'),
});

const feedbackSchema = z.object({
  message: z.string().min(10, 'Message requis (min 10 caractères)'),
  rating: z.number().int().min(1).max(5).optional(),
  orderId: z.string().uuid().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRÔLEUR
// ═══════════════════════════════════════════════════════════════════════════════

export class CustomerApiController {
  
  /**
   * Profil client avec statistiques
   * GET /api/customer/profile
   */
  async getProfile(req: AuthenticatedUser, res: Response, next: NextFunction) {
    try {
      const customerId = req.user!.customerId;
      const organizationId = req.user!.organizationId;

      const [customer] = await db
        .select()
        .from(customers)
        .where(and(
          eq(customers.id, customerId!),
          eq(customers.organizationId, organizationId)
        ))
        .limit(1);

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Client non trouvé',
        });
      }

      // Calculer les statistiques
      const [stats] = await db
        .select({
          totalOrders: sql<number>`COUNT(*)`,
          totalSpent: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
          pendingOrders: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} IN ('pending', 'confirmed', 'preparing', 'ready'))`,
        })
        .from(orders)
        .where(eq(orders.customerId, customerId!));

      // Calculer le crédit disponible
      const availableCredit = customer.creditLimitEnabled && customer.creditLimit
        ? Math.max(0, customer.creditLimit - customer.currentDebt)
        : null;

      res.json({
        success: true,
        data: {
          customer: {
            id: customer.id,
            code: customer.code,
            name: customer.name,
            phone: customer.phone,
            address: customer.address,
            city: customer.city,
            wilaya: customer.wilaya,
            currentDebt: customer.currentDebt,
            creditLimit: customer.creditLimit,
            creditLimitEnabled: customer.creditLimitEnabled,
            
          },
          stats: {
            totalOrders: stats.totalOrders,
            totalSpent: stats.totalSpent,
            pendingOrders: stats.pendingOrders,
          },
          availableCredit,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Catalogue produits (filtré pour le client)
   * GET /api/customer/products
   */
  async getProducts(req: AuthenticatedUser, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      const { categoryId, search, page = '1', limit = '50' } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      let query = db
        .select({
          id: products.id,
          sku: products.sku,
          name: products.name,
          description: products.description,
          categoryId: products.categoryId,
          categoryName: categories.name,
          unit: products.unit,
          basePrice: products.price,
          discountPrice: products.discountPrice,
          currentPrice: products.price,
          imageUrl: products.imageUrl,
          stockQuantity: products.currentStock,
          isAvailable: sql<boolean>`${products.isActive} AND ${products.currentStock} > 0`,
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(and(
          eq(products.organizationId, organizationId),
          eq(products.isActive, true),
        ))
        .$dynamic();

      // Filtres
      if (categoryId) {
        query = query.where(eq(products.categoryId, categoryId as string));
      }

      if (search) {
        const searchTerm = `%${search}%`;
        query = query.where(
          sql`(${products.name} ILIKE ${searchTerm} OR ${products.sku} ILIKE ${searchTerm})`
        );
      }

      const result = await query
        .orderBy(products.name)
        .limit(limitNum)
        .offset(offset);

      // Total pour pagination
      const [{ count }] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(products)
        .where(and(
          eq(products.organizationId, organizationId),
          eq(products.isActive, true),
        ));

      res.json({
        success: true,
        data: result,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count,
          totalPages: Math.ceil(count / limitNum),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Produits en vedette
   * GET /api/customer/products/featured
   */
  async getFeaturedProducts(req: AuthenticatedUser, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;

      // Produits les plus commandés par ce client
      const customerId = req.user!.customerId;
      
      const popularProducts = await db
        .select({
          id: products.id,
          sku: products.sku,
          name: products.name,
          description: products.description,
          unit: products.unit,
          basePrice: products.price,
          discountPrice: products.discountPrice,
          currentPrice: products.price,
          imageUrl: products.imageUrl,
          orderCount: sql<number>`COUNT(${orderItems.id})`,
        })
        .from(products)
        .innerJoin(orderItems, eq(products.id, orderItems.productId))
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(and(
          eq(products.organizationId, organizationId),
          eq(products.isActive, true),
          eq(orders.customerId, customerId!),
          gte(orders.createdAt, sql`NOW() - INTERVAL '90 days'`),
        ))
        .groupBy(products.id)
        .orderBy(desc(sql`COUNT(${orderItems.id})`))
        .limit(10);

      res.json({
        success: true,
        data: popularProducts,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Catégories
   * GET /api/customer/categories
   */
  async getCategories(req: AuthenticatedUser, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;

      const result = await db
        .select({
          id: categories.id,
          name: categories.name,
          description: categories.description,
          imageUrl: categories.imageUrl,
          productCount: sql<number>`(
            SELECT COUNT(*) FROM ${products} 
            WHERE ${products.categoryId} = ${categories.id} 
            AND ${products.isActive} = true
          )`,
        })
        .from(categories)
        .where(and(
          eq(categories.organizationId, organizationId),
          eq(categories.isActive, true),
        ))
        .orderBy(categories.sortOrder, categories.name);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Liste des commandes du client
   * GET /api/customer/orders
   */
  async getOrders(req: AuthenticatedUser, res: Response, next: NextFunction) {
    try {
      const customerId = req.user!.customerId;
      const { status, page = '1', limit = '20' } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      let query = db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          status: orders.status,
          subtotal: orders.subtotal,
          discount: orders.discountAmount,
          deliveryFee: orders.deliveryFee,
          totalAmount: orders.total,
          paidAmount: orders.amountPaid,
          itemCount: sql<number>`(
            SELECT COUNT(*) FROM ${orderItems} WHERE ${orderItems.orderId} = ${orders.id}
          )`,
          createdAt: orders.createdAt,
          requestedDeliveryDate: orders.deliveryDate,
        })
        .from(orders)
        .where(eq(orders.customerId, customerId!))
        .$dynamic();

      if (status) {
        const statuses = (status as string).split(',');
        query = query.where(sql`${orders.status} IN (${sql.join(statuses.map(s => sql`${s}`), sql`, `)})`);
      }

      const result = await query
        .orderBy(desc(orders.createdAt))
        .limit(limitNum)
        .offset(offset);

      const [{ count }] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(orders)
        .where(eq(orders.customerId, customerId!));

      res.json({
        success: true,
        data: result,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count,
          totalPages: Math.ceil(count / limitNum),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Détail d'une commande
   * GET /api/customer/orders/:id
   */
  async getOrderDetail(req: AuthenticatedUser, res: Response, next: NextFunction) {
    try {
      const customerId = req.user!.customerId;
      const { id } = req.params;

      const [order] = await db
        .select()
        .from(orders)
        .where(and(
          eq(orders.id, id),
          eq(orders.customerId, customerId!),
        ))
        .limit(1);

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Commande non trouvée',
        });
      }

      // Récupérer les articles
      const items = await db
        .select({
          id: orderItems.id,
          productId: orderItems.productId,
          productName: products.name,
          productSku: products.sku,
          quantity: orderItems.quantity,
          unitPrice: orderItems.unitPrice,
      totalPrice: orderItems.totalPrice,
          discount: orderItems.discount,
          lineTotal: orderItems.totalPrice,
          note: orderItems.notes,
        })
        .from(orderItems)
        .innerJoin(products, eq(orderItems.productId, products.id))
        .where(eq(orderItems.orderId, id));

      res.json({
        success: true,
        data: {
          ...order,
          items,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Créer une commande
   * POST /api/customer/orders
   */
  async createOrder(req: AuthenticatedUser, res: Response, next: NextFunction) {
    try {
      const customerId = req.user!.customerId;
      const organizationId = req.user!.organizationId;
      const data = createOrderSchema.parse(req.body);

      // Vérifier le client et sa limite de crédit
      const [customer] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, customerId!))
        .limit(1);

      if (!customer || !customer.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Compte client inactif',
        });
      }

      // Vérifier la disponibilité des produits et calculer le total
      let totalAmount = 0;
      const orderItemsData = [];

      for (const item of data.items) {
        const [product] = await db
          .select()
          .from(products)
          .where(and(
            eq(products.id, item.productId),
            eq(products.organizationId, organizationId),
            eq(products.isActive, true),
          ))
          .limit(1);

        if (!product) {
          return res.status(400).json({
            success: false,
            message: `Produit non trouvé: ${item.productId}`,
          });
        }

        if (product.currentStock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Stock insuffisant pour ${product.name}`,
          });
        }

        const lineTotal = product.price * item.quantity;
        totalAmount += lineTotal;

        orderItemsData.push({
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          unitPrice: product.price,
          lineTotal,
          note: item.note,
        });
      }

      // Vérifier la limite de crédit
      if (customer.creditLimitEnabled && customer.creditLimit) {
        const availableCredit = customer.creditLimit - customer.currentDebt;
        if (totalAmount > availableCredit) {
          return res.status(400).json({
            success: false,
            message: `Limite de crédit dépassée. Disponible: ${availableCredit} DA`,
            code: 'CREDIT_LIMIT_EXCEEDED',
          });
        }
      }

      // Générer le numéro de commande
      const today = new Date();
      const datePrefix = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
      
      const [lastOrder] = await db
        .select({ orderNumber: orders.orderNumber })
        .from(orders)
        .where(sql`${orders.orderNumber} LIKE ${'CMD-' + datePrefix + '-%'}`)
        .orderBy(desc(orders.orderNumber))
        .limit(1);

      let sequence = 1;
      if (lastOrder) {
        const lastSeq = parseInt(lastOrder.orderNumber.split('-')[2]);
        sequence = lastSeq + 1;
      }
      const orderNumber = `CMD-${datePrefix}-${String(sequence).padStart(4, '0')}`;

      // Créer la commande
      const [newOrder] = await db
        .insert(orders)
        .values({
          organizationId,
          customerId: customerId!,
          orderNumber,
          status: 'pending',
          source: 'customer_app',
          subtotal: totalAmount,
          
          deliveryFee: 0,
          totalAmount,
          paidAmount: 0,
          deliveryNote: data.deliveryNote,
          requestedDeliveryDate: data.requestedDeliveryDate 
            ? new Date(data.requestedDeliveryDate) 
            : undefined,
          createdBy: customerId!,
        })
        .returning();

      // Créer les articles
      for (const item of orderItemsData) {
        await db.insert(orderItems).values({
          orderId: newOrder.id,
          ...item,
        });

        // Réduire le stock
        await db
          .update(products)
          .set({
            currentStock: sql`${products.currentStock} - ${item.quantity}`,
          })
          .where(eq(products.id, item.productId));
      }

      // Mettre à jour la dette du client
      await db
        .update(customers)
        .set({
          currentDebt: sql`${customers.currentDebt} + ${totalAmount}`,
        })
        .where(eq(customers.id, customerId!));

      res.status(201).json({
        success: true,
        data: {
          ...newOrder,
          items: orderItemsData,
        },
        message: 'Commande créée avec succès',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Annuler une commande
   * POST /api/customer/orders/:id/cancel
   */
  async cancelOrder(req: AuthenticatedUser, res: Response, next: NextFunction) {
    try {
      const customerId = req.user!.customerId;
      const { id } = req.params;
      const { reason } = cancelOrderSchema.parse(req.body);

      const [order] = await db
        .select()
        .from(orders)
        .where(and(
          eq(orders.id, id),
          eq(orders.customerId, customerId!),
        ))
        .limit(1);

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Commande non trouvée',
        });
      }

      // Seules les commandes pending ou confirmed peuvent être annulées par le client
      if (!['pending', 'confirmed'].includes(order.status)) {
        return res.status(400).json({
          success: false,
          message: 'Cette commande ne peut plus être annulée',
        });
      }

      // Restaurer le stock
      const items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, id));

      for (const item of items) {
        await db
          .update(products)
          .set({
            currentStock: sql`${products.currentStock} + ${item.quantity}`,
          })
          .where(eq(products.id, item.productId));
      }

      // Mettre à jour la dette (annuler le montant non payé)
      const unpaidAmount = order.total - order.amountPaid;
      if (unpaidAmount > 0) {
        await db
          .update(customers)
          .set({
            currentDebt: sql`${customers.currentDebt} - ${unpaidAmount}`,
          })
          .where(eq(customers.id, customerId!));
      }

      // Mettre à jour la commande
      await db
        .update(orders)
        .set({
          status: 'cancelled',
          cancellationReason: reason,
          cancelledAt: new Date(),
          cancelledBy: customerId!,
        })
        .where(eq(orders.id, id));

      res.json({
        success: true,
        message: 'Commande annulée',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Relevé de compte
   * GET /api/customer/statement
   */
  async getStatement(req: AuthenticatedUser, res: Response, next: NextFunction) {
    try {
      const customerId = req.user!.customerId;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Dates de début et fin requises',
        });
      }

      const customerService = new CustomerService();
      const statement = await customerService.getCustomerStatement(
        req.user!.organizationId,
        customerId!,
        startDate as string,
        endDate as string
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
   * Notifications
   * GET /api/customer/notifications
   */
  async getNotifications(req: AuthenticatedUser, res: Response, next: NextFunction) {
    try {
      const customerId = req.user!.customerId;

      const result = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, customerId!))
        .orderBy(desc(notifications.createdAt))
        .limit(50);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Marquer notification comme lue
   * PATCH /api/customer/notifications/:id/read
   */
  async markNotificationRead(req: AuthenticatedUser, res: Response, next: NextFunction) {
    try {
      const customerId = req.user!.customerId;
      const { id } = req.params;

      await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(
          eq(notifications.id, id),
          eq(notifications.userId, customerId!),
        ));

      res.json({
        success: true,
        message: 'Notification marquée comme lue',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Envoyer un feedback
   * POST /api/customer/feedback
   */
  async submitFeedback(req: AuthenticatedUser, res: Response, next: NextFunction) {
    try {
      const customerId = req.user!.customerId;
      const organizationId = req.user!.organizationId;
      const data = feedbackSchema.parse(req.body);

      // TODO: Stocker dans une table feedback
      // Pour l'instant, logger
      console.log('Customer feedback:', {
        customerId,
        organizationId,
        ...data,
        timestamp: new Date(),
      });

      res.json({
        success: true,
        message: 'Merci pour votre retour',
      });
    } catch (error) {
      next(error);
    }
  }
}

// Instance singleton
export const customerApiController = new CustomerApiController();
