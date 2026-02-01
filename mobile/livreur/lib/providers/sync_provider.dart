// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - PROVIDER SYNCHRONISATION
// Gestion de la synchronisation offline
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/sync_service.dart';
import '../services/connectivity_manager.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// ÉTAT
// ═══════════════════════════════════════════════════════════════════════════════

enum SyncStatus {
  idle,
  syncing,
  success,
  error,
}

class SyncState {
  final SyncStatus status;
  final int pendingCount;
  final DateTime? lastSync;
  final String? error;
  final double progress; // 0.0 à 1.0

  const SyncState({
    this.status = SyncStatus.idle,
    this.pendingCount = 0,
    this.lastSync,
    this.error,
    this.progress = 0.0,
  });

  SyncState copyWith({
    SyncStatus? status,
    int? pendingCount,
    DateTime? lastSync,
    String? error,
    double? progress,
  }) {
    return SyncState(
      status: status ?? this.status,
      pendingCount: pendingCount ?? this.pendingCount,
      lastSync: lastSync ?? this.lastSync,
      error: error,
      progress: progress ?? this.progress,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFIER
// ═══════════════════════════════════════════════════════════════════════════════

class SyncNotifier extends StateNotifier<SyncState> {
  final SyncService _syncService;
  final ConnectivityManager _connectivity;

  SyncNotifier(this._syncService, this._connectivity) : super(const SyncState()) {
    _init();
  }

  Future<void> _init() async {
    // Charger le statut initial
    await refreshStatus();
    
    // Écouter les changements de connectivité
    _connectivity.connectionStream.listen((isOnline) {
      if (isOnline && state.pendingCount > 0) {
        // Auto-sync quand on revient en ligne
        sync();
      }
    });
  }

  /// Rafraîchir le statut
  Future<void> refreshStatus() async {
    final pendingCount = await _syncService.getPendingCount();
    final lastSync = await _syncService.getLastSyncAt();
    state = state.copyWith(
      pendingCount: pendingCount,
      lastSync: lastSync,
    );
  }

  /// Synchroniser
  Future<bool> sync() async {
    if (!_connectivity.isOnline) {
      state = state.copyWith(
        status: SyncStatus.error,
        error: 'Pas de connexion internet',
      );
      return false;
    }

    if (state.status == SyncStatus.syncing) {
      return false; // Déjà en cours
    }

    state = state.copyWith(status: SyncStatus.syncing, error: null);

    try {
      // Étape 1: Upload des transactions en attente
      state = state.copyWith(progress: 0.2);
      final pushResult = await _syncService.syncPendingTransactions();
      
      if (!pushResult.success) {
        state = state.copyWith(
          status: SyncStatus.error,
          error: pushResult.errorMessage ?? 'Erreur upload',
          progress: 0.0,
        );
        return false;
      }

      // Étape 2: Download des mises à jour
      state = state.copyWith(progress: 0.6);
      final pullResult = await _syncService.pullUpdates();
      
      if (!pullResult.success) {
        state = state.copyWith(
          status: SyncStatus.error,
          error: pullResult.errorMessage ?? 'Erreur download',
          progress: 0.0,
        );
        return false;
      }

      // Étape 3: Finalisation
      state = state.copyWith(progress: 1.0);
      await refreshStatus();
      
      state = state.copyWith(
        status: SyncStatus.success,
        progress: 0.0,
      );

      // Reset le statut après 2 secondes
      Future.delayed(const Duration(seconds: 2), () {
        if (state.status == SyncStatus.success) {
          state = state.copyWith(status: SyncStatus.idle);
        }
      });

      return true;
    } catch (e) {
      state = state.copyWith(
        status: SyncStatus.error,
        error: e.toString(),
        progress: 0.0,
      );
      return false;
    }
  }

  /// Forcer un sync complet (initial)
  Future<bool> fullSync(String delivererId, String organizationId) async {
    state = state.copyWith(status: SyncStatus.syncing, error: null);

    try {
      final result = await _syncService.performInitialSync(delivererId, organizationId);
      
      if (result) {
        await refreshStatus();
        state = state.copyWith(status: SyncStatus.success);
        
        Future.delayed(const Duration(seconds: 2), () {
          if (state.status == SyncStatus.success) {
            state = state.copyWith(status: SyncStatus.idle);
          }
        });
        
        return true;
      } else {
        state = state.copyWith(
          status: SyncStatus.error,
          error: 'Échec de la synchronisation',
        );
        return false;
      }
    } catch (e) {
      state = state.copyWith(
        status: SyncStatus.error,
        error: e.toString(),
      );
      return false;
    }
  }

  /// Effacer l'erreur
  void clearError() {
    state = state.copyWith(error: null);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════

final syncNotifierProvider = StateNotifierProvider<SyncNotifier, SyncState>((ref) {
  final syncService = ref.watch(syncServiceProvider);
  final connectivity = ref.watch(connectivityManagerProvider);
  return SyncNotifier(syncService, connectivity);
});

final syncStatusProvider = Provider<SyncStatus>((ref) {
  return ref.watch(syncNotifierProvider).status;
});

final pendingSyncCountProvider = Provider<int>((ref) {
  return ref.watch(syncNotifierProvider).pendingCount;
});

final lastSyncProvider = Provider<DateTime?>((ref) {
  return ref.watch(syncNotifierProvider).lastSync;
});
