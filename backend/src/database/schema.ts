// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - SCHÉMA DRIZZLE ORM COMPLET
// Synchronisé avec database/schema.sql
// ═══════════════════════════════════════════════════════════════════════════════

import {
  pgTable,
  uuid,
  varchar,
  text,
  decimal,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ═══════════════════════════════════════════════════════════════════════════════
// ENUMS - Correspondance exacte avec schema.sql
// ═══════════════════════════════════════════════════════════════════════════════

export const userRoleEnum = pgEnum('user_role', [
  'admin', 'manager', 'deliverer', 'kitchen'
]);

export const orderStatusEnum = pgEnum('order_status', [
  'draft', 'pending', 'confirmed', 'preparing', 'ready', 
  'assigned', 'in_delivery', 'delivered', 'cancelled'
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'unpaid', 'partial', 'paid'
]);

export const deliveryStatusEnum = pgEnum('delivery_status', [
  'pending', 'assigned', 'picked_up', 'in_transit', 
  'arrived', 'delivered', 'failed', 'returned'
]);

export const paymentTypeEnum = pgEnum('payment_type', [
  'order_payment', 'debt_payment', 'advance_payment', 'refund'
]);

export const paymentModeEnum = pgEnum('payment_mode', [
  'cash', 'check', 'bank_transfer', 'mobile_payment'
]);

// ═══════════════════════════════════════════════════════════════════════════════
// 1. ORGANIZATIONS - Multi-tenant root
// ═══════════════════════════════════════════════════════════════════════════════

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Informations de base
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 50 }).notNull().unique(),
  legalName: varchar('legal_name', { length: 150 }),
  
  // Contact
  address: text('address'),
  city: varchar('city', { length: 50 }),
  wilaya: varchar('wilaya', { length: 50 }),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 100 }),
  
  // Branding
  logoUrl: varchar('logo_url', { length: 255 }),
  primaryColor: varchar('primary_color', { length: 7 }).default('#2563eb'),
  
  // Configuration financière par défaut
  defaultCreditLimit: decimal('default_credit_limit', { precision: 12, scale: 2 }).default('50000'),
  defaultPaymentDelayDays: integer('default_payment_delay_days').default(30),
  debtAlertDays: integer('debt_alert_days').default(60),
  currency: varchar('currency', { length: 3 }).default('DZD'),
  
  // Fonctionnalités activées
  features: jsonb('features').default({
    signature_required: false,
    photo_required: false,
    qr_code_enabled: true,
    bluetooth_printing: true,
    push_notifications: true,
    sms_notifications: false,
    recurring_orders: true,
    custom_pricing: true,
  }),
  
  // Paramètres d'impression
  printSettings: jsonb('print_settings').default({
    printer_type: '58mm',
    auto_print_delivery: false,
    auto_print_receipt: true,
    show_debt_on_receipt: true,
    header_line1: '',
    header_line2: '',
    footer_text: 'Merci pour votre confiance!',
  }),
  
  // Paramètres de notification admin
  adminNotifications: jsonb('admin_notifications').default({
    credit_limit_reached: true,
    debt_over_limit: true,
    large_payment_threshold: 100000,
    daily_summary_time: '20:00',
    daily_summary_enabled: true,
  }),
  
  // Statistiques dénormalisées
  stats: jsonb('stats').default({
    total_customers: 0,
    total_deliverers: 0,
    total_products: 0,
  }),
  
  timezone: varchar('timezone', { length: 50 }).default('Africa/Algiers'),
  
  // Coordonnées GPS
  coordinates: jsonb('coordinates').default(null),
  
  isActive: boolean('is_active').default(true),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  slugIdx: uniqueIndex('org_slug_idx').on(table.slug),
  activeIdx: index('org_active_idx').on(table.isActive).where(sql`${table.isActive} = true`),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// 2. UTILISATEURS (Admin, Managers, Livreurs, Cuisine)
