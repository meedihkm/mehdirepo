// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - ORDER PROVIDER
// Gestion des commandes clients
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/models.dart';
import 'providers.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════

/// Provider pour les commandes récentes (5 dernières)
final recentOrdersProvider = FutureProvider<List<Order>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.getOrders(limit: 5);

  if (response.success && response.data != null) {
    return response.data!;
  }

  throw Exception(response.errorMessage ?? 'Erreur de chargement');
});

/// Provider pour les commandes en cours
final ordersInProgressProvider = FutureProvider<List<Order>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.getOrders(
    statuses: [
      OrderStatus.pending,
      OrderStatus.confirmed,
      OrderStatus.preparing,
      OrderStatus.ready,
      OrderStatus.assigned,
      OrderStatus.inDelivery,
    ],
  );

  if (response.success && response.data != null) {
    return response.data!;
  }

  throw Exception(response.errorMessage ?? 'Erreur de chargement');
});

/// Provider pour le détail d'une commande
final orderDetailProvider = FutureProvider.family<Order, String>((ref, orderId) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.getOrder(orderId);

  if (response.success && response.data != null) {
    return response.data!;
  }

  throw Exception(response.errorMessage ?? 'Commande non trouvée');
});

/// Notifier pour la gestion des commandes
final orderProvider = StateNotifierProvider<OrderNotifier, AsyncValue<void>>((ref) {
  return OrderNotifier(ref);
});

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFIER
// ═══════════════════════════════════════════════════════════════════════════════

class OrderNotifier extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;

  OrderNotifier(this._ref) : super(const AsyncValue.data(null));

  /// Créer une nouvelle commande
  Future<Order> createOrder({
    required List<OrderItemRequest> items,
    DateTime? deliveryDate,
    String? deliveryTimeSlot,
    String? deliveryAddress,
    String? deliveryNotes,
    String? notes,
  }) async {
    state = const AsyncValue.loading();

    try {
      final api = _ref.read(apiServiceProvider);

      final request = CreateOrderRequest(
        items: items,
        deliveryDate: deliveryDate,
        deliveryTimeSlot: deliveryTimeSlot,
        deliveryAddress: deliveryAddress,
        deliveryNotes: deliveryNotes,
        notes: notes,
      );

      final response = await api.createOrder(request);

      if (response.success && response.data != null) {
        state = const AsyncValue.data(null);
        return response.data!;
      } else {
        throw Exception(response.errorMessage ?? 'Erreur lors de la création');
      }
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
      rethrow;
    }
  }

  /// Dupliquer une commande existante
  Future<Order> duplicateOrder(String orderId) async {
    state = const AsyncValue.loading();

    try {
      final api = _ref.read(apiServiceProvider);
      final response = await api.duplicateOrder(orderId);

      if (response.success && response.data != null) {
        state = const AsyncValue.data(null);
        return response.data!;
      } else {
        throw Exception(response.errorMessage ?? 'Erreur lors de la duplication');
      }
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
      rethrow;
    }
  }

  /// Annuler une commande
  Future<bool> cancelOrder(String orderId, {String? reason}) async {
    state = const AsyncValue.loading();

    try {
      final api = _ref.read(apiServiceProvider);
      final response = await api.cancelOrder(orderId, reason: reason);

      if (response.success) {
        state = const AsyncValue.data(null);
        return true;
      } else {
        throw Exception(response.errorMessage);
      }
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
      return false;
    }
  }
}
