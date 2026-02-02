// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - ROUTES API PRINCIPALES
// Configuration complète des routes avec validation Zod
// ═══════════════════════════════════════════════════════════════════════════════

import { Router } from 'express';
import { validateBody, validateQuery, validateParams, validateId } from '../middlewares/validation.middleware';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { schemas } from '../validators/schemas';
import { z } from 'zod';

// Controllers
import * as authController from '../controllers/auth.controller';
import organizationController from '../controllers/organization.controller';
import * as userController from '../controllers/user.controller';
import * as customerController from '../controllers/customer.controller';
import * as productController from '../controllers/product.controller';
import * as orderController from '../controllers/order.controller';
import * as deliveryController from '../controllers/delivery.controller';
import * as paymentController from '../controllers/payment.controller';
import * as financeController from '../controllers/finance.controller';
import * as reportController from '../controllers/report.controller';
import * as syncController from '../controllers/sync.controller';
import * as notificationController from '../controllers/notification.controller';
import * as printController from '../controllers/print.controller';
import * as dailyCashController from '../controllers/daily-cash.controller';
import * as dashboardController from '../controllers/dashboard.controller';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHENTIFICATION (Public)
// ═══════════════════════════════════════════════════════════════════════════════

const authRoutes = Router();

// Login admin/livreur
authRoutes.post('/login',
  validateBody(schemas.auth.login),
  authController.login
);

// Login client - demande OTP
authRoutes.post('/customer/request-otp',
  validateBody(schemas.auth.customerLoginRequest),
  authController.requestOtp
);

// Login client - vérifier OTP
authRoutes.post('/customer/verify-otp',
  validateBody(schemas.auth.customerLoginVerify),
  authController.verifyOtp
);

// Refresh token
authRoutes.post('/refresh',
  validateBody(schemas.auth.refreshToken),
  authController.refreshToken
);

// Logout
authRoutes.post('/logout',
  authenticate,
  authController.logout
);

// Changer mot de passe
authRoutes.put('/password',
  authenticate,
  validateBody(schemas.auth.changePassword),
  authController.changePassword
);

// Reset password - demande
authRoutes.post('/reset-password/request',
  validateBody(schemas.auth.resetPasswordRequest),
  authController.requestPasswordReset
);

// Reset password - confirmer
authRoutes.post('/reset-password/confirm',
  validateBody(schemas.auth.resetPassword),
  authController.resetPassword
);

// Profil utilisateur connecté
authRoutes.get('/me',
  authenticate,
  authController.me
);

router.use('/auth', authRoutes);

// ═══════════════════════════════════════════════════════════════════════════════
// ORGANISATION (Admin/Manager)
// ═══════════════════════════════════════════════════════════════════════════════

const orgRoutes = Router();
orgRoutes.use(authenticate, authorize('admin', 'manager'));

// Info organisation
orgRoutes.get('/', organizationController.get);

// Modifier organisation
orgRoutes.put('/',
  validateBody(schemas.organization.update),
  organizationController.update
);

// Modifier paramètres
orgRoutes.put('/settings',
  validateBody(schemas.organization.updateSettings),
  organizationController.updateSettings
);

// Dashboard stats
orgRoutes.get('/dashboard', dashboardController.getOverview);

// Stats détaillées
orgRoutes.get('/stats/sales', dashboardController.getSalesStats);
orgRoutes.get('/stats/top-products', dashboardController.getTopProducts);
orgRoutes.get('/stats/deliverer-performance', dashboardController.getDelivererPerformance);
orgRoutes.get('/stats/stock-alerts', dashboardController.getStockAlerts);

router.use('/organization', orgRoutes);

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD (Admin/Manager)
// ═══════════════════════════════════════════════════════════════════════════════

const dashboardRoutes = Router();
dashboardRoutes.use(authenticate, authorize('admin', 'manager'));

// Vue d'ensemble
dashboardRoutes.get('/overview', dashboardController.getOverview);

// Stats ventes
dashboardRoutes.get('/sales', validateQuery(schemas.finance.overview), dashboardController.getSalesStats);

// Top produits
dashboardRoutes.get('/top-products', dashboardController.getTopProducts);

// Performance livreurs
dashboardRoutes.get('/deliverer-performance', validateQuery(schemas.dateRange), dashboardController.getDelivererPerformance);