// ═══════════════════════════════════════════════════════════════════════════════

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Authentification
  email: varchar('email', { length: 100 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  
  // Profil
  name: varchar('name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  avatarUrl: varchar('avatar_url', { length: 255 }),
  
  // Rôle et permissions
  role: userRoleEnum('role').notNull(),
  permissions: jsonb('permissions').default([]),
  
  // Pour livreurs
  vehicleType: varchar('vehicle_type', { length: 20 }), // 'car', 'motorcycle', 'bicycle', 'foot'
  licensePlate: varchar('license_plate', { length: 20 }),
  
  // Position (livreur)
  lastPosition: jsonb('last_position'), // {lat, lng, accuracy, updated_at}
  
  // Sécurité
  failedLoginAttempts: integer('failed_login_attempts').default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  passwordChangedAt: timestamp('password_changed_at', { withTimezone: true }),
  
  // Sessions
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  lastLoginIp: varchar('last_login_ip', { length: 45 }),
  
  // Push notifications
  pushTokens: jsonb('push_tokens').default([]), // [{token, platform, device_id}]
  
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  emailOrgIdx: uniqueIndex('users_email_org_idx').on(table.email, table.organizationId),
  orgIdx: index('users_org_idx').on(table.organizationId),
  roleIdx: index('users_role_idx').on(table.organizationId, table.role),
  activeIdx: index('users_active_idx').on(table.organizationId, table.isActive).where(sql`${table.isActive} = true`),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// 3. CLIENTS (Points de vente)
// ═══════════════════════════════════════════════════════════════════════════════

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Identification
  code: varchar('code', { length: 20 }), // Code client optionnel (ex: CLI-001)
  name: varchar('name', { length: 100 }).notNull(),
  
  // Contact
  contactName: varchar('contact_name', { length: 100 }),
  phone: varchar('phone', { length: 20 }).notNull(),
  phoneSecondary: varchar('phone_secondary', { length: 20 }),
  email: varchar('email', { length: 100 }),
  
  // Adresse
  address: text('address').notNull(),
  city: varchar('city', { length: 50 }),
  wilaya: varchar('wilaya', { length: 50 }),
  zone: varchar('zone', { length: 50 }), // Zone de livraison
  coordinates: jsonb('coordinates'), // {lat, lng}
  
  // Finance
  creditLimit: decimal('credit_limit', { precision: 12, scale: 2 }).default('50000'),
  creditLimitEnabled: boolean('credit_limit_enabled').default(true),
  currentDebt: decimal('current_debt', { precision: 12, scale: 2 }).default('0'),
  paymentDelayDays: integer('payment_delay_days').default(30),
  
  // Tarification personnalisée
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }).default('0'),
  customPrices: jsonb('custom_prices').default({}), // {"product_id": price}
  priceListId: uuid('price_list_id'), // Référence future
  
  // Champs dénormalisés pour statistiques (facilitent les requêtes et indexation)
  lastPaymentAt: timestamp('last_payment_at', { withTimezone: true }),
  lastOrderAt: timestamp('last_order_at', { withTimezone: true }),
  totalOrders: integer('total_orders').default(0),
  totalRevenue: decimal('total_revenue', { precision: 12, scale: 2 }).default('0'),
  
  // Statistiques dénormalisées (JSONB pour flexibilité)
  stats: jsonb('stats').default({
    total_orders: 0,
    total_revenue: 0,
    total_paid: 0,
    avg_order_value: 0,
    avg_payment_delay: 0,
    last_order_at: null,
    last_payment_at: null,
  }),
  
  // App client
  appUserId: uuid('app_user_id'), // Si le client a un compte app
  pushToken: varchar('push_token', { length: 255 }),
  
  // Préférences de livraison
  preferredDeliveryTime: varchar('preferred_delivery_time', { length: 20 }), // 'morning', 'afternoon', 'evening'
  deliveryNotes: text('delivery_notes'), // Notes permanentes pour livreur
  
  notes: text('notes'), // Notes internes admin
  tags: jsonb('tags').default([]), // Tags pour filtrage
  
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  orgIdx: index('customers_org_idx').on(table.organizationId),
  codeOrgIdx: uniqueIndex('customers_code_org_idx').on(table.code, table.organizationId).where(sql`${table.code} IS NOT NULL`),
  phoneIdx: index('customers_phone_idx').on(table.phone),
  zoneIdx: index('customers_zone_idx').on(table.organizationId, table.zone),
  debtIdx: index('customers_debt_idx').on(table.organizationId, table.currentDebt).where(sql`${table.currentDebt} > 0`),
  activeIdx: index('customers_active_idx').on(table.organizationId, table.isActive).where(sql`${table.isActive} = true`),
  searchIdx: index('customers_search_idx').on(table.name), // GIN avec pg_trgm côté SQL
}));

