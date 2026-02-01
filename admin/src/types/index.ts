// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - TYPES TYPESCRIPT
// Types partagés pour l'application Admin
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════════

export type UserRole = 'admin' | 'manager' | 'deliverer' | 'kitchen' | 'customer';

export type OrderStatus = 
  | 'draft' 
  | 'pending' 
  | 'confirmed' 
  | 'preparing' 
  | 'ready' 
  | 'assigned' 
  | 'in_delivery' 
  | 'delivered' 
  | 'cancelled';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export type DeliveryStatus = 
  | 'pending' 
  | 'assigned' 
  | 'picked_up' 
  | 'in_transit' 
  | 'arrived' 
  | 'delivered' 
  | 'failed' 
  | 'returned';

export type PaymentMode = 'cash' | 'check' | 'bank_transfer' | 'mobile_payment';

export type PaymentType = 'order_payment' | 'debt_payment' | 'advance_payment' | 'refund';

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES UTILISATEUR
// ═══════════════════════════════════════════════════════════════════════════════

export interface User {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  avatarUrl?: string;
  permissions: string[];
  vehicleType?: 'car' | 'motorcycle' | 'bicycle' | 'foot';
  licensePlate?: string;
  isActive: boolean;
  lastLoginAt?: string;
  lastPosition?: {
    lat: number;
    lng: number;
    updatedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

export interface Customer {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  contactName?: string;
  phone: string;
  phoneSecondary?: string;
  email?: string;
  address: string;
  city?: string;
  wilaya?: string;
  zone?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  creditLimit: number;
  creditLimitEnabled: boolean;
  currentDebt: number;
  paymentDelayDays: number;
  customPrices: Record<string, number>;
  discountPercent: number;
  totalOrders: number;
  totalRevenue: number;
  lastOrderAt?: string;
  lastPaymentAt?: string;
  appUserId?: string;
  pushToken?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES PRODUIT
// ═══════════════════════════════════════════════════════════════════════════════

export interface Category {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  organizationId: string;
  categoryId?: string;
  category?: Category;
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  price: number;
  unit: string;
  unitQuantity?: number;
  imageUrl?: string;
  thumbnailUrl?: string;
  trackStock: boolean;
  currentStock: number;
  minStockAlert: number;
  isAvailable: boolean;
  isFeatured: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES COMMANDE
// ═══════════════════════════════════════════════════════════════════════════════

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  product: Product;
  productName: string;
  productSku?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  createdAt: string;
}

export interface Order {
  id: string;
  organizationId: string;
  customerId: string;
  customer: Customer;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  deliveryDate?: string;
  deliveryTimeSlot?: string;
  deliveryAddress?: string;
  deliveryNotes?: string;
  notes?: string;
  items: OrderItem[];
  source: 'admin' | 'mobile_app';
  confirmedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES LIVRAISON
// ═══════════════════════════════════════════════════════════════════════════════

export interface Delivery {
  id: string;
  organizationId: string;
  orderId: string;
  order: Order;
  delivererId: string;
  deliverer: User;
  status: DeliveryStatus;
  sequenceNumber: number;
  priority: number;
  scheduledDate: string;
  scheduledTime?: string;
  orderAmount: number;
  existingDebt: number;
  totalToCollect: number;
  amountCollected: number;
  collectionMode?: PaymentMode;
  assignedAt?: string;
  pickedUpAt?: string;
  arrivedAt?: string;
  completedAt?: string;
  proofOfDelivery?: {
    signature?: {
      data: string;
      name: string;
    };
    photos?: Array<{
      url: string;
      type: string;
      takenAt: string;
    }>;
    location?: {
      lat: number;
      lng: number;
    };
  };
  failureReason?: string;
  estimatedDistanceKm?: number;
  estimatedDurationMin?: number;
  actualDistanceKm?: number;
  actualDurationMin?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES PAIEMENT
// ═══════════════════════════════════════════════════════════════════════════════

export interface Payment {
  id: string;
  organizationId: string;
  customerId: string;
  customer: Customer;
  orderId?: string;
  order?: Order;
  deliveryId?: string;
  delivery?: Delivery;
  amount: number;
  mode: PaymentMode;
  paymentType: PaymentType;
  collectedBy: string;
  collector?: User;
  collectedAt: string;
  checkNumber?: string;
  checkBank?: string;
  checkDate?: string;
  receiptNumber?: string;
  customerDebtBefore: number;
  customerDebtAfter: number;
  appliedTo?: Array<{
    orderId: string;
    amount: number;
  }>;
  notes?: string;
  createdAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES CAISSE
// ═══════════════════════════════════════════════════════════════════════════════

export interface DailyCash {
  id: string;
  organizationId: string;
  delivererId: string;
  deliverer: User;
  date: string;
  openingBalance: number;
  expectedCollection: number;
  actualCollection: number;
  cashCollected: number;
  newDebtCreated: number;
  deliveriesCount: number;
  deliveriesTotal: number;
  deliveriesCompleted: number;
  deliveriesFailed: number;
  isClosed: boolean;
  closedAt?: string;
  closedBy?: string;
  closer?: User;
  cashHandedOver?: number;
  expectedAmount?: number;
  actualAmount?: number;
  difference?: number;
  discrepancy?: number;
  discrepancyNotes?: string;
  status: 'open' | 'closed' | 'validated';
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES FINANCE
// ═══════════════════════════════════════════════════════════════════════════════

export interface AgingBucket {
  range: string;
  daysStart: number;
  daysEnd: number;
  amount: number;
  count: number;
  percentage: number;
}

export interface AgingReport {
  organizationId: string;
  asOfDate: string;
  totalDebt: number;
  totalCustomers: number;
  buckets: AgingBucket[];
  customers: Array<{
    customer: Customer;
    currentDebt: number;
    buckets: number[];
  }>;
}

export interface FinancialOverview {
  period: {
    start: string;
    end: string;
  };
  revenue: {
    totalOrders: number;
    totalRevenue: number;
  };
  collections: {
    totalPayments: number;
    totalCollected: number;
  };
  debts: {
    totalDebt: number;
    customerCount: number;
  };
  outstandingRate: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES RAPPORT
// ═══════════════════════════════════════════════════════════════════════════════

export interface DailyReport {
  date: string;
  organizationId: string;
  totalOrders: number;
  totalRevenue: number;
  totalCollected: number;
  totalNewDebt: number;
  deliveriesCompleted: number;
  deliveriesFailed: number;
  topProducts: Array<{
    product: Product;
    quantity: number;
    revenue: number;
  }>;
  delivererPerformance: Array<{
    deliverer: User;
    deliveriesCount: number;
    collectedAmount: number;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES API
// ═══════════════════════════════════════════════════════════════════════════════

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

export interface DashboardStats {
  todayOrders: number;
  todayRevenue: number;
  todayCollected: number;
  activeDeliveries: number;
  totalDebt: number;
  alertsCount: number;
}

export interface TopProduct {
  product: Product;
  totalQuantity: number;
  totalRevenue: number;
}

export interface TopCustomer {
  customer: Customer;
  totalOrders: number;
  totalRevenue: number;
}

export interface DelivererPerformance {
  deliverer: User;
  deliveriesCount: number;
  completedCount: number;
  collectedAmount: number;
  averageDeliveryTime: number;
}

export interface DashboardData {
  stats: DashboardStats;
  recentOrders: Order[];
  topProducts: TopProduct[];
  topCustomers: TopCustomer[];
  delivererPerformance: DelivererPerformance[];
  alerts: Array<{
    type: 'stock' | 'credit_limit' | 'payment_delay' | 'delivery_delay';
    severity: 'low' | 'medium' | 'high';
    message: string;
    data?: any;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES NOTIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface Notification {
  id: string;
  organizationId: string;
  userId?: string;
  customerId?: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  channel: 'push' | 'sms' | 'email' | 'in_app';
  isRead: boolean;
  readAt?: string;
  isSent: boolean;
  sentAt?: string;
  sendError?: string;
  createdAt: string;
}
