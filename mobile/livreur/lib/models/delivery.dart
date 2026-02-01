// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - MODÈLES LIVRAISON
// Synchronisés avec le schéma backend
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:freezed_annotation/freezed_annotation.dart';

part 'delivery.freezed.dart';
part 'delivery.g.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════════

enum DeliveryStatus {
  pending,
  assigned,
  pickedUp,
  inTransit,
  arrived,
  delivered,
  failed,
  returned,
}

enum PaymentMode {
  cash,
  check,
  bankTransfer,
  mobilePayment,
}

// ═══════════════════════════════════════════════════════════════════════════════
// COORDONNÉES
// ═══════════════════════════════════════════════════════════════════════════════

@JsonSerializable()
class Coordinates {
  final double lat;
  final double lng;
  final double? accuracy;

  const Coordinates({
    required this.lat,
    required this.lng,
    this.accuracy,
  });

  factory Coordinates.fromJson(Map<String, dynamic> json) =>
      _$CoordinatesFromJson(json);

  Map<String, dynamic> toJson() => _$CoordinatesToJson(this);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ARTICLE DE COMMANDE
// ═══════════════════════════════════════════════════════════════════════════════

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
// CLIENT (Simplifié pour livreur)
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class CustomerInfo with _$CustomerInfo {
  const factory CustomerInfo({
    required String id,
    required String name,
    required String phone,
    String? phoneSecondary,
    required String address,
    String? city,
    String? zone,
    Coordinates? coordinates,
    required double currentDebt,
    required double creditLimit,
    bool? creditLimitEnabled,
    String? deliveryNotes,
    Map<String, double>? customPrices,
  }) = _CustomerInfo;

  factory CustomerInfo.fromJson(Map<String, dynamic> json) =>
      _$CustomerInfoFromJson(json);
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMANDE (Simplifiée pour livreur)
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class OrderInfo with _$OrderInfo {
  const factory OrderInfo({
    required String id,
    required String orderNumber,
    required String status,
    required String paymentStatus,
    required double subtotal,
    required double total,
    double? discountAmount,
    double? amountPaid,
    double? amountDue,
    required CustomerInfo customer,
    required List<OrderItem> items,
    DateTime? deliveryDate,
    String? deliveryTimeSlot,
    String? deliveryAddress,
    String? deliveryNotes,
    String? notes,
    DateTime? createdAt,
  }) = _OrderInfo;

  factory OrderInfo.fromJson(Map<String, dynamic> json) =>
      _$OrderInfoFromJson(json);
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIVRAISON - Modèle principal
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class Delivery with _$Delivery {
  const factory Delivery({
    required String id,
    required String organizationId,
    required String orderId,
    required String delivererId,
    required DeliveryStatus status,
    required DateTime scheduledDate,
    String? scheduledTime,
    int? sequenceNumber,
    int? priority,
    required double orderAmount,
    required double existingDebt,
    required double totalToCollect,
    double? amountCollected,
    PaymentMode? collectionMode,
    DateTime? assignedAt,
    DateTime? pickedUpAt,
    DateTime? arrivedAt,
    DateTime? completedAt,
    ProofOfDelivery? proofOfDelivery,
    String? failureReason,
    double? estimatedDistanceKm,
    int? estimatedDurationMin,
    String? notes,
    required DateTime createdAt,
    DateTime? updatedAt,
    // Relations
    OrderInfo? order,
    CustomerInfo? customer,
  }) = _Delivery;

  factory Delivery.fromJson(Map<String, dynamic> json) =>
      _$DeliveryFromJson(json);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PREUVE DE LIVRAISON
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class ProofOfDelivery with _$ProofOfDelivery {
  const factory ProofOfDelivery({
    String? signatureData,
    String? signatureName,
    List<DeliveryPhoto>? photos,
    Coordinates? location,
  }) = _ProofOfDelivery;

  factory ProofOfDelivery.fromJson(Map<String, dynamic> json) =>
      _$ProofOfDeliveryFromJson(json);
}

@freezed
class DeliveryPhoto with _$DeliveryPhoto {
  const factory DeliveryPhoto({
    required String data,
    required String type, // 'product', 'location', 'receipt'
    DateTime? takenAt,
  }) = _DeliveryPhoto;

  factory DeliveryPhoto.fromJson(Map<String, dynamic> json) =>
      _$DeliveryPhotoFromJson(json);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAISSE JOURNALIÈRE
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class DailyCash with _$DailyCash {
  const factory DailyCash({
    required String id,
    required String organizationId,
    required String delivererId,
    required DateTime date,
    required double expectedCollection,
    required double actualCollection,
    required double newDebtCreated,
    required int deliveriesTotal,
    required int deliveriesCompleted,
    required int deliveriesFailed,
    required bool isClosed,
    DateTime? closedAt,
    String? closedBy,
    double? cashHandedOver,
    double? discrepancy,
    String? discrepancyNotes,
    required DateTime createdAt,
    DateTime? updatedAt,
  }) = _DailyCash;

  factory DailyCash.fromJson(Map<String, dynamic> json) =>
      _$DailyCashFromJson(json);
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUÊTES/RÉPONSES API
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class CompleteDeliveryRequest with _$CompleteDeliveryRequest {
  const factory CompleteDeliveryRequest({
    required double amountCollected,
    @Default(PaymentMode.cash) PaymentMode collectionMode,
    String? notes,
    SignatureInfo? signature,
    List<DeliveryPhoto>? photos,
    Coordinates? location,
  }) = _CompleteDeliveryRequest;

  factory CompleteDeliveryRequest.fromJson(Map<String, dynamic> json) =>
      _$CompleteDeliveryRequestFromJson(json);
}

@freezed
class SignatureInfo with _$SignatureInfo {
  const factory SignatureInfo({
    required String data,
    required String name,
  }) = _SignatureInfo;

  factory SignatureInfo.fromJson(Map<String, dynamic> json) =>
      _$SignatureInfoFromJson(json);
}

@freezed
class FailDeliveryRequest with _$FailDeliveryRequest {
  const factory FailDeliveryRequest({
    required String reason,
    Coordinates? location,
  }) = _FailDeliveryRequest;

  factory FailDeliveryRequest.fromJson(Map<String, dynamic> json) =>
      _$FailDeliveryRequestFromJson(json);
}

@freezed
class CollectDebtRequest with _$CollectDebtRequest {
  const factory CollectDebtRequest({
    required String customerId,
    required double amount,
    @Default(PaymentMode.cash) PaymentMode collectionMode,
    String? notes,
  }) = _CollectDebtRequest;

  factory CollectDebtRequest.fromJson(Map<String, dynamic> json) =>
      _$CollectDebtRequestFromJson(json);
}

@freezed
class DeliveryCompletionResult with _$DeliveryCompletionResult {
  const factory DeliveryCompletionResult({
    required Delivery delivery,
    required TransactionDetail transaction,
    required CustomerSummary customer,
    PrintUrls? printUrls,
  }) = _DeliveryCompletionResult;

  factory DeliveryCompletionResult.fromJson(Map<String, dynamic> json) =>
      _$DeliveryCompletionResultFromJson(json);
}

@freezed
class TransactionDetail with _$TransactionDetail {
  const factory TransactionDetail({
    required double orderAmount,
    required double debtBefore,
    required double amountPaid,
    required double appliedToOrder,
    required double appliedToDebt,
    required double newDebtCreated,
    required double debtAfter,
  }) = _TransactionDetail;

  factory TransactionDetail.fromJson(Map<String, dynamic> json) =>
      _$TransactionDetailFromJson(json);
}

@freezed
class CustomerSummary with _$CustomerSummary {
  const factory CustomerSummary({
    required String id,
    required String name,
    required double currentDebt,
    required double creditLimit,
  }) = _CustomerSummary;

  factory CustomerSummary.fromJson(Map<String, dynamic> json) =>
      _$CustomerSummaryFromJson(json);
}

@freezed
class PrintUrls with _$PrintUrls {
  const factory PrintUrls({
    String? receiptUrl,
    String? deliveryUrl,
  }) = _PrintUrls;

  factory PrintUrls.fromJson(Map<String, dynamic> json) =>
      _$PrintUrlsFromJson(json);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYNCHRONISATION OFFLINE
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class PendingTransaction with _$PendingTransaction {
  const factory PendingTransaction({
    required String id,
    required String type, // 'delivery_complete', 'delivery_fail', 'payment', 'debt_collection'
    required Map<String, dynamic> data,
    required DateTime createdAt,
    int retryCount,
    String? errorMessage,
  }) = _PendingTransaction;

  factory PendingTransaction.fromJson(Map<String, dynamic> json) =>
      _$PendingTransactionFromJson(json);
}

@freezed
class SyncStatus with _$SyncStatus {
  const factory SyncStatus({
    DateTime? lastSyncAt,
    required int pendingCount,
    required bool isOnline,
    String? lastError,
  }) = _SyncStatus;

  factory SyncStatus.fromJson(Map<String, dynamic> json) =>
      _$SyncStatusFromJson(json);
}