// ═══════════════════════════════════════════════════════════════════════════════
// 4. COMPTES CLIENT (Pour l'app mobile client)
// ═══════════════════════════════════════════════════════════════════════════════

export const customerAccounts = pgTable('customer_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  
  // Authentification
  phone: varchar('phone', { length: 20 }).notNull().unique(),
  pinHash: text('pin_hash'), // PIN à 4-6 chiffres
  
  // OTP
  otpCode: varchar('otp_code', { length: 6 }),
  otpExpiresAt: timestamp('otp_expires_at', { withTimezone: true }),
  otpAttempts: integer('otp_attempts').default(0),
  
  // Session
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  pushToken: varchar('push_token', { length: 255 }),
  deviceId: varchar('device_id', { length: 100 }),
  deviceInfo: jsonb('device_info'),
  
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  phoneIdx: index('customer_accounts_phone_idx').on(table.phone),
  customerIdx: index('customer_accounts_customer_idx').on(table.customerId),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// 5. CATÉGORIES DE PRODUITS
// ═══════════════════════════════════════════════════════════════════════════════

export const productCategories = pgTable('product_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  name: varchar('name', { length: 50 }).notNull(),
  slug: varchar('slug', { length: 50 }).notNull(),
  icon: varchar('icon', { length: 50 }), // Nom de l'icône
  color: varchar('color', { length: 7 }), // Couleur hex
  
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  orgIdx: index('categories_org_idx').on(table.organizationId),
  slugOrgIdx: uniqueIndex('categories_slug_org_idx').on(table.slug, table.organizationId),
}));

// Alias pour compatibilité
export const categories = productCategories;

// ═══════════════════════════════════════════════════════════════════════════════
// 6. PRODUITS
// ═══════════════════════════════════════════════════════════════════════════════

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => productCategories.id, { onDelete: 'set null' }),
  
  // Identification
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  sku: varchar('sku', { length: 50 }),
  barcode: varchar('barcode', { length: 50 }),
  
  // Prix et unité
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  unit: varchar('unit', { length: 20 }).default('pièce'), // 'pièce', 'kg', 'pack', 'boîte'
  unitQuantity: decimal('unit_quantity', { precision: 10, scale: 2 }).default('1'),
  
  // Images
  imageUrl: varchar('image_url', { length: 255 }),
  thumbnailUrl: varchar('thumbnail_url', { length: 255 }),
  
  // Stock
  trackStock: boolean('track_stock').default(false),
  currentStock: decimal('current_stock', { precision: 10, scale: 2 }),
  minStockAlert: decimal('min_stock_alert', { precision: 10, scale: 2 }),
  
  // Disponibilité
  isAvailable: boolean('is_available').default(true),
  availabilitySchedule: jsonb('availability_schedule'), // Jours/heures de disponibilité
  
  // Affichage
  sortOrder: integer('sort_order').default(0),
  isFeatured: boolean('is_featured').default(false),
  
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  orgIdx: index('products_org_idx').on(table.organizationId),
  categoryIdx: index('products_category_idx').on(table.categoryId),
  availableIdx: index('products_available_idx').on(table.organizationId, table.isAvailable, table.isActive)
    .where(sql`${table.isAvailable} = true AND ${table.isActive} = true`),
  barcodeIdx: index('products_barcode_idx').on(table.barcode).where(sql`${table.barcode} IS NOT NULL`),
  searchIdx: index('products_search_idx').on(table.name), // GIN avec pg_trgm côté SQL
}));

