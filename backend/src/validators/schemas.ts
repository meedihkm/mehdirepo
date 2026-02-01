// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - SCHÉMAS DE VALIDATION ZOD
// Validation TypeScript avec inférence de types automatique
// ═══════════════════════════════════════════════════════════════════════════════

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// PRIMITIVES RÉUTILISABLES
// ═══════════════════════════════════════════════════════════════════════════════

export const primitives = {
  uuid: z.string().uuid('ID invalide'),
  
  phone: z.string()
    .regex(/^(0|\+213)[567][0-9]{8}$/, 'Numéro de téléphone algérien invalide'),
  
  email: z.string().email('Email invalide').toLowerCase(),
  
  password: z.string()
    .min(8, 'Mot de passe: 8 caractères minimum')
    .regex(/[A-Z]/, 'Mot de passe: au moins une majuscule')
    .regex(/[0-9]/, 'Mot de passe: au moins un chiffre'),
  
  pin: z.string()
    .regex(/^[0-9]{4,6}$/, 'PIN: 4 à 6 chiffres'),
  
  money: z.number()
    .nonnegative('Montant ne peut pas être négatif')
    .multipleOf(0.01, 'Maximum 2 décimales'),
  
  quantity: z.number()
    .positive('Quantité doit être positive')
    .multipleOf(0.01),
  
  percentage: z.number()
    .min(0, 'Pourcentage minimum: 0')
    .max(100, 'Pourcentage maximum: 100'),
  
  coordinates: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  
  dateString: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date: YYYY-MM-DD'),
  
  timeString: z.string().regex(/^\d{2}:\d{2}$/, 'Format heure: HH:MM'),
};

// ═══════════════════════════════════════════════════════════════════════════════
// PAGINATION & FILTRES
// ═══════════════════════════════════════════════════════════════════════════════

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const dateRangeSchema = z.object({
  startDate: primitives.dateString.optional(),
  endDate: primitives.dateString.optional(),
}).refine(
  data => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  { message: 'La date de début doit être avant la date de fin' }
);

export type Pagination = z.infer<typeof paginationSchema>;
export type DateRange = z.infer<typeof dateRangeSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHENTIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

export const authSchemas = {
  // Login Admin/Livreur
  login: z.object({
    email: primitives.email,
    password: z.string().min(1, 'Mot de passe requis'),
    deviceId: z.string().optional(),
  }),

  // Login Client (par téléphone + OTP)
  customerLoginRequest: z.object({
    phone: primitives.phone,
  }),

  customerLoginVerify: z.object({
    phone: primitives.phone,
    otp: z.string().length(6, 'Code OTP: 6 chiffres'),
    deviceId: z.string().optional(),
  }),

  // Refresh token
  refreshToken: z.object({
    refreshToken: z.string().min(1, 'Token requis'),
  }),

  // Changement mot de passe
  changePassword: z.object({
    currentPassword: z.string().min(1),
    newPassword: primitives.password,
    confirmPassword: z.string(),
  }).refine(
    data => data.newPassword === data.confirmPassword,
    { message: 'Les mots de passe ne correspondent pas', path: ['confirmPassword'] }
  ),

  // Reset password
  resetPasswordRequest: z.object({
    email: primitives.email,
  }),

  resetPassword: z.object({
    token: z.string().min(1),
    newPassword: primitives.password,
    confirmPassword: z.string(),
  }).refine(
    data => data.newPassword === data.confirmPassword,
    { message: 'Les mots de passe ne correspondent pas', path: ['confirmPassword'] }
  ),
};

export type LoginInput = z.infer<typeof authSchemas.login>;
export type CustomerLoginRequest = z.infer<typeof authSchemas.customerLoginRequest>;
export type CustomerLoginVerify = z.infer<typeof authSchemas.customerLoginVerify>;
export type ChangePasswordInput = z.infer<typeof authSchemas.changePassword>;

// ═══════════════════════════════════════════════════════════════════════════════
// ORGANISATION
// ═══════════════════════════════════════════════════════════════════════════════

