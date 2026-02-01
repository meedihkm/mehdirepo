// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - MODÈLE DELIVERY
// Représentation d'une livraison avec Freezed
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:freezed_annotation/freezed_annotation.dart';

part 'delivery.freezed.dart';
part 'delivery.g.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// ÉNUMÉRATIONS
// ═══════════════════════════════════════════════════════════════════════════════

enum DeliveryStatus {
  @JsonValue('pending')
  pending,
  @JsonValue('assigned')
  assigned,
  @JsonValue('in_transit')
  inTransit,
  @JsonValue('delivered')
  delivered,
  @JsonValue('failed')
  failed,
}

enum CollectionMode {
  @JsonValue('cash')
  cash,
  @JsonValue('check')
  check,
  @JsonValue('ccp')
  ccp,
  @JsonValue('bank_transfer')
  bankTransfer,
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODÈLE DELIVERY
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class Delivery with _$Delivery {
  const Delivery._();

  const factory Delivery({
    required String id,
    required String organizationId,
    required String orderId,
    required String customerId,
    String? delivererId,
    required int sequenceNumber,
    required DeliveryStatus status,
    required DateTime deliveryDate,
    String? scheduledTimeSlot,
    DateTime? startedAt,
    DateTime? completedAt,
    DateTime? failedAt,
    String? failReason,
    @Default(0) double amountToCollect,
    @Default(0) double amountCollected,
    CollectionMode? collectionMode,
    String? signatureData,
    String? signatureName,
    @Default([]) List<String> proofPhotos,
    String? notes,
    String? adminNotes,
    DeliveryLocation? location,
    required DeliveryOrder order,
    required DeliveryCustomer customer,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _Delivery;

  factory Delivery.fromJson(Map<String, dynamic> json) =>
      _$DeliveryFromJson(json);

  // Computed properties
  bool get isCompleted => status == DeliveryStatus.delivered;
  bool get isFailed => status == DeliveryStatus.failed;
  bool get isPending =>
      status == DeliveryStatus.pending || status == DeliveryStatus.assigned;
  bool get isInProgress => status == DeliveryStatus.inTransit;

  bool get canStart => status == DeliveryStatus.assigned;
  bool get canComplete => status == DeliveryStatus.inTransit;
  bool get canFail =>
      status == DeliveryStatus.assigned || status == DeliveryStatus.inTransit;

  double get remainingAmount => amountToCollect - amountCollected;
  bool get isFullyPaid => amountCollected >= amountToCollect;

  String get statusLabel {
    switch (status) {
      case DeliveryStatus.pending:
        return 'En attente';
      case DeliveryStatus.assigned:
        return 'Assignée';
      case DeliveryStatus.inTransit:
        return 'En cours';
      case DeliveryStatus.delivered:
        return 'Livrée';
      case DeliveryStatus.failed:
        return 'Échouée';
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODÈLE LOCATION
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class DeliveryLocation with _$DeliveryLocation {
  const factory DeliveryLocation({
    required double latitude,
    required double longitude,
    double? accuracy,
    DateTime? recordedAt,
  }) = _DeliveryLocation;

  factory DeliveryLocation.fromJson(Map<String, dynamic> json) =>
      _$DeliveryLocationFromJson(json);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODÈLE ORDER SIMPLIFIÉ
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class DeliveryOrder with _$DeliveryOrder {
  const factory DeliveryOrder({
    required String id,
    required String orderNumber,
    required double totalAmount,
    required double paidAmount,
    required String status,
    String? notes,
    required List<OrderItem> items,
    required DateTime createdAt,
  }) = _DeliveryOrder;

  factory DeliveryOrder.fromJson(Map<String, dynamic> json) =>
      _$DeliveryOrderFromJson(json);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODÈLE ORDER ITEM
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class OrderItem with _$OrderItem {
  const OrderItem._();

  const factory OrderItem({
    required String id,
    required String productId,
    required String productName,
    String? productSku,
    required int quantity,
    required double unitPrice,
    @Default(0) double discount,
    String? notes,
  }) = _OrderItem;

  factory OrderItem.fromJson(Map<String, dynamic> json) =>
      _$OrderItemFromJson(json);

  double get lineTotal => (quantity * unitPrice) - discount;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODÈLE CUSTOMER SIMPLIFIÉ
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class DeliveryCustomer with _$DeliveryCustomer {
  const DeliveryCustomer._();

  const factory DeliveryCustomer({
    required String id,
    required String name,
    required String phone,
    String? phone2,
    required String address,
    String? addressComplement,
    String? city,
    double? latitude,
    double? longitude,
    @Default(0) double currentDebt,
    double? creditLimit,
    @Default(true) bool creditLimitEnabled,
    String? notes,
  }) = _DeliveryCustomer;

  factory DeliveryCustomer.fromJson(Map<String, dynamic> json) =>
      _$DeliveryCustomerFromJson(json);

  bool get hasLocation => latitude != null && longitude != null;

  bool get isOverCreditLimit {
    if (!creditLimitEnabled || creditLimit == null) return false;
    return currentDebt >= creditLimit!;
  }

  double get availableCredit {
    if (!creditLimitEnabled || creditLimit == null) return double.infinity;
    return creditLimit! - currentDebt;
  }

  String get fullAddress {
    final parts = [address];
    if (addressComplement != null && addressComplement!.isNotEmpty) {
      parts.add(addressComplement!);
    }
    if (city != null && city!.isNotEmpty) {
      parts.add(city!);
    }
    return parts.join(', ');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODÈLE RÉSULTAT COMPLÉTION
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class DeliveryCompletionData with _$DeliveryCompletionData {
  const factory DeliveryCompletionData({
    required double amountCollected,
    required CollectionMode collectionMode,
    String? signatureData,
    String? signatureName,
    @Default([]) List<String> proofPhotos,
    String? notes,
    @Default(true) bool printReceipt,
    @Default(false) bool printDeliveryNote,
  }) = _DeliveryCompletionData;

  factory DeliveryCompletionData.fromJson(Map<String, dynamic> json) =>
      _$DeliveryCompletionDataFromJson(json);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODÈLE ÉCHEC LIVRAISON
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class DeliveryFailureData with _$DeliveryFailureData {
  const factory DeliveryFailureData({
    required String reason,
    String? notes,
    DeliveryLocation? location,
  }) = _DeliveryFailureData;

  factory DeliveryFailureData.fromJson(Map<String, dynamic> json) =>
      _$DeliveryFailureDataFromJson(json);
}

// Raisons d'échec prédéfinies
class FailureReasons {
  static const String customerAbsent = 'customer_absent';
  static const String addressNotFound = 'address_not_found';
  static const String customerRefused = 'customer_refused';
  static const String wrongProducts = 'wrong_products';
  static const String damagedProducts = 'damaged_products';
  static const String paymentIssue = 'payment_issue';
  static const String accessIssue = 'access_issue';
  static const String other = 'other';

  static String getLabel(String reason) {
    switch (reason) {
      case customerAbsent:
        return 'Client absent';
      case addressNotFound:
        return 'Adresse introuvable';
      case customerRefused:
        return 'Refus du client';
      case wrongProducts:
        return 'Produits incorrects';
      case damagedProducts:
        return 'Produits endommagés';
      case paymentIssue:
        return 'Problème de paiement';
      case accessIssue:
        return 'Problème d\'accès';
      case other:
        return 'Autre';
      default:
        return reason;
    }
  }

  static List<String> get all => [
        customerAbsent,
        addressNotFound,
        customerRefused,
        wrongProducts,
        damagedProducts,
        paymentIssue,
        accessIssue,
        other,
      ];
}
