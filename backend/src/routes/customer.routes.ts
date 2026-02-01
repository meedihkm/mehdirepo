// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - ROUTES CLIENT
// Routes pour l'application mobile client
// ═══════════════════════════════════════════════════════════════════════════════

import { Router } from 'express';
import { authenticate, requireCustomer } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { customerController } from '../controllers/customer.controller';
import { customerValidators } from '../validators/customer.validator';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHENTIFICATION CLIENT (OTP)
// ═══════════════════════════════════════════════════════════════════════════════

// Demander un code OTP
router.post(
  '/auth/otp/request',
  validate(customerValidators.requestOtp),
  customerController.requestOtp
);

// Vérifier le code OTP
router.post(
  '/auth/otp/verify',
  validate(customerValidators.verifyOtp),
  customerController.verifyOtp
);

// ═══════════════════════════════════════════════════════════════════════════════
// PROFIL CLIENT (Protégé)
// ═══════════════════════════════════════════════════════════════════════════════

router.use(authenticate, requireCustomer);

// Profil
router.get('/customers/me', customerController.getProfile);

// Relevé de compte
router.get(
  '/customers/me/statement',
  validate(customerValidators.getStatement),
  customerController.getStatement
);

// ═══════════════════════════════════════════════════════════════════════════════
// CATÉGORIES (Protégé)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/categories', customerController.getCategories);

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUITS (Protégé)
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  '/products',
  validate(customerValidators.listProducts),
  customerController.getProducts
);

router.get('/products/:id', customerController.getProduct);

// ═══════════════════════════════════════════════════════════════════════════════
// COMMANDES (Protégé)
// ═══════════════════════════════════════════════════════════════════════════════

router.post(
  '/orders',
  validate(customerValidators.createOrder),
  customerController.createOrder
);

router.get(
  '/orders',
  validate(customerValidators.listOrders),
  customerController.getOrders
);

router.get('/orders/:id', customerController.getOrder);

router.post(
  '/orders/:id/cancel',
  validate(customerValidators.cancelOrder),
  customerController.cancelOrder
);

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS (Protégé)
// ═══════════════════════════════════════════════════════════════════════════════

router.get(
  '/notifications',
  validate(customerValidators.listNotifications),
  customerController.getNotifications
);

router.patch('/notifications/:id/read', customerController.markNotificationRead);

router.patch('/notifications/read-all', customerController.markAllNotificationsRead);

export default router;