export const organizationSchemas = {
  update: z.object({
    name: z.string().min(2).max(100).optional(),
    legalName: z.string().max(150).optional(),
    address: z.string().max(500).optional(),
    city: z.string().max(50).optional(),
    wilaya: z.string().max(50).optional(),
    phone: primitives.phone.optional(),
    email: primitives.email.optional(),
    logoUrl: z.string().url().optional(),
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  }),

  updateSettings: z.object({
    defaultCreditLimit: primitives.money.optional(),
    defaultPaymentDelayDays: z.number().int().min(0).max(365).optional(),
    debtAlertDays: z.number().int().min(1).max(365).optional(),
    
    features: z.object({
      signatureRequired: z.boolean().optional(),
      photoRequired: z.boolean().optional(),
      qrCodeEnabled: z.boolean().optional(),
      bluetoothPrinting: z.boolean().optional(),
      pushNotifications: z.boolean().optional(),
      smsNotifications: z.boolean().optional(),
      recurringOrders: z.boolean().optional(),
      customPricing: z.boolean().optional(),
    }).optional(),

    printSettings: z.object({
      printerType: z.enum(['58mm', '80mm']).optional(),
      autoPrintDelivery: z.boolean().optional(),
      autoPrintReceipt: z.boolean().optional(),
      showDebtOnReceipt: z.boolean().optional(),
      headerLine1: z.string().max(40).optional(),
      headerLine2: z.string().max(40).optional(),
      footerText: z.string().max(100).optional(),
    }).optional(),

    adminNotifications: z.object({
      creditLimitReached: z.boolean().optional(),
      debtOverLimit: z.boolean().optional(),
      largePaymentThreshold: primitives.money.optional(),
      dailySummaryTime: primitives.timeString.optional(),
      dailySummaryEnabled: z.boolean().optional(),
    }).optional(),
  }),
};

export type UpdateOrganizationInput = z.infer<typeof organizationSchemas.update>;
export type UpdateSettingsInput = z.infer<typeof organizationSchemas.updateSettings>;

// ═══════════════════════════════════════════════════════════════════════════════
// UTILISATEURS (Admin, Livreurs, etc.)
// ═══════════════════════════════════════════════════════════════════════════════

export const userRole = z.enum(['admin', 'manager', 'deliverer', 'kitchen']);
export type UserRole = z.infer<typeof userRole>;

export const userSchemas = {
  create: z.object({
    email: primitives.email,
    password: primitives.password,
    name: z.string().min(2).max(100),
    phone: primitives.phone.optional(),
    role: userRole,
    vehicleType: z.enum(['car', 'motorcycle', 'bicycle', 'foot']).optional(),
    licensePlate: z.string().max(20).optional(),
  }).refine(
    data => {
      if (data.role === 'deliverer') {
        return !!data.phone;
      }
      return true;
    },
    { message: 'Téléphone requis pour les livreurs', path: ['phone'] }
  ),

  update: z.object({
    email: primitives.email.optional(),
    name: z.string().min(2).max(100).optional(),
    phone: primitives.phone.optional(),
    role: userRole.optional(),
    vehicleType: z.enum(['car', 'motorcycle', 'bicycle', 'foot']).optional(),
    licensePlate: z.string().max(20).optional(),
    isActive: z.boolean().optional(),
  }),

  query: paginationSchema.extend({
    role: userRole.optional(),
    isActive: z.coerce.boolean().optional(),
    search: z.string().max(100).optional(),
  }),

  updatePosition: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracy: z.number().positive().optional(),
  }),
};

export type CreateUserInput = z.infer<typeof userSchemas.create>;
export type UpdateUserInput = z.infer<typeof userSchemas.update>;
export type UserQuery = z.infer<typeof userSchemas.query>;

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENTS
// ═══════════════════════════════════════════════════════════════════════════════

