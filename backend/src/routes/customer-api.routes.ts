// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - ROUTES API CLIENT MOBILE
// Routes dédiées pour l'application mobile client
// ═══════════════════════════════════════════════════════════════════════════════

import { Router } from 'express';
import { customerApiController } from '../controllers/customer-api.controller';
import { authenticateCustomer, rateLimit } from '../middlewares/auth.middleware';

const router = Router();

// Middleware d'authentification client pour toutes les routes
router.use(authenticateCustomer);

// ═══════════════════════════════════════════════════════════════════════════════
// PROFIL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route GET /api/customer/profile
 * @desc Obtenir le profil du client avec statistiques
 * @access Client authentifié
 */
router.get('/profile', customerApiController.getProfile.bind(customerApiController));

// ═══════════════════════════════════════════════════════════════════════════════
// CATALOGUE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route GET /api/customer/categories
 * @desc Liste des catégories de produits
 * @access Client authentifié
 */
router.get('/categories', customerApiController.getCategories.bind(customerApiController));

/**
 * @route GET /api/customer/products
 * @desc Liste des produits disponibles
 * @query categoryId - Filtrer par catégorie
 * @query search - Recherche texte
 * @query page - Page (défaut: 1)
 * @query limit - Limite (défaut: 50)
 * @access Client authentifié
 */
router.get('/products', customerApiController.getProducts.bind(customerApiController));

/**
 * @route GET /api/customer/products/featured
 * @desc Produits populaires pour ce client
 * @access Client authentifié
 */
router.get('/products/featured', customerApiController.getFeaturedProducts.bind(customerApiController));

// ═══════════════════════════════════════════════════════════════════════════════
// COMMANDES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route GET /api/customer/orders
 * @desc Liste des commandes du client
 * @query status - Filtrer par statut(s) (ex: "pending,confirmed")
 * @query page - Page
 * @query limit - Limite
 * @access Client authentifié
 */
router.get('/orders', customerApiController.getOrders.bind(customerApiController));

/**
 * @route GET /api/customer/orders/:id
 * @desc Détail d'une commande
 * @access Client authentifié
 */
router.get('/orders/:id', customerApiController.getOrderDetail.bind(customerApiController));

/**
 * @route POST /api/customer/orders
 * @desc Créer une nouvelle commande
 * @body { items: [{ productId, quantity, note? }], deliveryNote?, requestedDeliveryDate? }
 * @access Client authentifié
 */
router.post(
  '/orders',
  rateLimit(10, 60), // Max 10 commandes par minute
  customerApiController.createOrder.bind(customerApiController)
);

/**
 * @route POST /api/customer/orders/:id/cancel
 * @desc Annuler une commande (si pending ou confirmed)
 * @body { reason: string }
 * @access Client authentifié
 */
router.post('/orders/:id/cancel', customerApiController.cancelOrder.bind(customerApiController));

// ═══════════════════════════════════════════════════════════════════════════════
// COMPTE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route GET /api/customer/statement
 * @desc Relevé de compte
 * @query startDate - Date de début (YYYY-MM-DD)
 * @query endDate - Date de fin (YYYY-MM-DD)
 * @access Client authentifié
 */
router.get('/statement', customerApiController.getStatement.bind(customerApiController));

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route GET /api/customer/notifications
 * @desc Liste des notifications
 * @access Client authentifié
 */
router.get('/notifications', customerApiController.getNotifications.bind(customerApiController));

/**
 * @route PATCH /api/customer/notifications/:id/read
 * @desc Marquer une notification comme lue
 * @access Client authentifié
 */
router.patch('/notifications/:id/read', customerApiController.markNotificationRead.bind(customerApiController));

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPORT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @route POST /api/customer/feedback
 * @desc Envoyer un feedback
 * @body { message: string, rating?: number, orderId?: string }
 * @access Client authentifié
 */
router.post('/feedback', customerApiController.submitFeedback.bind(customerApiController));

export default router;
