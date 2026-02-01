// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - PROVIDER LIVRAISONS (App Livreur)
// Gestion de la tournée, livraisons, encaissements
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:collection/collection.dart';

import '../api/api_client.dart';
import '../models/delivery.dart';
import '../database/local_database.dart';
import 'sync_provider.dart';

part 'delivery_provider.freezed.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// ÉTAT DE LA TOURNÉE
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class RouteState with _$RouteState {
  const factory RouteState({
    @Default([]) List<Delivery> deliveries,
    @Default(false) bool isLoading,
    @Default(false) bool isRefreshing,
    String? error,
    DateTime? lastUpdated,
  }) = _RouteState;
}

extension RouteStateX on RouteState {
  List<Delivery> get pendingDeliveries =>
      deliveries.where((d) => !d.isCompleted && !d.isFailed).toList();

  List<Delivery> get completedDeliveries =>
      deliveries.where((d) => d.isCompleted || d.isFailed).toList();

  int get totalDeliveries => deliveries.length;
  int get completedCount => completedDeliveries.length;
  int get pendingCount => pendingDeliveries.length;

  double get totalToCollect =>
      deliveries.fold(0, (sum, d) => sum + d.amountToCollect);

  double get totalCollected =>
      deliveries.fold(0, (sum, d) => sum + d.amountCollected);

  double get progressPercent =>
      totalDeliveries > 0 ? completedCount / totalDeliveries : 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFIER DE TOURNÉE
// ═══════════════════════════════════════════════════════════════════════════════

class RouteNotifier extends StateNotifier<RouteState> {
  final ApiClient _api;
  final LocalDatabase _db;
  final Ref _ref;

  RouteNotifier(this._api, this._db, this._ref) : super(const RouteState());

  /// Charger la tournée du jour
  Future<void> loadTodayRoute({bool forceRefresh = false}) async {
    if (state.isLoading) return;

    state = state.copyWith(
      isLoading: !state.deliveries.isNotEmpty,
      isRefreshing: state.deliveries.isNotEmpty,
      error: null,
    );

    try {
      // D'abord charger depuis le cache local
      if (!forceRefresh) {
        final localDeliveries = await _db.getTodayDeliveries();
        if (localDeliveries.isNotEmpty) {
          state = state.copyWith(
            deliveries: localDeliveries,
            isLoading: false,
          );
        }
      }

      // Puis synchroniser avec le serveur
      final response = await _api.get('/deliveries/my-route');
      final deliveries = (response as List)
          .map((json) => Delivery.fromJson(json))
          .toList();

      // Sauvegarder en local
      await _db.saveDeliveries(deliveries);

      state = state.copyWith(
        deliveries: deliveries,
        isLoading: false,
        isRefreshing: false,
        lastUpdated: DateTime.now(),
      );
    } on ApiException catch (e) {
      // En cas d'erreur, garder les données locales
      if (state.deliveries.isEmpty) {
        final localDeliveries = await _db.getTodayDeliveries();
        state = state.copyWith(
          deliveries: localDeliveries,
          isLoading: false,
          isRefreshing: false,
          error: e.message,
        );
      } else {
        state = state.copyWith(
          isLoading: false,
          isRefreshing: false,
          error: e.message,
        );
      }
    }
  }

  /// Récupérer une livraison par ID
  Delivery? getDeliveryById(String id) {
    return state.deliveries.firstWhereOrNull((d) => d.id == id);
  }

  /// Mettre à jour le statut d'une livraison
  Future<void> updateDeliveryStatus(String deliveryId, DeliveryStatus status) async {
    try {
      await _api.put('/deliveries/$deliveryId/status', data: {
        'status': status.name,
      });

      // Mettre à jour localement
      final updatedDeliveries = state.deliveries.map((d) {
        if (d.id == deliveryId) {
          return d.copyWith(status: status);
        }
        return d;
      }).toList();

      state = state.copyWith(deliveries: updatedDeliveries);
    } on ApiException catch (e) {
      // Ajouter à la queue offline si pas de connexion
      if (e.code == 'NO_CONNECTION') {
        await _ref.read(syncProvider.notifier).queueTransaction(
          PendingTransaction(
            id: DateTime.now().millisecondsSinceEpoch.toString(),
            type: 'delivery_status',
            data: {'deliveryId': deliveryId, 'status': status.name},
            createdAt: DateTime.now(),
          ),
        );
      }
      rethrow;
    }
  }

