// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - PROVIDER SYNCHRONISATION
// Gestion du mode offline et synchronisation
// ═══════════════════════════════════════════════════════════════════════════════

import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

import '../api/api_client.dart';

part 'sync_provider.freezed.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// MODÈLES
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class PendingTransaction with _$PendingTransaction {
  const factory PendingTransaction({
    required String id,
    required String type,
    required Map<String, dynamic> data,
    required DateTime createdAt,
    @Default(0) int retryCount,
    String? lastError,
  }) = _PendingTransaction;

  factory PendingTransaction.fromJson(Map<String, dynamic> json) =>
      _$PendingTransactionFromJson(json);
}

@freezed
class SyncState with _$SyncState {
  const factory SyncState({
    @Default(true) bool isOnline,
    @Default(false) bool isSyncing,
    @Default([]) List<PendingTransaction> pendingTransactions,
    DateTime? lastSyncAt,
    String? lastError,
    @Default(0) int failedSyncCount,
  }) = _SyncState;
}

extension SyncStateX on SyncState {
  int get pendingCount => pendingTransactions.length;
  bool get hasPending => pendingTransactions.isNotEmpty;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFIER DE SYNCHRONISATION
// ═══════════════════════════════════════════════════════════════════════════════

class SyncNotifier extends StateNotifier<SyncState> {
  final ApiClient _api;
  final Ref _ref;
  StreamSubscription? _connectivitySubscription;
  Timer? _syncTimer;

  SyncNotifier(this._api, this._ref) : super(const SyncState()) {
    _initConnectivityListener();
    _initPeriodicSync();
  }

  /// Initialiser l'écoute de la connectivité
  void _initConnectivityListener() {
    _connectivitySubscription = Connectivity().onConnectivityChanged.listen(
      (result) {
        final isOnline = result != ConnectivityResult.none;
        state = state.copyWith(isOnline: isOnline);

        // Si on revient en ligne, lancer la synchronisation
        if (isOnline && state.hasPending) {
          syncPendingTransactions();
        }
      },
    );

    // Vérifier l'état initial
    Connectivity().checkConnectivity().then((result) {
      state = state.copyWith(isOnline: result != ConnectivityResult.none);
    });
  }

  /// Synchronisation périodique
  void _initPeriodicSync() {
    _syncTimer = Timer.periodic(const Duration(minutes: 5), (_) {
      if (state.isOnline && state.hasPending && !state.isSyncing) {
        syncPendingTransactions();
      }
    });
  }

  /// Ajouter une transaction à la queue
  Future<void> queueTransaction(PendingTransaction transaction) async {
    state = state.copyWith(
      pendingTransactions: [...state.pendingTransactions, transaction],
    );

    // Sauvegarder en local
    await _savePendingToStorage();

    // Tenter de synchroniser immédiatement si en ligne
    if (state.isOnline && !state.isSyncing) {
      syncPendingTransactions();
    }
  }

  /// Synchroniser les transactions en attente
  Future<void> syncPendingTransactions() async {
    if (state.isSyncing || !state.isOnline || !state.hasPending) return;

    state = state.copyWith(isSyncing: true, lastError: null);

    final toSync = [...state.pendingTransactions];
    final synced = <String>[];
    final failed = <PendingTransaction>[];

    for (final transaction in toSync) {
      try {
        await _processSingleTransaction(transaction);
        synced.add(transaction.id);
      } catch (e) {
        // Marquer comme échoué avec retry count
        failed.add(transaction.copyWith(
          retryCount: transaction.retryCount + 1,
          lastError: e.toString(),
        ));
      }
    }

    // Mettre à jour l'état
    final remaining = state.pendingTransactions
        .where((t) => !synced.contains(t.id))
        .map((t) {
          final failedTx = failed.firstWhere(
            (f) => f.id == t.id,
            orElse: () => t,
          );
          return failedTx;
        })
        .where((t) => t.retryCount < 5) // Abandonner après 5 tentatives
        .toList();

    state = state.copyWith(
      isSyncing: false,
      pendingTransactions: remaining,
      lastSyncAt: DateTime.now(),
      failedSyncCount: failed.length,
    );

    await _savePendingToStorage();
  }

  /// Traiter une transaction individuelle
  Future<void> _processSingleTransaction(PendingTransaction transaction) async {
    switch (transaction.type) {
      case 'complete_delivery':
        await _api.put(
          '/deliveries/${transaction.data['deliveryId']}/complete',
          data: transaction.data,
        );
        break;

      case 'fail_delivery':
        await _api.put(
          '/deliveries/${transaction.data['deliveryId']}/fail',
          data: transaction.data,
        );
        break;

      case 'delivery_status':
        await _api.put(
          '/deliveries/${transaction.data['deliveryId']}/status',
          data: {'status': transaction.data['status']},
        );
        break;

      case 'close_day':
        await _api.post('/daily-cash/close', data: transaction.data);
        break;

      default:
        throw Exception('Unknown transaction type: ${transaction.type}');
    }
  }

  /// Téléchargement initial des données
  Future<InitialSyncData> performInitialSync() async {
    state = state.copyWith(isSyncing: true);

    try {
      final response = await _api.get('/sync/initial');
      
      state = state.copyWith(
        isSyncing: false,
        lastSyncAt: DateTime.now(),
      );

      return InitialSyncData.fromJson(response);
    } catch (e) {
      state = state.copyWith(
        isSyncing: false,
        lastError: e.toString(),
      );
      rethrow;
    }
  }