export const customerSchemas = {
  create: z.object({
    code: z.string().max(20).optional(),
    name: z.string().min(2).max(100),
    contactName: z.string().max(100).optional(),
    phone: primitives.phone,
    phoneSecondary: primitives.phone.optional(),
    email: primitives.email.optional(),
    
    address: z.string().min(5).max(500),
    city: z.string().max(50).optional(),
    wilaya: z.string().max(50).optional(),
    zone: z.string().max(50).optional(),
    coordinates: primitives.coordinates.optional(),
    
    creditLimit: primitives.money.optional(),
    creditLimitEnabled: z.boolean().default(true),
    paymentDelayDays: z.number().int().min(0).max(365).optional(),
    
    discountPercent: primitives.percentage.optional(),
    customPrices: z.record(z.string().uuid(), primitives.money).optional(),
    
    preferredDeliveryTime: z.enum(['morning', 'afternoon', 'evening']).optional(),
    deliveryNotes: z.string().max(500).optional(),
    notes: z.string().max(1000).optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
  }),

  update: z.object({
    code: z.string().max(20).optional(),
    name: z.string().min(2).max(100).optional(),
    contactName: z.string().max(100).optional(),
    phone: primitives.phone.optional(),
    phoneSecondary: primitives.phone.optional(),
    email: primitives.email.optional(),
    
    address: z.string().min(5).max(500).optional(),
    city: z.string().max(50).optional(),
    wilaya: z.string().max(50).optional(),
    zone: z.string().max(50).optional(),
    coordinates: primitives.coordinates.optional(),
    
    creditLimit: primitives.money.optional(),
    creditLimitEnabled: z.boolean().optional(),
    paymentDelayDays: z.number().int().min(0).max(365).optional(),
    
    discountPercent: primitives.percentage.optional(),
    customPrices: z.record(z.string().uuid(), primitives.money).optional(),
    
    preferredDeliveryTime: z.enum(['morning', 'afternoon', 'evening']).optional(),
    deliveryNotes: z.string().max(500).optional(),
    notes: z.string().max(1000).optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
    
    isActive: z.boolean().optional(),
  }),

  query: paginationSchema.merge(dateRangeSchema).extend({
    search: z.string().max(100).optional(),
    zone: z.string().max(50).optional(),
    hasDebt: z.coerce.boolean().optional(),
    minDebt: z.coerce.number().optional(),
    maxDebt: z.coerce.number().optional(),
    tags: z.string().optional(), // Comma-separated
    isActive: z.coerce.boolean().optional(),
  }),

  updateCreditLimit: z.object({
    creditLimit: primitives.money,
    creditLimitEnabled: z.boolean().optional(),
  }),
};

export type CreateCustomerInput = z.infer<typeof customerSchemas.create>;
export type UpdateCustomerInput = z.infer<typeof customerSchemas.update>;
export type CustomerQuery = z.infer<typeof customerSchemas.query>;

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUITS
// ═══════════════════════════════════════════════════════════════════════════════

export const productSchemas = {
  create: z.object({
    name: z.string().min(2).max(100),
    description: z.string().max(500).optional(),
    categoryId: primitives.uuid.optional(),
    
    price: primitives.money.positive('Prix requis'),
    unit: z.string().max(20).default('pièce'),
    unitQuantity: primitives.quantity.default(1),
    
    sku: z.string().max(50).optional(),
    barcode: z.string().max(50).optional(),
    imageUrl: z.string().url().optional(),
    
    trackStock: z.boolean().default(false),
    currentStock: primitives.quantity.optional(),
    minStockAlert: primitives.quantity.optional(),
    
    isAvailable: z.boolean().default(true),
    sortOrder: z.number().int().min(0).default(0),
    isFeatured: z.boolean().default(false),
  }),

  update: z.object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().max(500).optional(),
    categoryId: primitives.uuid.nullable().optional(),
    
    price: primitives.money.positive().optional(),
    unit: z.string().max(20).optional(),
    unitQuantity: primitives.quantity.optional(),
    
    sku: z.string().max(50).optional(),
    barcode: z.string().max(50).optional(),
    imageUrl: z.string().url().nullable().optional(),
    
    trackStock: z.boolean().optional(),
    currentStock: primitives.quantity.optional(),
    minStockAlert: primitives.quantity.optional(),
    
    isAvailable: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    isFeatured: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }),

  query: paginationSchema.extend({
    search: z.string().max(100).optional(),
    categoryId: primitives.uuid.optional(),
    isAvailable: z.coerce.boolean().optional(),
    isFeatured: z.coerce.boolean().optional(),
    minPrice: z.coerce.number().optional(),
    maxPrice: z.coerce.number().optional(),
  }),

  reorder: z.object({
    products: z.array(z.object({
      id: primitives.uuid,
      sortOrder: z.number().int().min(0),
    })).min(1),
  }),
};

export type CreateProductInput = z.infer<typeof productSchemas.create>;
export type UpdateProductInput = z.infer<typeof productSchemas.update>;
export type ProductQuery = z.infer<typeof productSchemas.query>;