// Alertes stock
dashboardRoutes.get('/stock-alerts', dashboardController.getStockAlerts);

router.use('/dashboard', dashboardRoutes);

// ═══════════════════════════════════════════════════════════════════════════════
// UTILISATEURS (Admin only)
// ═══════════════════════════════════════════════════════════════════════════════

const userRoutes = Router();
userRoutes.use(authenticate, authorize('admin'));

// Liste utilisateurs
userRoutes.get('/',
  validateQuery(schemas.user.query),
  userController.list
);

// Créer utilisateur
userRoutes.post('/',
  validateBody(schemas.user.create),
  userController.create
);

// Détail utilisateur
userRoutes.get('/:id',
  validateId,
  userController.getById
);

// Modifier utilisateur
userRoutes.put('/:id',
  validateId,
  validateBody(schemas.user.update),
  userController.update
);

// Supprimer/désactiver utilisateur
userRoutes.delete('/:id',
  validateId,
  userController.remove
);

// Performance livreur
userRoutes.get('/:id/performance',
  validateId,
  validateQuery(schemas.dateRange),
  userController.performance
);

// Mettre à jour position (livreur)
userRoutes.put('/:id/position',
  validateId,
  authorize('deliverer'),
  validateBody(schemas.user.updatePosition),
  userController.updateUserPosition
);

router.use('/users', userRoutes);

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENTS
// ═══════════════════════════════════════════════════════════════════════════════

const customerRoutes = Router();
customerRoutes.use(authenticate);

// Liste clients
customerRoutes.get('/',
  authorize('admin', 'manager', 'deliverer'),
  validateQuery(schemas.customer.query),
  customerController.listCustomers
);

// Créer client
customerRoutes.post('/',
  authorize('admin', 'manager'),
  validateBody(schemas.customer.create),
  customerController.createCustomer
);

// Détail client
customerRoutes.get('/:id',
  validateId,
  customerController.getCustomerById
);

// Modifier client
customerRoutes.put('/:id',
  authorize('admin', 'manager'),
  validateId,
  validateBody(schemas.customer.update),
  customerController.updateCustomer
);

// Supprimer/désactiver client
customerRoutes.delete('/:id',
  authorize('admin'),
  validateId,
  customerController.deleteCustomer
);

// Commandes du client
customerRoutes.get('/:id/orders',
  validateId,
  validateQuery(schemas.order.query),
  customerController.getOrders
);

// Paiements du client
customerRoutes.get('/:id/payments',
  validateId,
  validateQuery(schemas.payment.query),
  customerController.getCustomerPayments
);

// Relevé de compte
customerRoutes.get('/:id/statement',
  validateId,
  validateQuery(schemas.report.customerStatement.omit({ customerId: true })),
  customerController.getStatement
);

// Modifier limite crédit
customerRoutes.put('/:id/credit-limit',
  authorize('admin', 'manager'),
  validateId,
  validateBody(schemas.customer.updateCreditLimit),
  customerController.updateCustomerCreditLimit
);

router.use('/customers', customerRoutes);

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUITS
// ═══════════════════════════════════════════════════════════════════════════════

const productRoutes = Router();
productRoutes.use(authenticate);

// Liste produits
productRoutes.get('/',
  validateQuery(schemas.product.query),
  productController.listProducts
);

// Créer produit
productRoutes.post('/',
  authorize('admin', 'manager'),
  validateBody(schemas.product.create),
  productController.createProduct
);

// Détail produit
productRoutes.get('/:id',
  validateId,
  productController.getProductById
);

// Modifier produit
productRoutes.put('/:id',
  authorize('admin', 'manager'),
  validateId,
  validateBody(schemas.product.update),
  productController.updateProduct
);

// Supprimer produit
productRoutes.delete('/:id',
  authorize('admin'),
  validateId,
  productController.deleteProduct
);

// Réorganiser l'ordre
productRoutes.put('/reorder',
  authorize('admin', 'manager'),
  validateBody(schemas.product.reorder),
  productController.reorderProducts
);

// Ajuster stock
productRoutes.put('/:id/stock',
  authorize('admin', 'manager'),
  validateId,
  validateBody(z.object({
    quantity: z.number(),
    reason: z.string().optional(),
  })),
  productController.updateStock
);