  /// Compléter une livraison avec encaissement
  Future<DeliveryCompletionResult> completeDelivery({
    required String deliveryId,
    required double amountCollected,
    required String collectionMode,
    String? signatureData,
    String? signatureName,
    List<String>? photoUrls,
    String? notes,
    bool printReceipt = true,
    bool printDeliveryNote = false,
  }) async {
    final delivery = getDeliveryById(deliveryId);
    if (delivery == null) {
      throw ApiException(code: 'NOT_FOUND', message: 'Livraison introuvable');
    }

    try {
      final response = await _api.put('/deliveries/$deliveryId/complete', data: {
        'amountCollected': amountCollected,
        'collectionMode': collectionMode,
        if (signatureData != null) 'signatureData': signatureData,
        if (signatureName != null) 'signatureName': signatureName,
        if (photoUrls != null) 'proofPhotos': photoUrls,
        if (notes != null) 'notes': notes,
        'printReceipt': printReceipt,
        'printDeliveryNote': printDeliveryNote,
      });

      final result = DeliveryCompletionResult.fromJson(response);

      // Mettre à jour localement
      final updatedDeliveries = state.deliveries.map((d) {
        if (d.id == deliveryId) {
          return d.copyWith(
            status: DeliveryStatus.delivered,
            amountCollected: amountCollected,
            completedAt: DateTime.now(),
          );
        }
        return d;
      }).toList();

      state = state.copyWith(deliveries: updatedDeliveries);

      // Sauvegarder en local
      await _db.updateDelivery(deliveryId, {
        'status': 'delivered',
        'amountCollected': amountCollected,
        'completedAt': DateTime.now().toIso8601String(),
      });

      return result;
    } on ApiException catch (e) {
      // Mode offline: sauvegarder la transaction pour sync ultérieur
      if (e.code == 'NO_CONNECTION') {
        final transaction = PendingTransaction(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          type: 'complete_delivery',
          data: {
            'deliveryId': deliveryId,
            'amountCollected': amountCollected,
            'collectionMode': collectionMode,
            'signatureData': signatureData,
            'signatureName': signatureName,
            'proofPhotos': photoUrls,
            'notes': notes,
          },
          createdAt: DateTime.now(),
        );

        await _ref.read(syncProvider.notifier).queueTransaction(transaction);

        // Mettre à jour localement en mode optimiste
        final updatedDeliveries = state.deliveries.map((d) {
          if (d.id == deliveryId) {
            return d.copyWith(
              status: DeliveryStatus.delivered,
              amountCollected: amountCollected,
              completedAt: DateTime.now(),
            );
          }
          return d;
        }).toList();

        state = state.copyWith(deliveries: updatedDeliveries);

        // Retourner un résultat estimé
        return DeliveryCompletionResult(
          paymentId: 'pending_${transaction.id}',
          receiptNumber: 'PENDING',
          breakdown: PaymentBreakdown(
            appliedToOrder: delivery.order.totalAmount,
            appliedToDebt: 0,
            newDebtCreated: delivery.order.totalAmount - amountCollected,
          ),
          customerDebtAfter: delivery.customer.currentDebt +
              delivery.order.totalAmount -
              amountCollected,
          isPending: true,
        );
      }
      rethrow;
    }
  }

  /// Marquer une livraison comme échouée
  Future<void> failDelivery({
    required String deliveryId,
    required String reason,
    String? notes,
  }) async {
    try {
      await _api.put('/deliveries/$deliveryId/fail', data: {
        'reason': reason,
        if (notes != null) 'notes': notes,
      });

      // Mettre à jour localement
      final updatedDeliveries = state.deliveries.map((d) {
        if (d.id == deliveryId) {
          return d.copyWith(
            status: DeliveryStatus.failed,
            failReason: reason,
            failedAt: DateTime.now(),
          );
        }
        return d;
      }).toList();

      state = state.copyWith(deliveries: updatedDeliveries);

      await _db.updateDelivery(deliveryId, {
        'status': 'failed',
        'failReason': reason,
        'failedAt': DateTime.now().toIso8601String(),
      });
    } on ApiException catch (e) {
      if (e.code == 'NO_CONNECTION') {
        await _ref.read(syncProvider.notifier).queueTransaction(
          PendingTransaction(
            id: DateTime.now().millisecondsSinceEpoch.toString(),
            type: 'fail_delivery',
            data: {
              'deliveryId': deliveryId,
              'reason': reason,
              'notes': notes,
            },
            createdAt: DateTime.now(),
          ),
        );

        // Mise à jour optimiste
        final updatedDeliveries = state.deliveries.map((d) {
          if (d.id == deliveryId) {
            return d.copyWith(
              status: DeliveryStatus.failed,
              failReason: reason,
              failedAt: DateTime.now(),
            );
          }
          return d;
        }).toList();

        state = state.copyWith(deliveries: updatedDeliveries);
      } else {
        rethrow;
      }
    }
  }