// ═══════════════════════════════════════════════════════════════════════════════
// CATÉGORIES
// ═══════════════════════════════════════════════════════════════════════════════

export const categorySchemas = {
  create: z.object({
    name: z.string().min(2).max(50),
    slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug: lettres minuscules, chiffres et tirets'),
    icon: z.string().max(50).optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    sortOrder: z.number().int().min(0).default(0),
  }),

  update: z.object({
    name: z.string().min(2).max(50).optional(),
    slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/).optional(),
    icon: z.string().max(50).optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  }),
};

export type CreateCategoryInput = z.infer<typeof categorySchemas.create>;
export type UpdateCategoryInput = z.infer<typeof categorySchemas.update>;

// ═══════════════════════════════════════════════════════════════════════════════
// COMMANDES
// ═══════════════════════════════════════════════════════════════════════════════

export const orderStatus = z.enum([
  'draft', 'pending', 'confirmed', 'preparing', 'ready', 
  'assigned', 'in_delivery', 'delivered', 'cancelled'
]);

export const paymentStatus = z.enum(['unpaid', 'partial', 'paid']);

export const orderSchemas = {
  // Création par Admin
  create: z.object({
    customerId: primitives.uuid,
    items: z.array(z.object({
      productId: primitives.uuid,
      quantity: primitives.quantity,
      unitPrice: primitives.money.optional(), // Si prix personnalisé
      notes: z.string().max(200).optional(),
    })).min(1, 'Au moins un article requis'),
    
    deliveryDate: primitives.dateString.optional(),
    deliveryTimeSlot: z.enum(['morning', 'afternoon', 'evening']).optional(),
    deliveryAddress: z.string().max(500).optional(), // Si différent du client
    deliveryNotes: z.string().max(500).optional(),
    
    discountPercent: primitives.percentage.optional(),
    discountAmount: primitives.money.optional(),
    
    notes: z.string().max(1000).optional(),
  }),

  // Création par Client App (simplifié)
  createByCustomer: z.object({
    items: z.array(z.object({
      productId: primitives.uuid,
      quantity: primitives.quantity,
    })).min(1),
    
    deliveryDate: primitives.dateString.optional(),
    deliveryTimeSlot: z.enum(['morning', 'afternoon', 'evening']).optional(),
    notes: z.string().max(500).optional(),
  }),

  update: z.object({
    items: z.array(z.object({
      productId: primitives.uuid,
      quantity: primitives.quantity,
      unitPrice: primitives.money.optional(),
      notes: z.string().max(200).optional(),
    })).min(1).optional(),
    
    deliveryDate: primitives.dateString.optional(),
    deliveryTimeSlot: z.enum(['morning', 'afternoon', 'evening']).optional(),
    deliveryAddress: z.string().max(500).optional(),
    deliveryNotes: z.string().max(500).optional(),
    
    discountPercent: primitives.percentage.optional(),
    discountAmount: primitives.money.optional(),
    
    notes: z.string().max(1000).optional(),
  }),

  updateStatus: z.object({
    status: orderStatus,
    reason: z.string().max(500).optional(), // Pour annulation
  }),

  query: paginationSchema.merge(dateRangeSchema).extend({
    customerId: primitives.uuid.optional(),
    status: orderStatus.optional(),
    statuses: z.string().optional(), // Comma-separated
    paymentStatus: paymentStatus.optional(),
    deliveryDate: primitives.dateString.optional(),
    delivererId: primitives.uuid.optional(),
    search: z.string().max(100).optional(), // Numéro commande ou nom client
    minTotal: z.coerce.number().optional(),
    maxTotal: z.coerce.number().optional(),
  }),

  duplicate: z.object({
    deliveryDate: primitives.dateString.optional(),
  }),
};

export type OrderStatus = z.infer<typeof orderStatus>;
export type PaymentStatus = z.infer<typeof paymentStatus>;
export type CreateOrderInput = z.infer<typeof orderSchemas.create>;
export type CreateOrderByCustomerInput = z.infer<typeof orderSchemas.createByCustomer>;
export type UpdateOrderInput = z.infer<typeof orderSchemas.update>;
export type OrderQuery = z.infer<typeof orderSchemas.query>;

// ═══════════════════════════════════════════════════════════════════════════════
// LIVRAISONS
// ═══════════════════════════════════════════════════════════════════════════════