// ═══════════════════════════════════════════════════════════════════════════════
// 7. COMMANDES
// ═══════════════════════════════════════════════════════════════════════════════

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  
  // Numéro de commande
  orderNumber: varchar('order_number', { length: 20 }).notNull(),
  
  // Statut
  status: orderStatusEnum('status').default('pending'),
  
  // Montants
  subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }).default('0'),
  discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }).default('0'),
  total: decimal('total', { precision: 12, scale: 2 }).notNull(),
  
  // Paiement
  paymentStatus: paymentStatusEnum('payment_status').default('unpaid'),
  amountPaid: decimal('amount_paid', { precision: 12, scale: 2 }).default('0'),
  amountDue: decimal('amount_due', { precision: 12, scale: 2 }).default('0'),
  
  // Livraison
  deliveryDate: date('delivery_date'),
  deliveryTimeSlot: varchar('delivery_time_slot', { length: 20 }), // 'morning', 'afternoon', 'evening'
  deliveryAddress: text('delivery_address'),
  deliveryNotes: text('delivery_notes'),
  
  // Commande récurrente
  isRecurring: boolean('is_recurring').default(false),
  recurringConfig: jsonb('recurring_config'), // {frequency, days, end_date}
  parentOrderId: uuid('parent_order_id').references(() => orders.id),
  
  // Source
  source: varchar('source', { length: 20 }).default('admin'), // 'admin', 'client_app', 'recurring'
  
  // Timestamps détaillés
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  confirmedBy: uuid('confirmed_by').references(() => users.id),
  preparedAt: timestamp('prepared_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancelledBy: uuid('cancelled_by').references(() => users.id),
  cancellationReason: text('cancellation_reason'),
  
  notes: text('notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  orgIdx: index('orders_org_idx').on(table.organizationId),
  customerIdx: index('orders_customer_idx').on(table.customerId),
  numberOrgIdx: uniqueIndex('orders_number_org_idx').on(table.orderNumber, table.organizationId),
  statusIdx: index('orders_status_idx').on(table.organizationId, table.status),
  dateIdx: index('orders_date_idx').on(table.organizationId, table.deliveryDate),
  paymentIdx: index('orders_payment_idx').on(table.organizationId, table.paymentStatus).where(sql`${table.paymentStatus} != 'paid'`),
  createdIdx: index('orders_created_idx').on(table.organizationId, table.createdAt),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// 8. LIGNES DE COMMANDE
// ═══════════════════════════════════════════════════════════════════════════════

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id),
  
  // Snapshot au moment de la commande
  productName: varchar('product_name', { length: 100 }).notNull(),
  productSku: varchar('product_sku', { length: 50 }),
  
  // Quantité et prix
  quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal('total_price', { precision: 12, scale: 2 }).notNull(),
  
  notes: text('notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  orderIdx: index('order_items_order_idx').on(table.orderId),
  productIdx: index('order_items_product_idx').on(table.productId),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// 9. LIVRAISONS
// ═══════════════════════════════════════════════════════════════════════════════

export const deliveries = pgTable('deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  orderId: uuid('order_id').notNull().references(() => orders.id),
  delivererId: uuid('deliverer_id').references(() => users.id),
  
  // Statut
  status: deliveryStatusEnum('status').default('pending'),
  
  // Planification
  scheduledDate: date('scheduled_date').notNull(),
  scheduledTime: varchar('scheduled_time', { length: 10 }),
  sequenceNumber: integer('sequence_number'),
  priority: integer('priority').default(50),
  
  // Montants à collecter
  orderAmount: decimal('order_amount', { precision: 12, scale: 2 }).notNull(),
  existingDebt: decimal('existing_debt', { precision: 12, scale: 2 }).default('0'),
  totalToCollect: decimal('total_to_collect', { precision: 12, scale: 2 }).notNull(),
  
  // Collecté
  amountCollected: decimal('amount_collected', { precision: 12, scale: 2 }).default('0'),
  collectionMode: paymentModeEnum('collection_mode'),
  
  // Timestamps
  assignedAt: timestamp('assigned_at', { withTimezone: true }),
  pickedUpAt: timestamp('picked_up_at', { withTimezone: true }),
  arrivedAt: timestamp('arrived_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  
  // Preuve de livraison
  proofOfDelivery: jsonb('proof_of_delivery'), // {signature_data, signature_name, photos[], location}
  
  // Échec
  failureReason: text('failure_reason'),
  
  // Distance et temps
  estimatedDistanceKm: decimal('estimated_distance_km', { precision: 6, scale: 2 }),
  estimatedDurationMin: integer('estimated_duration_min'),
  actualDistanceKm: decimal('actual_distance_km', { precision: 6, scale: 2 }),
  actualDurationMin: integer('actual_duration_min'),
  
  notes: text('notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  orgIdx: index('deliveries_org_idx').on(table.organizationId),
  orderIdx: index('deliveries_order_idx').on(table.orderId),
  delivererIdx: index('deliveries_deliverer_idx').on(table.delivererId, table.scheduledDate),
  dateIdx: index('deliveries_date_idx').on(table.organizationId, table.scheduledDate),
  statusIdx: index('deliveries_status_idx').on(table.organizationId, table.status),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// 10. HISTORIQUE DES PAIEMENTS
// ═══════════════════════════════════════════════════════════════════════════════

export const paymentHistory = pgTable('payment_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  
  // Montant et mode
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  mode: paymentModeEnum('mode').notNull().default('cash'),
  
  // Type de paiement
  paymentType: paymentTypeEnum('payment_type').notNull(),
  
  // Références
  deliveryId: uuid('delivery_id').references(() => deliveries.id),
  orderId: uuid('order_id').references(() => orders.id),
  
  // Collecteur
  collectedBy: uuid('collected_by').references(() => users.id),
  collectedAt: timestamp('collected_at', { withTimezone: true }).defaultNow(),
  
  // Pour chèques
  checkNumber: varchar('check_number', { length: 50 }),
  checkBank: varchar('check_bank', { length: 100 }),
  checkDate: date('check_date'),
  
  // Réconciliation
  receiptNumber: varchar('receipt_number', { length: 50 }),
  
  // Balance après paiement
  customerDebtBefore: decimal('customer_debt_before', { precision: 12, scale: 2 }),
  customerDebtAfter: decimal('customer_debt_after', { precision: 12, scale: 2 }),
  
  // Application aux commandes (FIFO)
  appliedTo: jsonb('applied_to').default([]), // [{order_id, amount}]
  
  notes: text('notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  orgIdx: index('payments_org_idx').on(table.organizationId),
  customerIdx: index('payments_customer_idx').on(table.customerId),
  dateIdx: index('payments_date_idx').on(table.organizationId, table.collectedAt),
  collectorIdx: index('payments_collector_idx').on(table.collectedBy, table.collectedAt),
  deliveryIdx: index('payments_delivery_idx').on(table.deliveryId).where(sql`${table.deliveryId} IS NOT NULL`),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// 11. CAISSE JOURNALIÈRE LIVREUR
// ═══════════════════════════════════════════════════════════════════════════════

export const dailyCash = pgTable('daily_cash', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  delivererId: uuid('deliverer_id').notNull().references(() => users.id),
  
  date: date('date').notNull(),
  
  // Solde de départ
  openingBalance: decimal('opening_balance', { precision: 12, scale: 2 }).default('0'),
  
  // Montants
  expectedCollection: decimal('expected_collection', { precision: 12, scale: 2 }).default('0'),
  actualCollection: decimal('actual_collection', { precision: 12, scale: 2 }).default('0'),
  cashCollected: decimal('cash_collected', { precision: 12, scale: 2 }).default('0'),
  newDebtCreated: decimal('new_debt_created', { precision: 12, scale: 2 }).default('0'),
  
  // Statistiques
  deliveriesCount: integer('deliveries_count').default(0),
  deliveriesTotal: integer('deliveries_total').default(0),
  deliveriesCompleted: integer('deliveries_completed').default(0),
  deliveriesFailed: integer('deliveries_failed').default(0),
  
  // Clôture
  isClosed: boolean('is_closed').default(false),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  closedBy: uuid('closed_by').references(() => users.id),
  status: varchar('status', { length: 20 }).default('open'), // 'open', 'closed', 'validated'
  
  // Remise d'argent
  cashHandedOver: decimal('cash_handed_over', { precision: 12, scale: 2 }),
  expectedAmount: decimal('expected_amount', { precision: 12, scale: 2 }),
  actualAmount: decimal('actual_amount', { precision: 12, scale: 2 }),
  difference: decimal('difference', { precision: 12, scale: 2 }),
  discrepancy: decimal('discrepancy', { precision: 12, scale: 2 }),
  discrepancyNotes: text('discrepancy_notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  delivererDateIdx: uniqueIndex('daily_cash_deliverer_date_idx').on(table.delivererId, table.date),
  orgIdx: index('daily_cash_org_idx').on(table.organizationId, table.date),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// 12. TRANSACTIONS DE LIVRAISON (Détail)
// ═══════════════════════════════════════════════════════════════════════════════

export const deliveryTransactions = pgTable('delivery_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  deliveryId: uuid('delivery_id').notNull().references(() => deliveries.id, { onDelete: 'cascade' }),
  paymentId: uuid('payment_id').references(() => paymentHistory.id),
  orderId: uuid('order_id').references(() => orders.id),
  customerId: uuid('customer_id').references(() => customers.id),
  
  // Type de transaction
  type: varchar('type', { length: 30 }).notNull(), // 'delivery', 'full_payment', 'partial_payment', 'debt_collection', 'failed'
  
  // Détails financiers
  orderAmount: decimal('order_amount', { precision: 12, scale: 2 }),
  debtBefore: decimal('debt_before', { precision: 12, scale: 2 }),
  amountPaid: decimal('amount_paid', { precision: 12, scale: 2 }),
  appliedToOrder: decimal('applied_to_order', { precision: 12, scale: 2 }),
  appliedToDebt: decimal('applied_to_debt', { precision: 12, scale: 2 }),
  newDebtCreated: decimal('new_debt_created', { precision: 12, scale: 2 }),
  debtAfter: decimal('debt_after', { precision: 12, scale: 2 }),
  
  collectedBy: uuid('collected_by').references(() => users.id),
  
  notes: text('notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  deliveryIdx: index('delivery_tx_delivery_idx').on(table.deliveryId),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// 13. NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Destinataire
  userId: uuid('user_id').references(() => users.id),
  customerId: uuid('customer_id').references(() => customers.id),
  customerAccountId: uuid('customer_account_id').references(() => customerAccounts.id),
  
  // Contenu
  type: varchar('type', { length: 50 }).notNull(),
  title: varchar('title', { length: 100 }).notNull(),
  body: text('body').notNull(),
  data: jsonb('data'),
  
  // Canal
  channel: varchar('channel', { length: 20 }).default('push'), // 'push', 'sms', 'email', 'in_app'
  
  // Statut
  isRead: boolean('is_read').default(false),
  readAt: timestamp('read_at', { withTimezone: true }),
  isSent: boolean('is_sent').default(false),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  sendError: text('send_error'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userIdx: index('notifications_user_idx').on(table.userId, table.isRead, table.createdAt).where(sql`${table.userId} IS NOT NULL`),
  customerIdx: index('notifications_customer_idx').on(table.customerId, table.isRead, table.createdAt).where(sql`${table.customerId} IS NOT NULL`),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// 14. JOURNAL D'ACTIVITÉ (Audit Log)
// ═══════════════════════════════════════════════════════════════════════════════

export const activityLog = pgTable('activity_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Qui
  userId: uuid('user_id').references(() => users.id),
  userName: varchar('user_name', { length: 100 }),
  userRole: varchar('user_role', { length: 20 }),
  
  // Quoi
  action: varchar('action', { length: 50 }).notNull(), // 'create', 'update', 'delete', 'login'
  entityType: varchar('entity_type', { length: 50 }).notNull(), // 'order', 'customer', 'payment'
  entityId: uuid('entity_id'),
  
  // Détails
  description: text('description'),
  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),
  
  // Contexte
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  orgIdx: index('activity_org_idx').on(table.organizationId, table.createdAt),
  userIdx: index('activity_user_idx').on(table.userId, table.createdAt),
  entityIdx: index('activity_entity_idx').on(table.entityType, table.entityId),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// 15. REFRESH TOKENS
// ═══════════════════════════════════════════════════════════════════════════════

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  customerAccountId: uuid('customer_account_id').references(() => customerAccounts.id, { onDelete: 'cascade' }),
  
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  
  // Device info
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: varchar('user_agent', { length: 255 }),
  deviceId: varchar('device_id', { length: 100 }),
  
  isRevoked: boolean('is_revoked').default(false),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userIdx: index('refresh_tokens_user_idx').on(table.userId).where(sql`${table.userId} IS NOT NULL`),
  customerIdx: index('refresh_tokens_customer_idx').on(table.customerAccountId).where(sql`${table.customerAccountId} IS NOT NULL`),
  hashIdx: index('refresh_tokens_hash_idx').on(table.tokenHash),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// 16. PARAMÈTRES DE SYNCHRONISATION OFFLINE
// ═══════════════════════════════════════════════════════════════════════════════

export const syncLog = pgTable('sync_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Type de sync
  syncType: varchar('sync_type', { length: 20 }).notNull(), // 'full', 'incremental'
  direction: varchar('direction', { length: 10 }).notNull(), // 'push', 'pull'
  
  // Données
  entitiesSynced: jsonb('entities_synced'), // {orders: 5, payments: 3, ...}
  
  // Statut
  status: varchar('status', { length: 20 }).notNull(), // 'success', 'partial', 'failed'
  errorMessage: text('error_message'),
  
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  
  // Curseurs
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  syncToken: varchar('sync_token', { length: 100 }),
}, (table) => ({
  userIdx: index('sync_log_user_idx').on(table.userId, table.startedAt),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// 17. MOUVEMENTS DE STOCK
// ═══════════════════════════════════════════════════════════════════════════════

export const stockMovements = pgTable('stock_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  
  // Type de mouvement
  type: varchar('type', { length: 20 }).notNull(), // 'in', 'out', 'adjustment', 'initial'
  
  // Quantités
  quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull(),
  previousStock: decimal('previous_stock', { precision: 10, scale: 2 }).notNull(),
  newStock: decimal('new_stock', { precision: 10, scale: 2 }).notNull(),
  
  // Références
  orderId: uuid('order_id'), // Si lié à une commande
  deliveryId: uuid('delivery_id'), // Si lié à une livraison
  
  // Informations
  reason: text('reason'), // Raison de l'ajustement
  notes: text('notes'),
  
  // Métadonnées
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  productIdx: index('stock_movements_product_idx').on(table.productId),
  orgIdx: index('stock_movements_org_idx').on(table.organizationId),
  typeIdx: index('stock_movements_type_idx').on(table.type),
  dateIdx: index('stock_movements_date_idx').on(table.createdAt),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// RELATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  customers: many(customers),
  productCategories: many(productCategories),
  products: many(products),
  orders: many(orders),
  deliveries: many(deliveries),
  paymentHistory: many(paymentHistory),
  dailyCash: many(dailyCash),
  notifications: many(notifications),
  activityLog: many(activityLog),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  deliveries: many(deliveries),
  dailyCash: many(dailyCash),
  paymentsCollected: many(paymentHistory),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [customers.organizationId],
    references: [organizations.id],
  }),
  orders: many(orders),
  payments: many(paymentHistory),
  accounts: many(customerAccounts),
}));

export const customerAccountsRelations = relations(customerAccounts, ({ one }) => ({
  customer: one(customers, {
    fields: [customerAccounts.customerId],
    references: [customers.id],
  }),
}));

export const productCategoriesRelations = relations(productCategories, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [productCategories.organizationId],
    references: [organizations.id],
  }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one }) => ({
  organization: one(organizations, {
    fields: [products.organizationId],
    references: [organizations.id],
  }),
  category: one(productCategories, {
    fields: [products.categoryId],
    references: [productCategories.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [orders.organizationId],
    references: [organizations.id],
  }),
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  confirmedByUser: one(users, {
    fields: [orders.confirmedBy],
    references: [users.id],
  }),
  items: many(orderItems),
  delivery: one(deliveries),
  payments: many(paymentHistory),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const deliveriesRelations = relations(deliveries, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [deliveries.organizationId],
    references: [organizations.id],
  }),
  order: one(orders, {
    fields: [deliveries.orderId],
    references: [orders.id],
  }),
  deliverer: one(users, {
    fields: [deliveries.delivererId],
    references: [users.id],
  }),
  transactions: many(deliveryTransactions),
  payments: many(paymentHistory),
}));

export const paymentHistoryRelations = relations(paymentHistory, ({ one }) => ({
  organization: one(organizations, {
    fields: [paymentHistory.organizationId],
    references: [organizations.id],
  }),
  customer: one(customers, {
    fields: [paymentHistory.customerId],
    references: [customers.id],
  }),
  order: one(orders, {
    fields: [paymentHistory.orderId],
    references: [orders.id],
  }),
  delivery: one(deliveries, {
    fields: [paymentHistory.deliveryId],
    references: [deliveries.id],
  }),
  collectedByUser: one(users, {
    fields: [paymentHistory.collectedBy],
    references: [users.id],
  }),
}));

export const deliveryTransactionsRelations = relations(deliveryTransactions, ({ one }) => ({
  delivery: one(deliveries, {
    fields: [deliveryTransactions.deliveryId],
    references: [deliveries.id],
  }),
  payment: one(paymentHistory, {
    fields: [deliveryTransactions.paymentId],
    references: [paymentHistory.id],
  }),
  order: one(orders, {
    fields: [deliveryTransactions.orderId],
    references: [orders.id],
  }),
  customer: one(customers, {
    fields: [deliveryTransactions.customerId],
    references: [customers.id],
  }),
}));

export const dailyCashRelations = relations(dailyCash, ({ one }) => ({
  organization: one(organizations, {
    fields: [dailyCash.organizationId],
    references: [organizations.id],
  }),
  deliverer: one(users, {
    fields: [dailyCash.delivererId],
    references: [users.id],
  }),
  closedByUser: one(users, {
    fields: [dailyCash.closedBy],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  organization: one(organizations, {
    fields: [notifications.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  customer: one(customers, {
    fields: [notifications.customerId],
    references: [customers.id],
  }),
  customerAccount: one(customerAccounts, {
    fields: [notifications.customerAccountId],
    references: [customerAccounts.id],
  }),
}));

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  organization: one(organizations, {
    fields: [activityLog.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [activityLog.userId],
    references: [users.id],
  }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
  customerAccount: one(customerAccounts, {
    fields: [refreshTokens.customerAccountId],
    references: [customerAccounts.id],
  }),
}));

export const syncLogRelations = relations(syncLog, ({ one }) => ({
  user: one(users, {
    fields: [syncLog.userId],
    references: [users.id],
  }),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  organization: one(organizations, {
    fields: [stockMovements.organizationId],
    references: [organizations.id],
  }),
  product: one(products, {
    fields: [stockMovements.productId],
    references: [products.id],
  }),
  order: one(orders, {
    fields: [stockMovements.orderId],
    references: [orders.id],
  }),
  delivery: one(deliveries, {
    fields: [stockMovements.deliveryId],
    references: [deliveries.id],
  }),
  creator: one(users, {
    fields: [stockMovements.createdBy],
    references: [users.id],
  }),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// ALIASES (pour compatibilité)
// ═══════════════════════════════════════════════════════════════════════════════

// Alias pour compatibilité avec le code qui utilise 'payments' au lieu de 'paymentHistory'
export const payments = paymentHistory;

// Alias pour compatibilité avec le code qui utilise 'cashRemittances' au lieu de 'cash_receipts'
export const cashRemittances = cashReceipts;

// Alias pour compatibilité avec le code qui utilise 'expenses' au lieu de 'expenses' (si besoin)
export { expenses };