  /// Optimiser l'ordre de la tournée
  Future<void> optimizeRoute() async {
    try {
      final response = await _api.put('/deliveries/optimize');
      final deliveries = (response['deliveries'] as List)
          .map((json) => Delivery.fromJson(json))
          .toList();

      state = state.copyWith(deliveries: deliveries);
      await _db.saveDeliveries(deliveries);
    } on ApiException catch (e) {
      state = state.copyWith(error: e.message);
    }
  }

  /// Réordonner manuellement
  void reorderDeliveries(int oldIndex, int newIndex) {
    final deliveries = [...state.deliveries];
    final item = deliveries.removeAt(oldIndex);
    deliveries.insert(newIndex, item);

    // Mettre à jour les numéros de séquence
    final reordered = deliveries.asMap().entries.map((entry) {
      return entry.value.copyWith(sequenceNumber: entry.key + 1);
    }).toList();

    state = state.copyWith(deliveries: reordered);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════

final routeProvider = StateNotifierProvider<RouteNotifier, RouteState>((ref) {
  final api = ref.watch(apiClientProvider);
  final db = ref.watch(localDatabaseProvider);
  return RouteNotifier(api, db, ref);
});

/// Provider pour une livraison spécifique
final deliveryProvider = Provider.family<Delivery?, String>((ref, id) {
  final state = ref.watch(routeProvider);
  return state.deliveries.firstWhereOrNull((d) => d.id == id);
});

/// Provider pour les stats de la tournée
final routeStatsProvider = Provider<RouteStats>((ref) {
  final state = ref.watch(routeProvider);
  return RouteStats(
    total: state.totalDeliveries,
    completed: state.completedCount,
    pending: state.pendingCount,
    totalToCollect: state.totalToCollect,
    totalCollected: state.totalCollected,
    progress: state.progressPercent,
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// MODÈLES SUPPLÉMENTAIRES
// ═══════════════════════════════════════════════════════════════════════════════

class RouteStats {
  final int total;
  final int completed;
  final int pending;
  final double totalToCollect;
  final double totalCollected;
  final double progress;

  RouteStats({
    required this.total,
    required this.completed,
    required this.pending,
    required this.totalToCollect,
    required this.totalCollected,
    required this.progress,
  });
}

class DeliveryCompletionResult {
  final String paymentId;
  final String receiptNumber;
  final PaymentBreakdown breakdown;
  final double customerDebtAfter;
  final String? receiptUrl;
  final String? deliveryNoteUrl;
  final bool isPending;

  DeliveryCompletionResult({
    required this.paymentId,
    required this.receiptNumber,
    required this.breakdown,
    required this.customerDebtAfter,
    this.receiptUrl,
    this.deliveryNoteUrl,
    this.isPending = false,
  });

  factory DeliveryCompletionResult.fromJson(Map<String, dynamic> json) {
    return DeliveryCompletionResult(
      paymentId: json['payment']['id'],
      receiptNumber: json['payment']['receiptNumber'],
      breakdown: PaymentBreakdown.fromJson(json['breakdown']),
      customerDebtAfter: (json['customer']['newDebt'] as num).toDouble(),
      receiptUrl: json['printUrls']?['receipt'],
      deliveryNoteUrl: json['printUrls']?['deliveryNote'],
    );
  }
}

class PaymentBreakdown {
  final double appliedToOrder;
  final double appliedToDebt;
  final double newDebtCreated;

  PaymentBreakdown({
    required this.appliedToOrder,
    required this.appliedToDebt,
    required this.newDebtCreated,
  });

  factory PaymentBreakdown.fromJson(Map<String, dynamic> json) {
    return PaymentBreakdown(
      appliedToOrder: (json['appliedToOrder'] as num).toDouble(),
      appliedToDebt: (json['appliedToDebt'] as num).toDouble(),
      newDebtCreated: (json['newDebtCreated'] as num).toDouble(),
    );
  }
}

// Placeholder pour le local database provider
final localDatabaseProvider = Provider<LocalDatabase>((ref) {
  throw UnimplementedError('LocalDatabase must be overridden');
});

// Placeholder pour LocalDatabase
abstract class LocalDatabase {
  Future<List<Delivery>> getTodayDeliveries();
  Future<void> saveDeliveries(List<Delivery> deliveries);
  Future<void> updateDelivery(String id, Map<String, dynamic> data);
}
