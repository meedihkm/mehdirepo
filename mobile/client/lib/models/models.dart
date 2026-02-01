// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - MODÈLES APP CLIENT
// Synchronisés avec le schéma backend
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:freezed_annotation/freezed_annotation.dart';

part 'models.freezed.dart';
part 'models.g.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════════

enum OrderStatus {
  draft,
  pending,
  confirmed,
  preparing,
  ready,
  assigned,
  inDelivery,
  delivered,
  cancelled,
}

enum PaymentStatus {
  unpaid,
  partial,
  paid,
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILISATEUR CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class CustomerUser with _$CustomerUser {
  const factory CustomerUser({
    required String id,
    required String customerId,
    required String phone,
    required String name,
    String? email,
    String? organizationName,
    String? organizationLogo,
    double? currentDebt,
    double? creditLimit,
    String? token,
  }) = _CustomerUser;

  factory CustomerUser.fromJson(Map<String, dynamic> json) =>
      _$CustomerUserFromJson(json);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATÉGORIE
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class Category with _$Category {
  const factory Category({
    required String id,
    required String name,
    String? slug,
    String? icon,
    String? color,
    int? sortOrder,
  }) = _Category;

  factory Category.fromJson(Map<String, dynamic> json) =>
      _$CategoryFromJson(json);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUIT
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class Product with _$Product {
  const factory Product({
    required String id,
    required String name,
    String? description,
    required double price,
    String? unit,
    double? unitQuantity,
    String? categoryId,
    String? imageUrl,
    String? thumbnailUrl,
    bool? isAvailable,
    bool? isFeatured,
    int? sortOrder,
    // Prix personnalisé pour ce client
    double? customPrice,
  }) = _Product;

  factory Product.fromJson(Map<String, dynamic> json) =>
      _$ProductFromJson(json);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ARTICLE DE PANIER
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class CartItem with _$CartItem {
  const factory CartItem({
    required String productId,
    required String productName,
    required double price,
    required double quantity,
    String? unit,
    String? imageUrl,
    String? notes,
  }) = _CartItem;

  factory CartItem.fromJson(Map<String, dynamic> json) =>
      _$CartItemFromJson(json);
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMANDE
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class Order with _$Order {
  const factory Order({
    required String id,
    required String orderNumber,
    required OrderStatus status,
    required PaymentStatus paymentStatus,
    required double subtotal,
    double? discountAmount,
    required double total,
    double? amountPaid,
    double? amountDue,
    required List<OrderItem> items,
    DateTime? deliveryDate,
    String? deliveryTimeSlot,
    String? deliveryAddress,
    String? deliveryNotes,
    String? notes,
    DateTime? confirmedAt,
    DateTime? deliveredAt,
    required DateTime createdAt,
    DateTime? updatedAt,
  }) = _Order;

  factory Order.fromJson(Map<String, dynamic> json) => _$OrderFromJson(json);
}

@freezed
class OrderItem with _$OrderItem {
  const factory OrderItem({
    required String id,
    required String productId,
    required String productName,
    String? productSku,
    required double quantity,
    required double unitPrice,
    required double totalPrice,
    String? unit,
    String? notes,
  }) = _OrderItem;

  factory OrderItem.fromJson(Map<String, dynamic> json) =>
      _$OrderItemFromJson(json);
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUÊTES
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class CreateOrderRequest with _$CreateOrderRequest {
  const factory CreateOrderRequest({
    required List<OrderItemRequest> items,
    DateTime? deliveryDate,
    String? deliveryTimeSlot,
    String? deliveryAddress,
    String? deliveryNotes,
    String? notes,
  }) = _CreateOrderRequest;

  factory CreateOrderRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateOrderRequestFromJson(json);
}

@freezed
class OrderItemRequest with _$OrderItemRequest {
  const factory OrderItemRequest({
    required String productId,
    required double quantity,
    String? notes,
  }) = _OrderItemRequest;

  factory OrderItemRequest.fromJson(Map<String, dynamic> json) =>
      _$OrderItemRequestFromJson(json);
}

// ═══════════════════════════════════════════════════════════════════════════════
// HISTORIQUE / TRANSACTION
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class Transaction with _$Transaction {
  const factory Transaction({
    required String id,
    required String type, // 'order', 'payment'
    required DateTime date,
    String? orderNumber,
    double? orderAmount,
    double? paymentAmount,
    String? paymentMode,
    String? description,
    double? balanceAfter,
  }) = _Transaction;

  factory Transaction.fromJson(Map<String, dynamic> json) =>
      _$TransactionFromJson(json);
}

// ═══════════════════════════════════════════════════════════════════════════════
// RELEVÉ DE COMPTE
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class Statement with _$Statement {
  const factory Statement({
    required DateTime startDate,
    required DateTime endDate,
    required double openingBalance,
    required double closingBalance,
    required double totalOrders,
    required double totalPayments,
    required List<Transaction> transactions,
  }) = _Statement;

  factory Statement.fromJson(Map<String, dynamic> json) =>
      _$StatementFromJson(json);
}

// ═══════════════════════════════════════════════════════════════════════════════
// OTP
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class OtpRequest with _$OtpRequest {
  const factory OtpRequest({
    required String phone,
  }) = _OtpRequest;

  factory OtpRequest.fromJson(Map<String, dynamic> json) =>
      _$OtpRequestFromJson(json);
}

@freezed
class OtpVerifyRequest with _$OtpVerifyRequest {
  const factory OtpVerifyRequest({
    required String phone,
    required String otp,
    String? deviceId,
  }) = _OtpVerifyRequest;

  factory OtpVerifyRequest.fromJson(Map<String, dynamic> json) =>
      _$OtpVerifyRequestFromJson(json);
}

@freezed
class AuthResponse with _$AuthResponse {
  const factory AuthResponse({
    required String accessToken,
    String? refreshToken,
    required CustomerUser user,
  }) = _AuthResponse;

  factory AuthResponse.fromJson(Map<String, dynamic> json) =>
      _$AuthResponseFromJson(json);
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class AppNotification with _$AppNotification {
  const factory AppNotification({
    required String id,
    required String type,
    required String title,
    required String body,
    Map<String, dynamic>? data,
    bool? isRead,
    DateTime? createdAt,
  }) = _AppNotification;

  factory AppNotification.fromJson(Map<String, dynamic> json) =>
      _$AppNotificationFromJson(json);
}