router.use('/products', productRoutes);

// ═══════════════════════════════════════════════════════════════════════════════
// CATÉGORIES
// ═══════════════════════════════════════════════════════════════════════════════

const categoryRoutes = Router();
categoryRoutes.use(authenticate);

// Liste catégories
categoryRoutes.get('/',
  productController.listCategories
);

// Créer catégorie
categoryRoutes.post('/',
  authorize('admin', 'manager'),
  validateBody(schemas.category.create),
  productController.createCategory
);

// Modifier catégorie
categoryRoutes.put('/:id',
  authorize('admin', 'manager'),
  validateId,
  validateBody(schemas.category.update),
  productController.updateCategory
);

// Supprimer catégorie
categoryRoutes.delete('/:id',
  authorize('admin'),
  validateId,
  productController.deleteCategory
);

router.use('/categories', categoryRoutes);

// ═══════════════════════════════════════════════════════════════════════════════
// COMMANDES
// ═══════════════════════════════════════════════════════════════════════════════

const orderRoutes = Router();
orderRoutes.use(authenticate);

// Liste commandes
orderRoutes.get('/',
  authorize('admin', 'manager', 'deliverer', 'kitchen'),
  validateQuery(schemas.order.query),
  orderController.listOrders
);

// Créer commande (admin)
orderRoutes.post('/',
  authorize('admin', 'manager'),
  validateBody(schemas.order.create),
  orderController.createOrder
);

// Créer commande (client app)
orderRoutes.post('/customer',
  authorize('customer'),
  validateBody(schemas.order.createByCustomer),
  orderController.createOrderByCustomer
);

// Détail commande
orderRoutes.get('/:id',
  validateId,
  orderController.getOrderById
);

// Modifier commande
orderRoutes.put('/:id',
  authorize('admin', 'manager'),
  validateId,
  validateBody(schemas.order.update),
  orderController.updateOrder
);

// Changer statut
orderRoutes.put('/:id/status',
  authorize('admin', 'manager', 'kitchen', 'deliverer'),
  validateId,
  validateBody(schemas.order.updateStatus),
  orderController.updateOrderStatus
);

// Annuler commande
orderRoutes.put('/:id/cancel',
  authorize('admin', 'manager'),
  validateId,
  validateBody(z.object({ reason: z.string().max(500).optional() })),
  orderController.cancelOrder
);

// Dupliquer commande
orderRoutes.post('/:id/duplicate',
  authorize('admin', 'manager'),
  validateId,
  validateBody(schemas.order.duplicate),
  orderController.duplicateOrder
);

router.use('/orders', orderRoutes);

// ═══════════════════════════════════════════════════════════════════════════════
// LIVRAISONS
// ═══════════════════════════════════════════════════════════════════════════════

const deliveryRoutes = Router();
deliveryRoutes.use(authenticate);

// Liste livraisons
deliveryRoutes.get('/',
  authorize('admin', 'manager'),
  validateQuery(schemas.delivery.query),
  deliveryController.listDeliveries
);

// Ma tournée (livreur)
deliveryRoutes.get('/my-route',
  authorize('deliverer'),
  validateQuery(schemas.delivery.myRoute),
  deliveryController.getDelivererRoute
);

// Assigner livraisons
deliveryRoutes.post('/assign',
  authorize('admin', 'manager'),
  validateBody(schemas.delivery.assign),
  deliveryController.assignDeliveries
);

// Optimiser tournée
deliveryRoutes.put('/optimize',
  authorize('admin', 'manager'),
  validateBody(schemas.delivery.optimize),
  deliveryController.optimizeRoute
);

// Détail livraison
deliveryRoutes.get('/:id',
  validateId,
  deliveryController.getDeliveryById
);

// Changer statut
deliveryRoutes.put('/:id/status',
  authorize('deliverer'),
  validateId,
  validateBody(schemas.delivery.updateStatus),
  deliveryController.updateDeliveryStatus
);

// Compléter livraison
deliveryRoutes.put('/:id/complete',
  authorize('deliverer'),
  validateId,
  validateBody(schemas.delivery.complete),
  deliveryController.completeDelivery
);