export const deliveryStatus = z.enum([
  'pending', 'assigned', 'picked_up', 'in_transit', 
  'arrived', 'delivered', 'failed', 'returned'
]);

export const deliverySchemas = {
  assign: z.object({
    orderIds: z.array(primitives.uuid).min(1),
    delivererId: primitives.uuid,
    scheduledDate: primitives.dateString,
    scheduledTime: primitives.timeString.optional(),
  }),

  updateStatus: z.object({
    status: deliveryStatus,
    location: primitives.coordinates.optional(),
    notes: z.string().max(500).optional(),
  }),

  complete: z.object({
    amountCollected: primitives.money,
    collectionMode: z.enum(['cash', 'check', 'bank_transfer']).default('cash'),
    notes: z.string().max(500).optional(),
    
    // Preuve de livraison (optionnel)
    signature: z.object({
      data: z.string().max(50000), // Base64 SVG
      name: z.string().max(100),
    }).optional(),
    
    photos: z.array(z.object({
      data: z.string(), // Base64
      type: z.enum(['product', 'location', 'receipt']),
    })).max(5).optional(),
    
    location: primitives.coordinates.optional(),
  }),

  fail: z.object({
    reason: z.string().min(5).max(500),
    location: primitives.coordinates.optional(),
  }),

  // Collecter dette sans livraison
  collectDebt: z.object({
    customerId: primitives.uuid,
    amount: primitives.money.positive(),
    collectionMode: z.enum(['cash', 'check', 'bank_transfer']).default('cash'),
    notes: z.string().max(500).optional(),
  }),

  query: paginationSchema.merge(dateRangeSchema).extend({
    delivererId: primitives.uuid.optional(),
    status: deliveryStatus.optional(),
    statuses: z.string().optional(),
    scheduledDate: primitives.dateString.optional(),
    customerId: primitives.uuid.optional(),
  }),

  // Tournée du jour (livreur)
  myRoute: z.object({
    date: primitives.dateString.optional(), // Défaut: aujourd'hui
  }),

  optimize: z.object({
    deliveryIds: z.array(primitives.uuid).min(2),
    startLocation: primitives.coordinates.optional(),
  }),
};

export type DeliveryStatus = z.infer<typeof deliveryStatus>;
export type AssignDeliveryInput = z.infer<typeof deliverySchemas.assign>;
export type CompleteDeliveryInput = z.infer<typeof deliverySchemas.complete>;
export type FailDeliveryInput = z.infer<typeof deliverySchemas.fail>;
export type CollectDebtInput = z.infer<typeof deliverySchemas.collectDebt>;
export type DeliveryQuery = z.infer<typeof deliverySchemas.query>;

// ═══════════════════════════════════════════════════════════════════════════════
// PAIEMENTS
// ═══════════════════════════════════════════════════════════════════════════════

export const paymentMode = z.enum(['cash', 'check', 'bank_transfer', 'mobile_payment']);
export const paymentType = z.enum(['order_payment', 'debt_payment', 'advance_payment', 'refund']);

export const paymentSchemas = {
  create: z.object({
    customerId: primitives.uuid,
    amount: primitives.money.positive(),
    mode: paymentMode.default('cash'),
    paymentType: paymentType.default('debt_payment'),
    
    orderId: primitives.uuid.optional(), // Si paiement spécifique à une commande
    
    // Pour chèques
    checkNumber: z.string().max(50).optional(),
    checkBank: z.string().max(100).optional(),
    checkDate: primitives.dateString.optional(),
    
    notes: z.string().max(500).optional(),
  }),

  query: paginationSchema.merge(dateRangeSchema).extend({
    customerId: primitives.uuid.optional(),
    collectedBy: primitives.uuid.optional(),
    mode: paymentMode.optional(),
    paymentType: paymentType.optional(),
    minAmount: z.coerce.number().optional(),
    maxAmount: z.coerce.number().optional(),
  }),
};

export type PaymentMode = z.infer<typeof paymentMode>;
export type PaymentType = z.infer<typeof paymentType>;
export type CreatePaymentInput = z.infer<typeof paymentSchemas.create>;
export type PaymentQuery = z.infer<typeof paymentSchemas.query>;

// ═══════════════════════════════════════════════════════════════════════════════
// CAISSE JOURNALIÈRE
// ═══════════════════════════════════════════════════════════════════════════════