  /// Pousser les transactions offline vers le serveur
  Future<PushSyncResult> pushOfflineTransactions() async {
    if (!state.hasPending) {
      return PushSyncResult(synced: 0, failed: 0, pending: 0);
    }

    state = state.copyWith(isSyncing: true);

    try {
      final response = await _api.post('/sync/push', data: {
        'transactions': state.pendingTransactions
            .map((t) => {
                  'id': t.id,
                  'type': t.type,
                  'data': t.data,
                  'createdAt': t.createdAt.toIso8601String(),
                })
            .toList(),
      });

      final result = PushSyncResult.fromJson(response);

      // Retirer les transactions synchronisées
      final syncedIds = (response['syncedIds'] as List).cast<String>();
      state = state.copyWith(
        isSyncing: false,
        pendingTransactions: state.pendingTransactions
            .where((t) => !syncedIds.contains(t.id))
            .toList(),
        lastSyncAt: DateTime.now(),
      );

      await _savePendingToStorage();
      return result;
    } catch (e) {
      state = state.copyWith(isSyncing: false, lastError: e.toString());
      rethrow;
    }
  }

  /// Récupérer les mises à jour du serveur
  Future<PullSyncData> pullUpdates() async {
    state = state.copyWith(isSyncing: true);

    try {
      final response = await _api.get('/sync/pull', queryParameters: {
        'lastSyncAt': state.lastSyncAt?.toIso8601String(),
      });

      state = state.copyWith(
        isSyncing: false,
        lastSyncAt: DateTime.now(),
      );

      return PullSyncData.fromJson(response);
    } catch (e) {
      state = state.copyWith(isSyncing: false, lastError: e.toString());
      rethrow;
    }
  }

  /// Sauvegarder les transactions en attente en local
  Future<void> _savePendingToStorage() async {
    // TODO: Implémenter avec Hive ou SharedPreferences
  }

  /// Charger les transactions en attente depuis le stockage local
  Future<void> loadPendingFromStorage() async {
    // TODO: Implémenter avec Hive ou SharedPreferences
  }

  /// Forcer une synchronisation manuelle
  Future<void> forceSync() async {
    if (!state.isOnline) {
      throw Exception('Pas de connexion internet');
    }

    await syncPendingTransactions();
  }

  /// Supprimer une transaction en attente
  void removePendingTransaction(String id) {
    state = state.copyWith(
      pendingTransactions:
          state.pendingTransactions.where((t) => t.id != id).toList(),
    );
    _savePendingToStorage();
  }

  /// Nettoyer les transactions échouées
  void clearFailedTransactions() {
    state = state.copyWith(
      pendingTransactions:
          state.pendingTransactions.where((t) => t.retryCount == 0).toList(),
    );
    _savePendingToStorage();
  }

  @override
  void dispose() {
    _connectivitySubscription?.cancel();
    _syncTimer?.cancel();
    super.dispose();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODÈLES DE SYNCHRONISATION
// ═══════════════════════════════════════════════════════════════════════════════

class InitialSyncData {
  final List<dynamic> products;
  final List<dynamic> categories;
  final List<dynamic> customers;
  final List<dynamic> deliveries;
  final Map<String, dynamic> settings;
  final DateTime syncedAt;

  InitialSyncData({
    required this.products,
    required this.categories,
    required this.customers,
    required this.deliveries,
    required this.settings,
    required this.syncedAt,
  });

  factory InitialSyncData.fromJson(Map<String, dynamic> json) {
    return InitialSyncData(
      products: json['products'] ?? [],
      categories: json['categories'] ?? [],
      customers: json['customers'] ?? [],
      deliveries: json['deliveries'] ?? [],
      settings: json['settings'] ?? {},
      syncedAt: DateTime.parse(json['syncedAt']),
    );
  }
}

class PushSyncResult {
  final int synced;
  final int failed;
  final int pending;
  final List<String>? errors;

  PushSyncResult({
    required this.synced,
    required this.failed,
    required this.pending,
    this.errors,
  });

  factory PushSyncResult.fromJson(Map<String, dynamic> json) {
    return PushSyncResult(
      synced: json['synced'] ?? 0,
      failed: json['failed'] ?? 0,
      pending: json['pending'] ?? 0,
      errors: (json['errors'] as List?)?.cast<String>(),
    );
  }
}

class PullSyncData {
  final List<dynamic> updatedOrders;
  final List<dynamic> updatedCustomers;
  final List<dynamic> updatedProducts;
  final List<dynamic> newDeliveries;
  final bool hasMore;

  PullSyncData({
    required this.updatedOrders,
    required this.updatedCustomers,
    required this.updatedProducts,
    required this.newDeliveries,
    required this.hasMore,
  });

  factory PullSyncData.fromJson(Map<String, dynamic> json) {
    return PullSyncData(
      updatedOrders: json['orders'] ?? [],
      updatedCustomers: json['customers'] ?? [],
      updatedProducts: json['products'] ?? [],
      newDeliveries: json['deliveries'] ?? [],
      hasMore: json['hasMore'] ?? false,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════

final syncProvider = StateNotifierProvider<SyncNotifier, SyncState>((ref) {
  final api = ref.watch(apiClientProvider);
  return SyncNotifier(api, ref);
});

/// Provider pour l'état de connexion
final isOnlineProvider = Provider<bool>((ref) {
  return ref.watch(syncProvider).isOnline;
});

/// Provider pour le nombre de transactions en attente
final pendingTransactionsCountProvider = Provider<int>((ref) {
  return ref.watch(syncProvider).pendingCount;
});

/// Provider pour l'état de synchronisation
final isSyncingProvider = Provider<bool>((ref) {
  return ref.watch(syncProvider).isSyncing;
});
