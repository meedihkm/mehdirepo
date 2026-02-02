// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - SERVICES EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

// Auth Service
export { 
  authService,
  AuthService,
  register,
  login,
  logout,
  changePassword,
  requestPasswordReset,
  resetPassword,
  hashPassword
} from './auth.service';

// Customer Service  
export { 
  customerService,
  CustomerService,
  listCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  updateCreditLimit,
  getCustomerOrders,
  getCustomerPayments,
  getCustomerStatement
} from './customer.service';

// Order Service
export {
  orderService,
  OrderService,
  listOrders,
  getOrderById,
  createOrder,
  createOrderByCustomer,
  updateOrder,
  updateOrderStatus,
  cancelOrder,
  duplicateOrder
} from './order.service';

// Product Service
export {
  productService,
  ProductService,
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
  listCategories,
  createCategory,
  updateCategory,
  removeCategory
} from './product.service';

// Payment Service
export {
  paymentService,
  PaymentService,
  listPayments,
  getPaymentById,
  createPayment,
  recordPayment,
  getPaymentHistory
} from './payment.service';

// Delivery Service
export {
  deliveryService,
  DeliveryService,
  listDeliveries,
  getDeliveryById,
  getDelivererRoute,
  assignDeliveries,
  updateDeliveryStatus,
  completeDelivery,
  failDelivery,
  optimizeRoute,
  updateDelivererPosition,
  collectDebt
} from './delivery.service';

// Dashboard Service
export {
  dashboardService,
  DashboardService,
  getOverview,
  getSalesStats,
  getTopProducts,
  getDelivererPerformance,
  getStockAlerts
} from './dashboard.service';

// Notification Service
export {
  notificationService,
  NotificationService,
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  registerDeviceToken,
  createNotification,
  notifyOrderCreated,
  notifyOrderStatusChanged,
  notifyDeliveryAssigned,
  notifyDeliveryCompleted,
  notifyPaymentReceived,
  notifyDebtReminder
} from './notification.service';

// User Service
export {
  userService,
  UserService,
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  updatePosition,
  getPerformance,
  updateDelivererPosition,
  getDelivererPerformance
} from './user.service';

// Daily Cash Service
export {
  dailyCashService,
  DailyCashService,
  getDailyCash,
  getDailyCashHistory,
  getAllDailyCash,
  openDailyCash,
  closeDailyCash,
  remitCash,
  confirmRemittance,
  addExpense
} from './daily-cash.service';

// Report Service
export {
  reportService,
  ReportService,
  generateDailyReport,
  generateWeeklyReport,
  generateMonthlyReport,
  generateCustomerStatement,
  exportToExcel,
  // Stubs pour compatibilité
  generateSalesReport,
  generateDebtAgingReport,
  generateDelivererPerformanceReport,
  generateProductsReport,
  generateDailyCashReport,
  exportToPdf
} from './report.service';

// Print Service
export {
  printService,
  PrintService,
  generateDeliveryNotePDF,
  generateReceiptPDF,
  generateStatementPDF,
  generateDeliveryNote,
  generateOrderReceipt,
  generateStatement,
  printDeliveryNote,
  printReceipt,
  printStatement
} from './print.service';

// Customer Account Service
export {
  customerAccountService,
  CustomerAccountService,
  getCustomerProfile,
  getProductCatalog,
  getMyOrders,
  getOrderDetail,
  createOrder as createCustomerOrder,
  cancelOrder as cancelAccountOrder,
  getAccountStatement,
  reorderPreviousOrder
} from './customer-account.service';

// Sync Service
export {
  syncService,
  SyncService,
  getInitialDownload,
  processOfflineTransactions,
  getUpdates,
  checkConflicts,
  resolveConflict,
  getSyncStatus
} from './sync.service';

// File Upload Service
export {
  fileUploadService,
  FileUploadService,
  uploadImage,
  uploadMultipleImages,
  deleteImage,
  processAndUploadImage
} from './file-upload.service';

// SMS Service
export {
  sendSms,
  sendOtpSms,
  sendOrderNotificationSms,
  sendDeliveryNotificationSms
} from './sms.service';
