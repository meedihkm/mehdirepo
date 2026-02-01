// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - SCHÉMAS ZOD COMPLETS
// Validation & Types TypeScript automatiques
// ═══════════════════════════════════════════════════════════════════════════════

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// PRIMITIVES RÉUTILISABLES
// ═══════════════════════════════════════════════════════════════════════════════

export const uuid = z.string().uuid();

export const phone = z.string()
  .regex(/^(0|\+213)[567][0-9]{8}$/, 'Numéro de téléphone algérien invalide');

export const email = z.string().email('Email invalide').toLowerCase();

export const password = z.string()
  .min(8, 'Minimum 8 caractères')
  .regex(/[A-Z]/, 'Au moins une majuscule')
  .regex(/[a-z]/, 'Au moins une minuscule')
  .regex(/[0-9]/, 'Au moins un chiffre');

export const pin = z.string()
  .regex(/^[0-9]{4,6}$/, 'PIN de 4 à 6 chiffres');

export const money = z.number()
  .nonnegative('Montant positif requis')
  .multipleOf(0.01, 'Maximum 2 décimales');

export const quantity = z.number()
  .positive('Quantité positive requise');

export const percentage = z.number()
  .min(0, 'Minimum 0%')
  .max(100, 'Maximum 100%');

export const coordinates = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const pagination = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const dateRange = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
}).refine(data => data.from <= data.to, {
  message: 'La date de début doit être avant la date de fin',
});

export const sortOrder = z.enum(['asc', 'desc']).default('desc');

// ═══════════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════════

export const UserRole = z.enum(['admin', 'manager', 'deliverer', 'kitchen']);
export type UserRole = z.infer<typeof UserRole>;

export const OrderStatus = z.enum([
  'draft',
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'assigned',
  'in_delivery',
  'delivered',
  'cancelled',
]);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const PaymentStatus = z.enum(['unpaid', 'partial', 'paid']);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const DeliveryStatus = z.enum([
  'pending',
  'assigned',
  'picked_up',
  'in_transit',
  'arrived',
  'delivered',
  'failed',
  'returned',
]);
export type DeliveryStatus = z.infer<typeof DeliveryStatus>;

export const PaymentType = z.enum([
  'order_payment',
  'debt_payment',
  'advance_payment',
  'refund',
]);
export type PaymentType = z.infer<typeof PaymentType>;

export const PaymentMode = z.enum(['cash', 'check', 'bank_transfer', 'mobile_payment']);
export type PaymentMode = z.infer<typeof PaymentMode>;

export const DeliveryTimeSlot = z.enum(['morning', 'afternoon', 'evening']);
export type DeliveryTimeSlot = z.infer<typeof DeliveryTimeSlot>;

export const VehicleType = z.enum(['car', 'motorcycle', 'bicycle', 'foot']);
export type VehicleType = z.infer<typeof VehicleType>;

// ═══════════════════════════════════════════════════════════════════════════════
// ORGANISATION
// ═══════════════════════════════════════════════════════════════════════════════

export const OrganizationFeatures = z.object({
  signature_required: z.boolean().default(false),
  photo_required: z.boolean().default(false),
  qr_code_enabled: z.boolean().default(true),
  bluetooth_printing: z.boolean().default(true),
  push_notifications: z.boolean().default(true),
  sms_notifications: z.boolean().default(false),
  recurring_orders: z.boolean().default(true),
  custom_pricing: z.boolean().default(true),
});

export const OrganizationPrintSettings = z.object({
  printer_type: z.enum(['58mm', '80mm']).default('58mm'),
  auto_print_delivery: z.boolean().default(false),
  auto_print_receipt: z.boolean().default(true),
  show_debt_on_receipt: z.boolean().default(true),
  header_line1: z.string().max(40).default(''),
  header_line2: z.string().max(40).default(''),
  footer_text: z.string().max(100).default('Merci pour votre confiance!'),
});