// Échec livraison
deliveryRoutes.put('/:id/fail',
  authorize('deliverer'),
  validateId,
  validateBody(schemas.delivery.fail),
  deliveryController.failDelivery
);

// Collecter dette (sans commande)
deliveryRoutes.post('/collect-debt',
  authorize('deliverer'),
  validateBody(schemas.delivery.collectDebt),
  deliveryController.collectDebt
);

router.use('/deliveries', deliveryRoutes);

// ═══════════════════════════════════════════════════════════════════════════════
// PAIEMENTS
// ═══════════════════════════════════════════════════════════════════════════════

const paymentRoutes = Router();
paymentRoutes.use(authenticate);

// Liste paiements
paymentRoutes.get('/',
  authorize('admin', 'manager'),
  validateQuery(schemas.payment.query),
  paymentController.list
);

// Enregistrer paiement (admin)
paymentRoutes.post('/',
  authorize('admin', 'manager'),
  validateBody(schemas.payment.create),
  paymentController.create
);

// Détail paiement
paymentRoutes.get('/:id',
  validateId,
  paymentController.getById
);

router.use('/payments', paymentRoutes);

// ═══════════════════════════════════════════════════════════════════════════════
// CAISSE JOURNALIÈRE
// ═══════════════════════════════════════════════════════════════════════════════

const dailyCashRoutes = Router();
dailyCashRoutes.use(authenticate);

// Ma caisse du jour (livreur)
dailyCashRoutes.get('/today',
  authorize('deliverer'),
  dailyCashController.getMyDailyCash
);

// Historique ma caisse
dailyCashRoutes.get('/my-history',
  authorize('deliverer'),
  validateQuery(schemas.dailyCash.query),
  dailyCashController.getDailyCashHistory
);

// Liste caisses (admin)
dailyCashRoutes.get('/',
  authorize('admin', 'manager'),
  validateQuery(schemas.dailyCash.query),
  dailyCashController.getAllDailyCash
);

// Clôturer journée
dailyCashRoutes.post('/close',
  authorize('deliverer'),
  validateBody(schemas.dailyCash.close),
  dailyCashController.closeDailyCash
);

// Valider clôture (admin)
dailyCashRoutes.put('/:id/validate',
  authorize('admin', 'manager'),
  validateId,
  dailyCashController.confirmRemittance
);

router.use('/daily-cash', dailyCashRoutes);

// ═══════════════════════════════════════════════════════════════════════════════
// FINANCE
// ═══════════════════════════════════════════════════════════════════════════════

const financeRoutes = Router();
financeRoutes.use(authenticate, authorize('admin', 'manager'));

// Vue d'ensemble
financeRoutes.get('/overview',
  validateQuery(schemas.finance.overview),
  financeController.overview
);

// Liste des dettes
financeRoutes.get('/debts',
  validateQuery(schemas.finance.debts),
  financeController.debts
);

// Aging report
financeRoutes.get('/aging-report',
  validateQuery(schemas.finance.agingReport),
  financeController.agingReport
);

// Résumé journalier
financeRoutes.get('/daily-summary',
  validateQuery(schemas.finance.dailySummary),
  financeController.dailySummary
);

// Réconciliation
financeRoutes.get('/reconciliation',
  validateQuery(schemas.dateRange),
  financeController.reconciliation
);

// Cash flow
financeRoutes.get('/cash-flow',
  validateQuery(schemas.dateRange),
  financeController.getCashFlow
);

router.use('/finance', financeRoutes);

// ═══════════════════════════════════════════════════════════════════════════════
// RAPPORTS
// ═══════════════════════════════════════════════════════════════════════════════

const reportRoutes = Router();
reportRoutes.use(authenticate, authorize('admin', 'manager'));

// Rapport journalier
reportRoutes.get('/daily',
  validateQuery(schemas.report.daily),
  reportController.generateDailyReport
);

// Rapport hebdomadaire
reportRoutes.get('/weekly',
  validateQuery(schemas.report.weekly),
  reportController.generateWeeklyReport
);

// Rapport mensuel
reportRoutes.get('/monthly',
  validateQuery(schemas.report.monthly),
  reportController.generateMonthlyReport
);

// Performance livreur
reportRoutes.get('/deliverer/:id',
  validateParams(z.object({ id: z.string().uuid() })),
  validateQuery(schemas.dateRange),
  reportController.generateDelivererPerformanceReport
);

