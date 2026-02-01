// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - VALIDATEURS CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

import { body, query, param } from 'express-validator';

export const customerValidators = {
  // ───────────────────────────────────────────────────────────────────────────
  // AUTH
  // ───────────────────────────────────────────────────────────────────────────

  requestOtp: [
    body('phone')
      .notEmpty()
      .withMessage('Le numéro de téléphone est requis')
      .matches(/^(0|\\+213)[5-7][0-9]{8}$/)
      .withMessage('Numéro de téléphone algérien invalide')
      .trim(),
  ],

  verifyOtp: [
    body('phone')
      .notEmpty()
      .withMessage('Le numéro de téléphone est requis')
      .matches(/^(0|\\+213)[5-7][0-9]{8}$/)
      .withMessage('Numéro de téléphone algérien invalide')
      .trim(),
    body('otp')
      .notEmpty()
      .withMessage('Le code OTP est requis')
      .isLength({ min: 6, max: 6 })
      .withMessage('Le code OTP doit contenir 6 chiffres')
      .isNumeric()
      .withMessage('Le code OTP doit être numérique'),
    body('deviceId')
      .optional()
      .isString()
      .withMessage('L\'identifiant de l\'appareil doit être une chaîne'),
  ],

  // ───────────────────────────────────────────────────────────────────────────
  // PROFIL
  // ───────────────────────────────────────────────────────────────────────────

  getStatement: [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Date de début invalide'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('Date de fin invalide'),
  ],

  // ───────────────────────────────────────────────────────────────────────────
  // PRODUITS
  // ───────────────────────────────────────────────────────────────────────────

  listProducts: [
    query('categoryId')
      .optional()
      .isUUID()
      .withMessage('ID de catégorie invalide'),
    query('search')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('La recherche doit contenir entre 2 et 100 caractères'),
    query('featured')
      .optional()
      .isBoolean()
      .withMessage('Le paramètre featured doit être un booléen'),
  ],

  // ───────────────────────────────────────────────────────────────────────────
  // COMMANDES
  // ───────────────────────────────────────────────────────────────────────────

  createOrder: [
    body('items')
      .isArray({ min: 1 })
      .withMessage('Au moins un article est requis'),
    body('items.*.productId')
      .notEmpty()
      .withMessage('L\'ID du produit est requis pour chaque article')
      .isUUID()
      .withMessage('ID de produit invalide'),
    body('items.*.quantity')
      .notEmpty()
      .withMessage('La quantité est requise pour chaque article')
      .isFloat({ min: 0.01 })
      .withMessage('La quantité doit être supérieure à 0'),
    body('items.*.notes')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Les notes ne peuvent pas dépasser 500 caractères'),
    body('deliveryDate')
      .optional()
      .isISO8601()
      .withMessage('Date de livraison invalide'),
    body('deliveryTimeSlot')
      .optional()
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]-([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Créneau horaire invalide (format: HH:MM-HH:MM)'),
    body('deliveryAddress')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 500 })
      .withMessage('L\'adresse ne peut pas dépasser 500 caractères'),
    body('deliveryNotes')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Les notes ne peuvent pas dépasser 1000 caractères'),
    body('notes')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Les notes ne peuvent pas dépasser 1000 caractères'),
  ],

  listOrders: [
    query('status')
      .optional()
      .isIn([
        'draft',
        'pending',
        'confirmed',
        'preparing',
        'ready',
        'assigned',
        'inDelivery',
        'delivered',
        'cancelled',
      ])
      .withMessage('Statut de commande invalide'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('La page doit être un entier positif'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('La limite doit être entre 1 et 100'),
  ],

  cancelOrder: [
    param('id')
      .isUUID()
      .withMessage('ID de commande invalide'),
    body('reason')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 500 })
      .withMessage('La raison ne peut pas dépasser 500 caractères'),
  ],

  // ───────────────────────────────────────────────────────────────────────────
  // NOTIFICATIONS
  // ───────────────────────────────────────────────────────────────────────────

  listNotifications: [
    query('unreadOnly')
      .optional()
      .isBoolean()
      .withMessage('Le paramètre unreadOnly doit être un booléen'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('La page doit être un entier positif'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('La limite doit être entre 1 et 100'),
  ],
};