export const OrganizationSchema = z.object({
  id: uuid,
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  legalName: z.string().max(150).optional(),
  address: z.string().optional(),
  city: z.string().max(50).optional(),
  wilaya: z.string().max(50).optional(),
  phone: phone.optional(),
  email: email.optional(),
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#2563eb'),
  defaultCreditLimit: money.default(50000),
  defaultPaymentDelayDays: z.number().int().positive().default(30),
  debtAlertDays: z.number().int().positive().default(60),
  currency: z.string().length(3).default('DZD'),
  features: OrganizationFeatures.default({}),
  printSettings: OrganizationPrintSettings.default({}),
  timezone: z.string().default('Africa/Algiers'),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Organization = z.infer<typeof OrganizationSchema>;

export const CreateOrganizationInput = OrganizationSchema.pick({
  name: true,
  slug: true,
  legalName: true,
  address: true,
  city: true,
  wilaya: true,
  phone: true,
  email: true,
});

export const UpdateOrganizationInput = CreateOrganizationInput.partial();

export const UpdateOrganizationSettingsInput = z.object({
  defaultCreditLimit: money.optional(),
  defaultPaymentDelayDays: z.number().int().positive().optional(),
  debtAlertDays: z.number().int().positive().optional(),
  features: OrganizationFeatures.partial().optional(),
  printSettings: OrganizationPrintSettings.partial().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// UTILISATEURS
// ═══════════════════════════════════════════════════════════════════════════════

export const UserSchema = z.object({
  id: uuid,
  organizationId: uuid,
  email: email,
  name: z.string().min(2).max(100),
  phone: phone.optional(),
  avatarUrl: z.string().url().optional(),
  role: UserRole,
  permissions: z.array(z.string()).default([]),
  vehicleType: VehicleType.optional(),
  licensePlate: z.string().max(20).optional(),
  lastPosition: z.object({
    lat: z.number(),
    lng: z.number(),
    accuracy: z.number().optional(),
    updatedAt: z.date(),
  }).optional(),
  isActive: z.boolean().default(true),
  lastLoginAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;

export const CreateUserInput = z.object({
  email: email,
  password: password,
  name: z.string().min(2).max(100),
  phone: phone.optional(),
  role: UserRole,
  vehicleType: VehicleType.optional(),
  licensePlate: z.string().max(20).optional(),
});

export const UpdateUserInput = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: phone.optional(),
  role: UserRole.optional(),
  vehicleType: VehicleType.optional(),
  licensePlate: z.string().max(20).optional(),
  isActive: z.boolean().optional(),
});

export const UpdatePositionInput = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().positive().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHENTIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

export const LoginInput = z.object({
  email: email,
  password: z.string().min(1, 'Mot de passe requis'),
  deviceId: z.string().optional(),
  pushToken: z.string().optional(),
});

export const LoginResponse = z.object({
  user: UserSchema.omit({ organizationId: true }),
  organization: OrganizationSchema.pick({
    id: true,
    name: true,
    slug: true,
    logoUrl: true,
    features: true,
  }),
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});

export const RefreshTokenInput = z.object({
  refreshToken: z.string(),
});

export const ChangePasswordInput = z.object({
  currentPassword: z.string(),
  newPassword: password,
});

// Auth Client (App mobile client)
export const ClientLoginInput = z.object({
  phone: phone,
});

export const ClientVerifyOtpInput = z.object({
  phone: phone,
  otp: z.string().length(6),
  deviceId: z.string().optional(),
  pushToken: z.string().optional(),
});

export const ClientSetPinInput = z.object({
  pin: pin,
});

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENTS (Points de vente)
// ═══════════════════════════════════════════════════════════════════════════════

export const CustomerStatsSchema = z.object({
  totalOrders: z.number().default(0),
  totalRevenue: money.default(0),
  totalPaid: money.default(0),
  avgOrderValue: money.default(0),
  avgPaymentDelay: z.number().default(0),
  lastOrderAt: z.date().nullable(),
  lastPaymentAt: z.date().nullable(),
});

export const CustomerSchema = z.object({
  id: uuid,
  organizationId: uuid,
  code: z.string().max(20).optional(),
  name: z.string().min(2).max(100),
  contactName: z.string().max(100).optional(),
  phone: phone,
  phoneSecondary: phone.optional(),
  email: email.optional(),
  address: z.string().min(5),
  city: z.string().max(50).optional(),
  wilaya: z.string().max(50).optional(),
  zone: z.string().max(50).optional(),
  coordinates: coordinates.optional(),
  creditLimit: money.default(50000),
  creditLimitEnabled: z.boolean().default(true),
  currentDebt: money.default(0),
  paymentDelayDays: z.number().int().positive().default(30),
  discountPercent: percentage.default(0),
  customPrices: z.record(z.string(), money).default({}),
  stats: CustomerStatsSchema.default({}),
  preferredDeliveryTime: DeliveryTimeSlot.optional(),
  deliveryNotes: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
  tags: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Customer = z.infer<typeof CustomerSchema>;

export const CreateCustomerInput = z.object({
  code: z.string().max(20).optional(),
  name: z.string().min(2).max(100),
  contactName: z.string().max(100).optional(),
  phone: phone,
  phoneSecondary: phone.optional(),
  email: email.optional(),
  address: z.string().min(5),
  city: z.string().max(50).optional(),
  wilaya: z.string().max(50).optional(),
  zone: z.string().max(50).optional(),
  coordinates: coordinates.optional(),
  creditLimit: money.optional(),
  creditLimitEnabled: z.boolean().optional(),
  paymentDelayDays: z.number().int().positive().optional(),
  discountPercent: percentage.optional(),
  preferredDeliveryTime: DeliveryTimeSlot.optional(),
  deliveryNotes: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
  tags: z.array(z.string()).optional(),
});

export const UpdateCustomerInput = CreateCustomerInput.partial();

export const UpdateCreditLimitInput = z.object({
  creditLimit: money,
  creditLimitEnabled: z.boolean().optional(),
});

export const CustomerQueryInput = pagination.extend({
  search: z.string().optional(),
  zone: z.string().optional(),
  hasDebt: z.coerce.boolean().optional(),
  minDebt: z.coerce.number().optional(),
  isActive: z.coerce.boolean().optional(),
  sortBy: z.enum(['name', 'currentDebt', 'lastOrderAt', 'createdAt']).default('name'),
  sortOrder: sortOrder,
});

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUITS
// ═══════════════════════════════════════════════════════════════════════════════

export const ProductCategorySchema = z.object({
  id: uuid,
  organizationId: uuid,
  name: z.string().min(2).max(50),
  slug: z.string().min(2).max(50),
  icon: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
});

export type ProductCategory = z.infer<typeof ProductCategorySchema>;

export const ProductSchema = z.object({
  id: uuid,
  organizationId: uuid,
  categoryId: uuid.optional(),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  sku: z.string().max(50).optional(),
  barcode: z.string().max(50).optional(),
  price: money,
  unit: z.string().max(20).default('pièce'),
  unitQuantity: z.number().positive().default(1),
  imageUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  trackStock: z.boolean().default(false),
  currentStock: z.number().optional(),
  minStockAlert: z.number().optional(),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Product = z.infer<typeof ProductSchema>;

export const CreateProductInput = z.object({
  categoryId: uuid.optional(),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  sku: z.string().max(50).optional(),
  barcode: z.string().max(50).optional(),
  price: money,
  unit: z.string().max(20).optional(),
  unitQuantity: z.number().positive().optional(),
  trackStock: z.boolean().optional(),
  currentStock: z.number().optional(),
  minStockAlert: z.number().optional(),
  isAvailable: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

export const UpdateProductInput = CreateProductInput.partial();

export const ProductQueryInput = pagination.extend({
  search: z.string().optional(),
  categoryId: uuid.optional(),
  isAvailable: z.coerce.boolean().optional(),
  isFeatured: z.coerce.boolean().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  sortBy: z.enum(['name', 'price', 'sortOrder', 'createdAt']).default('sortOrder'),
  sortOrder: sortOrder,
});

export const ReorderProductsInput = z.object({
  items: z.array(z.object({
    id: uuid,
    sortOrder: z.number().int(),
  })),
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMMANDES
// ═══════════════════════════════════════════════════════════════════════════════

export const OrderItemSchema = z.object({
  id: uuid,
  orderId: uuid,
  productId: uuid,
  productName: z.string(),
  productSku: z.string().optional(),
  quantity: quantity,
  unitPrice: money,
  totalPrice: money,
  notes: z.string().optional(),
  createdAt: z.date(),
});

export type OrderItem = z.infer<typeof OrderItemSchema>;

export const OrderSchema = z.object({
  id: uuid,
  organizationId: uuid,
  customerId: uuid,
  orderNumber: z.string(),
  status: OrderStatus,
  subtotal: money,
  discountPercent: percentage.default(0),
  discountAmount: money.default(0),
  total: money,
  paymentStatus: PaymentStatus,
  amountPaid: money.default(0),
  amountDue: money,
  deliveryDate: z.date().optional(),
  deliveryTimeSlot: DeliveryTimeSlot.optional(),
  deliveryAddress: z.string().optional(),
  deliveryNotes: z.string().optional(),
  isRecurring: z.boolean().default(false),
  recurringConfig: z.object({
    frequency: z.enum(['daily', 'weekly']),
    daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
    endDate: z.date().optional(),
  }).optional(),
  parentOrderId: uuid.optional(),
  source: z.enum(['admin', 'client_app', 'recurring']).default('admin'),
  notes: z.string().optional(),
  confirmedAt: z.date().optional(),
  confirmedBy: uuid.optional(),
  preparedAt: z.date().optional(),
  deliveredAt: z.date().optional(),
  cancelledAt: z.date().optional(),
  cancelledBy: uuid.optional(),
  cancellationReason: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  // Relations (incluses selon les besoins)
  items: z.array(OrderItemSchema).optional(),
  customer: CustomerSchema.pick({
    id: true,
    name: true,
    phone: true,
    address: true,
    currentDebt: true,
  }).optional(),
});

export type Order = z.infer<typeof OrderSchema>;

export const OrderItemInput = z.object({
  productId: uuid,
  quantity: quantity,
  notes: z.string().max(200).optional(),
});

export const CreateOrderInput = z.object({
  customerId: uuid,
  items: z.array(OrderItemInput).min(1, 'Au moins un article requis'),
  deliveryDate: z.coerce.date().optional(),
  deliveryTimeSlot: DeliveryTimeSlot.optional(),
  deliveryAddress: z.string().optional(),
  deliveryNotes: z.string().max(500).optional(),
  discountPercent: percentage.optional(),
  notes: z.string().max(1000).optional(),
  // Récurrence
  isRecurring: z.boolean().optional(),
  recurringConfig: z.object({
    frequency: z.enum(['daily', 'weekly']),
    daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
    endDate: z.coerce.date().optional(),
  }).optional(),
});

export const UpdateOrderInput = z.object({
  items: z.array(OrderItemInput).min(1).optional(),
  deliveryDate: z.coerce.date().optional(),
  deliveryTimeSlot: DeliveryTimeSlot.optional(),
  deliveryAddress: z.string().optional(),
  deliveryNotes: z.string().max(500).optional(),
  discountPercent: percentage.optional(),
  notes: z.string().max(1000).optional(),
});

export const UpdateOrderStatusInput = z.object({
  status: OrderStatus,
  notes: z.string().optional(),
});

export const CancelOrderInput = z.object({
  reason: z.string().min(5, 'Raison requise').max(500),
});

export const OrderQueryInput = pagination.extend({
  search: z.string().optional(),
  customerId: uuid.optional(),
  status: OrderStatus.optional(),
  paymentStatus: PaymentStatus.optional(),
  deliveryDate: z.coerce.date().optional(),
  dateRange: dateRange.optional(),
  source: z.enum(['admin', 'client_app', 'recurring']).optional(),
  sortBy: z.enum(['orderNumber', 'total', 'deliveryDate', 'createdAt']).default('createdAt'),
  sortOrder: sortOrder,
});

// ═══════════════════════════════════════════════════════════════════════════════
// LIVRAISONS
// ═══════════════════════════════════════════════════════════════════════════════

export const ProofOfDeliverySchema = z.object({
  signatureData: z.string().optional(), // Base64 SVG
  signatureName: z.string().max(100).optional(),
  photos: z.array(z.object({
    url: z.string().url(),
    type: z.enum(['product', 'location', 'receipt']),
    takenAt: z.date(),
  })).default([]),
  location: coordinates.optional(),
});

export const DeliverySchema = z.object({
  id: uuid,
  organizationId: uuid,
  orderId: uuid,
  delivererId: uuid.optional(),
  status: DeliveryStatus,
  scheduledDate: z.date(),
  scheduledTime: z.string().optional(),
  sequenceNumber: z.number().int().optional(),
  priority: z.number().int().min(1).max(100).default(50),
  orderAmount: money,
  existingDebt: money.default(0),
  totalToCollect: money,
  amountCollected: money.default(0),
  collectionMode: PaymentMode.optional(),
  assignedAt: z.date().optional(),
  pickedUpAt: z.date().optional(),
  arrivedAt: z.date().optional(),
  completedAt: z.date().optional(),
  proofOfDelivery: ProofOfDeliverySchema.optional(),
  failureReason: z.string().optional(),
  estimatedDistanceKm: z.number().optional(),
  estimatedDurationMin: z.number().int().optional(),
  actualDurationMin: z.number().int().optional(),
  notes: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  // Relations
  order: OrderSchema.optional(),
  deliverer: UserSchema.pick({ id: true, name: true, phone: true }).optional(),
  customer: CustomerSchema.pick({
    id: true,
    name: true,
    phone: true,
    address: true,
    coordinates: true,
    currentDebt: true,
  }).optional(),
});

export type Delivery = z.infer<typeof DeliverySchema>;

export const AssignDeliveryInput = z.object({
  orderIds: z.array(uuid).min(1),
  delivererId: uuid,
  scheduledDate: z.coerce.date(),
  optimizeRoute: z.boolean().default(false),
});

export const UpdateDeliveryStatusInput = z.object({
  status: DeliveryStatus,
  notes: z.string().optional(),
  location: coordinates.optional(),
});

export const CompleteDeliveryInput = z.object({
  amountCollected: money,
  collectionMode: PaymentMode.default('cash'),
  notes: z.string().max(500).optional(),
  signature: z.object({
    data: z.string(),
    name: z.string().max(100),
  }).optional(),
  photos: z.array(z.object({
    data: z.string(), // Base64
    type: z.enum(['product', 'location', 'receipt']),
  })).optional(),
  location: coordinates.optional(),
});

export const FailDeliveryInput = z.object({
  reason: z.string().min(5).max(500),
  rescheduleDate: z.coerce.date().optional(),
});

export const DeliveryQueryInput = pagination.extend({
  delivererId: uuid.optional(),
  status: DeliveryStatus.optional(),
  scheduledDate: z.coerce.date().optional(),
  dateRange: dateRange.optional(),
  sortBy: z.enum(['scheduledDate', 'sequenceNumber', 'priority', 'createdAt']).default('sequenceNumber'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// Route du jour pour livreur
export const MyRouteQueryInput = z.object({
  date: z.coerce.date().optional(), // Par défaut aujourd'hui
});

export const OptimizeRouteInput = z.object({
  deliveryIds: z.array(uuid).min(2),
  startLocation: coordinates.optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAIEMENTS
// ═══════════════════════════════════════════════════════════════════════════════

export const PaymentHistorySchema = z.object({
  id: uuid,
  organizationId: uuid,
  customerId: uuid,
  amount: money,
  mode: PaymentMode,
  paymentType: PaymentType,
  deliveryId: uuid.optional(),
  orderId: uuid.optional(),
  collectedBy: uuid.optional(),
  collectedAt: z.date(),
  checkNumber: z.string().optional(),
  checkBank: z.string().optional(),
  checkDate: z.date().optional(),
  receiptNumber: z.string().optional(),
  customerDebtBefore: money,
  customerDebtAfter: money,
  appliedTo: z.array(z.object({
    orderId: uuid,
    amount: money,
  })).default([]),
  notes: z.string().optional(),
  createdAt: z.date(),
  // Relations
  customer: CustomerSchema.pick({ id: true, name: true }).optional(),
  collector: UserSchema.pick({ id: true, name: true }).optional(),
});

export type PaymentHistory = z.infer<typeof PaymentHistorySchema>;

export const CreatePaymentInput = z.object({
  customerId: uuid,
  amount: money.positive('Montant positif requis'),
  mode: PaymentMode.default('cash'),
  paymentType: PaymentType.default('debt_payment'),
  orderId: uuid.optional(),
  checkNumber: z.string().max(50).optional(),
  checkBank: z.string().max(100).optional(),
  checkDate: z.coerce.date().optional(),
  notes: z.string().max(500).optional(),
});

export const PaymentQueryInput = pagination.extend({
  customerId: uuid.optional(),
  collectedBy: uuid.optional(),
  mode: PaymentMode.optional(),
  paymentType: PaymentType.optional(),
  dateRange: dateRange.optional(),
  minAmount: z.coerce.number().optional(),
  sortBy: z.enum(['amount', 'collectedAt', 'createdAt']).default('collectedAt'),
  sortOrder: sortOrder,
});

// ═══════════════════════════════════════════════════════════════════════════════
// CAISSE JOURNALIÈRE
// ═══════════════════════════════════════════════════════════════════════════════

export const DailyCashSchema = z.object({
  id: uuid,
  organizationId: uuid,
  delivererId: uuid,
  date: z.date(),
  expectedCollection: money,
  actualCollection: money,
  newDebtCreated: money,
  deliveriesTotal: z.number().int(),
  deliveriesCompleted: z.number().int(),
  deliveriesFailed: z.number().int(),
  isClosed: z.boolean(),
  closedAt: z.date().optional(),
  closedBy: uuid.optional(),
  cashHandedOver: money.optional(),
  discrepancy: money.optional(),
  discrepancyNotes: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  // Relations
  deliverer: UserSchema.pick({ id: true, name: true }).optional(),
});

export type DailyCash = z.infer<typeof DailyCashSchema>;

export const CloseDailyCashInput = z.object({
  cashHandedOver: money,
  discrepancyNotes: z.string().max(500).optional(),
});

export const DailyCashQueryInput = pagination.extend({
  delivererId: uuid.optional(),
  dateRange: dateRange.optional(),
  isClosed: z.coerce.boolean().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// FINANCE & RAPPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export const FinanceOverviewInput = z.object({
  period: z.enum(['today', 'week', 'month', 'year']).default('month'),
  dateRange: dateRange.optional(),
});

export const FinanceOverviewResponse = z.object({
  period: z.object({
    from: z.date(),
    to: z.date(),
  }),
  revenue: z.object({
    total: money,
    collected: money,
    pending: money,
    collectionRate: percentage,
  }),
  orders: z.object({
    total: z.number().int(),
    delivered: z.number().int(),
    cancelled: z.number().int(),
    avgValue: money,
  }),
  debt: z.object({
    total: money,
    customersWithDebt: z.number().int(),
    avgDebtPerCustomer: money,
  }),
  comparison: z.object({
    revenueDiff: z.number(), // % vs période précédente
    ordersDiff: z.number(),
    debtDiff: z.number(),
  }),
});

export const AgingReportInput = z.object({
  asOfDate: z.coerce.date().optional(), // Par défaut aujourd'hui
});

export const AgingReportResponse = z.object({
  asOfDate: z.date(),
  totalDebt: money,
  buckets: z.array(z.object({
    range: z.string(), // "0-30", "31-60", "61-90", ">90"
    amount: money,
    percentage: percentage,
    customersCount: z.number().int(),
  })),
  customers: z.array(z.object({
    id: uuid,
    name: z.string(),
    totalDebt: money,
    bucket0_30: money,
    bucket31_60: money,
    bucket61_90: money,
    bucketOver90: money,
    oldestDebtDate: z.date(),
  })),
});

export const DelivererPerformanceInput = z.object({
  delivererId: uuid,
  dateRange: dateRange,
});

export const DelivererPerformanceResponse = z.object({
  deliverer: UserSchema.pick({ id: true, name: true }),
  period: z.object({ from: z.date(), to: z.date() }),
  deliveries: z.object({
    total: z.number().int(),
    completed: z.number().int(),
    failed: z.number().int(),
    successRate: percentage,
  }),
  collection: z.object({
    expected: money,
    actual: money,
    collectionRate: percentage,
    newDebt: money,
  }),
  timing: z.object({
    avgDeliveryTime: z.number(), // minutes
    onTimeRate: percentage,
  }),
});

// ═══════════════════════════════════════════════════════════════════════════════
// SYNCHRONISATION OFFLINE
// ═══════════════════════════════════════════════════════════════════════════════

export const SyncPullInput = z.object({
  lastSyncAt: z.coerce.date().optional(),
  entities: z.array(z.enum([
    'customers',
    'products',
    'orders',
    'deliveries',
  ])).optional(),
});

export const SyncPullResponse = z.object({
  syncedAt: z.date(),
  data: z.object({
    customers: z.array(CustomerSchema).optional(),
    products: z.array(ProductSchema).optional(),
    orders: z.array(OrderSchema).optional(),
    deliveries: z.array(DeliverySchema).optional(),
  }),
  deletedIds: z.object({
    customers: z.array(uuid).optional(),
    products: z.array(uuid).optional(),
    orders: z.array(uuid).optional(),
    deliveries: z.array(uuid).optional(),
  }).optional(),
});

export const SyncPushInput = z.object({
  transactions: z.array(z.object({
    id: z.string(), // ID local temporaire
    type: z.enum(['delivery_complete', 'delivery_fail', 'payment', 'position_update']),
    data: z.record(z.any()),
    timestamp: z.coerce.date(),
  })),
});

export const SyncPushResponse = z.object({
  processed: z.number().int(),
  failed: z.array(z.object({
    id: z.string(),
    error: z.string(),
  })),
  mappings: z.record(z.string(), uuid), // localId -> serverId
});

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const NotificationSchema = z.object({
  id: uuid,
  organizationId: uuid,
  userId: uuid.optional(),
  customerId: uuid.optional(),
  type: z.string(),
  title: z.string(),
  body: z.string(),
  data: z.record(z.any()).optional(),
  channel: z.enum(['push', 'sms', 'email', 'in_app']),
  isRead: z.boolean(),
  readAt: z.date().optional(),
  isSent: z.boolean(),
  sentAt: z.date().optional(),
  createdAt: z.date(),
});

export type Notification = z.infer<typeof NotificationSchema>;

export const RegisterPushTokenInput = z.object({
  token: z.string(),
  platform: z.enum(['android', 'ios', 'web']),
  deviceId: z.string().optional(),
});

export const NotificationQueryInput = pagination.extend({
  isRead: z.coerce.boolean().optional(),
  type: z.string().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// IMPRESSION
// ═══════════════════════════════════════════════════════════════════════════════

export const PrintDeliveryInput = z.object({
  deliveryId: uuid,
  format: z.enum(['thermal', 'pdf']).default('thermal'),
  includeSignature: z.boolean().default(false),
});

export const PrintReceiptInput = z.object({
  paymentId: uuid,
  format: z.enum(['thermal', 'pdf']).default('thermal'),
});

export const PrintStatementInput = z.object({
  customerId: uuid,
  dateRange: dateRange.optional(),
  format: z.enum(['pdf']).default('pdf'),
});

// ═══════════════════════════════════════════════════════════════════════════════
// RÉPONSES API STANDARD
// ═══════════════════════════════════════════════════════════════════════════════

export const ApiSuccessResponse = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

export const ApiErrorResponse = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.object({
      field: z.string().optional(),
      message: z.string(),
    })).optional(),
  }),
});

export const ApiPaginatedResponse = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    success: z.literal(true),
    data: z.object({
      items: z.array(itemSchema),
      pagination: z.object({
        page: z.number().int(),
        limit: z.number().int(),
        total: z.number().int(),
        totalPages: z.number().int(),
        hasNext: z.boolean(),
        hasPrev: z.boolean(),
      }),
    }),
  });

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES INFÉRÉS POUR EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export type CreateOrganizationInput = z.infer<typeof CreateOrganizationInput>;
export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationInput>;
export type CreateUserInput = z.infer<typeof CreateUserInput>;
export type UpdateUserInput = z.infer<typeof UpdateUserInput>;
export type LoginInput = z.infer<typeof LoginInput>;
export type LoginResponse = z.infer<typeof LoginResponse>;
export type CreateCustomerInput = z.infer<typeof CreateCustomerInput>;
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerInput>;
export type CustomerQueryInput = z.infer<typeof CustomerQueryInput>;
export type CreateProductInput = z.infer<typeof CreateProductInput>;
export type UpdateProductInput = z.infer<typeof UpdateProductInput>;
export type ProductQueryInput = z.infer<typeof ProductQueryInput>;
export type CreateOrderInput = z.infer<typeof CreateOrderInput>;
export type UpdateOrderInput = z.infer<typeof UpdateOrderInput>;
export type OrderQueryInput = z.infer<typeof OrderQueryInput>;
export type AssignDeliveryInput = z.infer<typeof AssignDeliveryInput>;
export type CompleteDeliveryInput = z.infer<typeof CompleteDeliveryInput>;
export type DeliveryQueryInput = z.infer<typeof DeliveryQueryInput>;
export type CreatePaymentInput = z.infer<typeof CreatePaymentInput>;
export type PaymentQueryInput = z.infer<typeof PaymentQueryInput>;
export type CloseDailyCashInput = z.infer<typeof CloseDailyCashInput>;
export type SyncPullInput = z.infer<typeof SyncPullInput>;
export type SyncPushInput = z.infer<typeof SyncPushInput>;