// Relevé client
reportRoutes.get('/customer/:id',
  validateParams(z.object({ id: z.string().uuid() })),
  validateQuery(schemas.dateRange),
  reportController.generateCustomerStatement
);

// Export
reportRoutes.get('/export',
  validateQuery(schemas.report.export),
  reportController.exportReport
);

router.use('/reports', reportRoutes);

// ═══════════════════════════════════════════════════════════════════════════════
// SYNCHRONISATION (Mobile offline)
// ═══════════════════════════════════════════════════════════════════════════════

const syncRoutes = Router();
syncRoutes.use(authenticate, authorize('deliverer'));

// Données initiales
syncRoutes.get('/initial',
  validateQuery(schemas.sync.initial),
  syncController.getInitialDownload
);

// Push transactions offline
syncRoutes.post('/push',
  validateBody(schemas.sync.push),
  syncController.pushTransactions
);

// Pull mises à jour
syncRoutes.get('/pull',
  validateQuery(schemas.sync.pull),
  syncController.pullUpdates
);

// Statut sync
syncRoutes.get('/status',
  syncController.getSyncStatus
);

router.use('/sync', syncRoutes);

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

const notificationRoutes = Router();
notificationRoutes.use(authenticate);

// Mes notifications
notificationRoutes.get('/',
  validateQuery(schemas.notification.query),
  notificationController.list
);

// Marquer comme lue
notificationRoutes.put('/:id/read',
  validateId,
  notificationController.markRead
);

// Tout marquer comme lu
notificationRoutes.put('/read-all',
  notificationController.markAllRead
);

// Enregistrer push token
notificationRoutes.post('/register-token',
  validateBody(schemas.notification.registerToken),
  notificationController.registerToken
);

router.use('/notifications', notificationRoutes);

// ═══════════════════════════════════════════════════════════════════════════════
// IMPRESSION
// ═══════════════════════════════════════════════════════════════════════════════

const printRoutes = Router();
printRoutes.use(authenticate);

// Bon de livraison
printRoutes.get('/delivery/:id',
  validateId,
  validateQuery(schemas.print.delivery),
  printController.delivery
);

// Reçu de paiement
printRoutes.get('/receipt/:id',
  validateId,
  validateQuery(schemas.print.receipt),
  printController.receipt
);

// Relevé client
printRoutes.get('/statement/:id',
  validateId,
  validateQuery(schemas.print.statement.omit({ customerId: true })),
  printController.statement
);

// Bon de livraison (thermal printer format)
printRoutes.get('/delivery/:id/thermal',
  validateId,
  printController.generateDeliveryNotePDF
);

// Reçu thermal
printRoutes.get('/receipt/:id/thermal',
  validateId,
  printController.generateReceiptPDF
);

router.use('/print', printRoutes);

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES CLIENT MOBILE (App Client)
// ═══════════════════════════════════════════════════════════════════════════════

const customerAppRoutes = Router();

// Ces routes nécessitent authentification client
customerAppRoutes.use(authenticate, authorize('customer'));

// Profil
customerAppRoutes.get('/profile', customerController.getProfile);
customerAppRoutes.get('/statement', customerController.getStatement);

// Catalogue
customerAppRoutes.get('/categories', customerController.getCategories);
customerAppRoutes.get('/products', customerController.getProducts);
customerAppRoutes.get('/products/:id', customerController.getProduct);

// Commandes
customerAppRoutes.post('/orders', 
  validateBody(schemas.order.createByCustomer),
  customerController.createOrder
);
customerAppRoutes.get('/orders', customerController.getOrders);
customerAppRoutes.get('/orders/:id', validateId, customerController.getOrder);
customerAppRoutes.post('/orders/:id/cancel',
  validateId,
  validateBody(z.object({ reason: z.string().max(500).optional() })),
  customerController.cancelOrder
);

// Notifications
customerAppRoutes.get('/notifications', customerController.getNotifications);
customerAppRoutes.patch('/notifications/:id/read', validateId, customerController.markNotificationRead);
customerAppRoutes.patch('/notifications/read-all', customerController.markAllNotificationsRead);

router.use('/customer', customerAppRoutes);

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '3.0.0',
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export default router;