export const dailyCashSchemas = {
  close: z.object({
    cashHandedOver: primitives.money,
    discrepancyNotes: z.string().max(500).optional(),
  }),

  query: paginationSchema.extend({
    delivererId: primitives.uuid.optional(),
    startDate: primitives.dateString.optional(),
    endDate: primitives.dateString.optional(),
    isClosed: z.coerce.boolean().optional(),
  }),
};

export type CloseDailyCashInput = z.infer<typeof dailyCashSchemas.close>;
export type DailyCashQuery = z.infer<typeof dailyCashSchemas.query>;

// ═══════════════════════════════════════════════════════════════════════════════
// FINANCE & RAPPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export const financeSchemas = {
  overview: dateRangeSchema,

  debts: paginationSchema.extend({
    minDays: z.coerce.number().int().min(0).optional(),
    maxDays: z.coerce.number().int().optional(),
    minAmount: z.coerce.number().optional(),
    zone: z.string().max(50).optional(),
  }),

  agingReport: z.object({
    asOfDate: primitives.dateString.optional(),
  }),

  dailySummary: z.object({
    date: primitives.dateString.optional(),
  }),
};

export const reportSchemas = {
  daily: z.object({
    date: primitives.dateString.optional(),
  }),

  weekly: z.object({
    startDate: primitives.dateString.optional(),
  }),

  monthly: z.object({
    year: z.coerce.number().int().min(2020).max(2100),
    month: z.coerce.number().int().min(1).max(12),
  }),

  delivererPerformance: z.object({
    delivererId: primitives.uuid,
    ...dateRangeSchema.shape,
  }),

  customerStatement: z.object({
    customerId: primitives.uuid,
    ...dateRangeSchema.shape,
  }),

  export: z.object({
    type: z.enum(['daily', 'weekly', 'monthly', 'customers', 'products', 'payments']),
    format: z.enum(['csv', 'xlsx', 'pdf']).default('xlsx'),
    ...dateRangeSchema.shape,
  }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// SYNCHRONISATION OFFLINE
// ═══════════════════════════════════════════════════════════════════════════════

export const syncSchemas = {
  initial: z.object({
    lastSyncAt: z.string().datetime().optional(),
  }),

  push: z.object({
    transactions: z.array(z.object({
      id: z.string(), // Local ID
      type: z.enum(['delivery_complete', 'delivery_fail', 'payment', 'position_update']),
      data: z.record(z.unknown()),
      createdAt: z.string().datetime(),
    })),
  }),

  pull: z.object({
    lastSyncAt: z.string().datetime(),
    entities: z.array(z.enum(['deliveries', 'customers', 'products'])).optional(),
  }),
};

export type SyncPushInput = z.infer<typeof syncSchemas.push>;

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const notificationSchemas = {
  registerToken: z.object({
    token: z.string().min(1),
    platform: z.enum(['ios', 'android', 'web']),
    deviceId: z.string().optional(),
  }),

  query: paginationSchema.extend({
    isRead: z.coerce.boolean().optional(),
  }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// IMPRESSION
// ═══════════════════════════════════════════════════════════════════════════════

export const printSchemas = {
  delivery: z.object({
    includeSignature: z.boolean().default(false),
    includeQrCode: z.boolean().default(true),
  }),

  receipt: z.object({
    showDebt: z.boolean().default(true),
    copies: z.number().int().min(1).max(3).default(1),
  }),

  statement: z.object({
    customerId: primitives.uuid,
    ...dateRangeSchema.shape,
    format: z.enum(['thermal', 'a4', 'pdf']).default('pdf'),
  }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT GROUPÉ
// ═══════════════════════════════════════════════════════════════════════════════

export const schemas = {
  primitives,
  pagination: paginationSchema,
  dateRange: dateRangeSchema,
  auth: authSchemas,
  organization: organizationSchemas,
  user: userSchemas,
  customer: customerSchemas,
  product: productSchemas,
  category: categorySchemas,
  order: orderSchemas,
  delivery: deliverySchemas,
  payment: paymentSchemas,
  dailyCash: dailyCashSchemas,
  finance: financeSchemas,
  report: reportSchemas,
  sync: syncSchemas,
  notification: notificationSchemas,
  print: printSchemas,
};

export default schemas;
