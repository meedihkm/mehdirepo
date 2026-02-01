// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - MODÈLES COMMUNS
// Produit, Client, Catégorie, Paiement
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:freezed_annotation/freezed_annotation.dart';

part 'common_models.freezed.dart';
part 'common_models.g.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUIT
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class Product with _$Product {
  const Product._();

  const factory Product({
    required String id,
    required String organizationId,
    required String sku,
    required String name,
    String? description,
    required String categoryId,
    String? categoryName,
    required String unit,
    required double basePrice,
    double? discountPrice,
    DateTime? discountEndDate,
    required double currentPrice,
    @Default(0) int stockQuantity,
    @Default(0) int minStockLevel,
    String? imageUrl,
    @Default(true) bool isActive,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _Product;

  factory Product.fromJson(Map<String, dynamic> json) =>
      _$ProductFromJson(json);

  bool get hasDiscount =>
      discountPrice != null &&
      (discountEndDate == null || discountEndDate!.isAfter(DateTime.now()));

  bool get isLowStock => stockQuantity <= minStockLevel;
  bool get isOutOfStock => stockQuantity <= 0;

  double get effectivePrice => hasDiscount ? discountPrice! : basePrice;

  double get discountPercent {
    if (!hasDiscount) return 0;
    return ((basePrice - discountPrice!) / basePrice * 100).roundToDouble();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATÉGORIE
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class Category with _$Category {
  const factory Category({
    required String id,
    required String organizationId,
    required String name,
    String? description,
    @Default(0) int sortOrder,
    String? imageUrl,
    @Default(0) int productCount,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _Category;

  factory Category.fromJson(Map<String, dynamic> json) =>
      _$CategoryFromJson(json);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class Customer with _$Customer {
  const Customer._();

  const factory Customer({
    required String id,
    required String organizationId,
    required String code,
    required String name,
    required String phone,
    String? phone2,
    String? email,
    required String address,
    String? addressComplement,
    String? city,
    String? wilaya,
    String? postalCode,
    double? latitude,
    double? longitude,
    @Default(0) double currentDebt,
    double? creditLimit,
    @Default(true) bool creditLimitEnabled,
    String? taxId,
    String? registrationNumber,
    @Default('normal') String category,
    String? notes,
    @Default(true) bool isActive,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _Customer;

  factory Customer.fromJson(Map<String, dynamic> json) =>
      _$CustomerFromJson(json);

  bool get hasDebt => currentDebt > 0;
  bool get hasLocation => latitude != null && longitude != null;

  bool get isOverCreditLimit {
    if (!creditLimitEnabled || creditLimit == null) return false;
    return currentDebt >= creditLimit!;
  }

  double get availableCredit {
    if (!creditLimitEnabled || creditLimit == null) return double.infinity;
    return (creditLimit! - currentDebt).clamp(0, double.infinity);
  }

  double get creditUsagePercent {
    if (!creditLimitEnabled || creditLimit == null || creditLimit == 0) return 0;
    return (currentDebt / creditLimit! * 100).clamp(0, 100);
  }

  String get fullAddress {
    final parts = <String>[address];
    if (addressComplement?.isNotEmpty == true) parts.add(addressComplement!);
    if (city?.isNotEmpty == true) parts.add(city!);
    if (wilaya?.isNotEmpty == true) parts.add(wilaya!);
    return parts.join(', ');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAIEMENT
// ═══════════════════════════════════════════════════════════════════════════════

enum PaymentMode {
  @JsonValue('cash')
  cash,
  @JsonValue('check')
  check,
  @JsonValue('ccp')
  ccp,
  @JsonValue('bank_transfer')
  bankTransfer,
}

enum PaymentType {
  @JsonValue('order_payment')
  orderPayment,
  @JsonValue('debt_payment')
  debtPayment,
  @JsonValue('advance_payment')
  advancePayment,
}

@freezed
class Payment with _$Payment {
  const Payment._();

  const factory Payment({
    required String id,
    required String organizationId,
    required String customerId,
    String? orderId,
    String? deliveryId,
    String? collectedById,
    required String receiptNumber,
    required double amount,
    required PaymentMode mode,
    required PaymentType paymentType,
    String? checkNumber,
    String? bankName,
    String? transactionRef,
    double? appliedToOrder,
    double? appliedToDebt,
    String? notes,
    @Default(false) bool isVoided,
    String? voidReason,
    required DateTime createdAt,
  }) = _Payment;

  factory Payment.fromJson(Map<String, dynamic> json) =>
      _$PaymentFromJson(json);

  String get modeLabel {
    switch (mode) {
      case PaymentMode.cash:
        return 'Espèces';
      case PaymentMode.check:
        return 'Chèque';
      case PaymentMode.ccp:
        return 'CCP';
      case PaymentMode.bankTransfer:
        return 'Virement';
    }
  }

  String get typeLabel {
    switch (paymentType) {
      case PaymentType.orderPayment:
        return 'Paiement commande';
      case PaymentType.debtPayment:
        return 'Paiement dette';
      case PaymentType.advancePayment:
        return 'Avance';
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMANDE
// ═══════════════════════════════════════════════════════════════════════════════

enum OrderStatus {
  @JsonValue('draft')
  draft,
  @JsonValue('pending')
  pending,
  @JsonValue('confirmed')
  confirmed,
  @JsonValue('preparing')
  preparing,
  @JsonValue('ready')
  ready,
  @JsonValue('delivering')
  delivering,
  @JsonValue('delivered')
  delivered,
  @JsonValue('cancelled')
  cancelled,
}

@freezed
class Order with _$Order {
  const Order._();

  const factory Order({
    required String id,
    required String organizationId,
    required String customerId,
    required String orderNumber,
    required OrderStatus status,
    required double subtotal,
    @Default(0) double discount,
    @Default(0) double deliveryFee,
    required double totalAmount,
    @Default(0) double paidAmount,
    String? notes,
    String? adminNotes,
    DateTime? requestedDeliveryDate,
    String? requestedTimeSlot,
    required List<OrderLineItem> items,
    String? customerName,
    String? customerPhone,
    String? deliveryAddress,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _Order;

  factory Order.fromJson(Map<String, dynamic> json) => _$OrderFromJson(json);

  double get remainingAmount => totalAmount - paidAmount;
  bool get isPaid => paidAmount >= totalAmount;
  bool get isPartiallyPaid => paidAmount > 0 && paidAmount < totalAmount;

  int get totalItems => items.fold(0, (sum, item) => sum + item.quantity);

  String get statusLabel {
    switch (status) {
      case OrderStatus.draft:
        return 'Brouillon';
      case OrderStatus.pending:
        return 'En attente';
      case OrderStatus.confirmed:
        return 'Confirmée';
      case OrderStatus.preparing:
        return 'En préparation';
      case OrderStatus.ready:
        return 'Prête';
      case OrderStatus.delivering:
        return 'En livraison';
      case OrderStatus.delivered:
        return 'Livrée';
      case OrderStatus.cancelled:
        return 'Annulée';
    }
  }
}

@freezed
class OrderLineItem with _$OrderLineItem {
  const OrderLineItem._();

  const factory OrderLineItem({
    required String id,
    required String productId,
    required String productName,
    String? productSku,
    required int quantity,
    required double unitPrice,
    @Default(0) double discount,
    String? notes,
  }) = _OrderLineItem;

  factory OrderLineItem.fromJson(Map<String, dynamic> json) =>
      _$OrderLineItemFromJson(json);

  double get lineTotal => (quantity * unitPrice) - discount;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILISATEUR
// ═══════════════════════════════════════════════════════════════════════════════

enum UserRole {
  @JsonValue('admin')
  admin,
  @JsonValue('manager')
  manager,
  @JsonValue('deliverer')
  deliverer,
  @JsonValue('kitchen')
  kitchen,
  @JsonValue('customer')
  customer,
}

@freezed
class User with _$User {
  const User._();

  const factory User({
    required String id,
    required String organizationId,
    required String email,
    required String name,
    String? phone,
    required UserRole role,
    String? avatarUrl,
    @Default(true) bool isActive,
    DateTime? lastLoginAt,
    required DateTime createdAt,
  }) = _User;

  factory User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);

  bool get isAdmin => role == UserRole.admin;
  bool get isManager => role == UserRole.manager;
  bool get isDeliverer => role == UserRole.deliverer;
  bool get isKitchen => role == UserRole.kitchen;
  bool get isCustomer => role == UserRole.customer;

  String get roleLabel {
    switch (role) {
      case UserRole.admin:
        return 'Administrateur';
      case UserRole.manager:
        return 'Manager';
      case UserRole.deliverer:
        return 'Livreur';
      case UserRole.kitchen:
        return 'Cuisine';
      case UserRole.customer:
        return 'Client';
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORGANISATION
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class Organization with _$Organization {
  const factory Organization({
    required String id,
    required String name,
    String? logo,
    String? address,
    String? phone,
    String? email,
    String? taxId,
    String? registrationNumber,
    Map<String, dynamic>? settings,
    required DateTime createdAt,
  }) = _Organization;

  factory Organization.fromJson(Map<String, dynamic> json) =>
      _$OrganizationFromJson(json);
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTIQUES TABLEAU DE BORD
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class DashboardStats with _$DashboardStats {
  const factory DashboardStats({
    required TodayStats today,
    required MonthStats month,
    required TotalStats totals,
  }) = _DashboardStats;

  factory DashboardStats.fromJson(Map<String, dynamic> json) =>
      _$DashboardStatsFromJson(json);
}

@freezed
class TodayStats with _$TodayStats {
  const factory TodayStats({
    @Default(0) int orders,
    @Default(0) double revenue,
    @Default(0) int deliveries,
    @Default(0) int completedDeliveries,
    @Default(0) double collections,
  }) = _TodayStats;

  factory TodayStats.fromJson(Map<String, dynamic> json) =>
      _$TodayStatsFromJson(json);
}

@freezed
class MonthStats with _$MonthStats {
  const factory MonthStats({
    @Default(0) int orders,
    @Default(0) double revenue,
    @Default(0) int newCustomers,
    @Default(0) double averageOrderValue,
  }) = _MonthStats;

  factory MonthStats.fromJson(Map<String, dynamic> json) =>
      _$MonthStatsFromJson(json);
}

@freezed
class TotalStats with _$TotalStats {
  const factory TotalStats({
    @Default(0) double totalDebt,
    @Default(0) int activeCustomers,
    @Default(0) int activeProducts,
    @Default(0) int lowStockProducts,
  }) = _TotalStats;

  factory TotalStats.fromJson(Map<String, dynamic> json) =>
      _$TotalStatsFromJson(json);
}
