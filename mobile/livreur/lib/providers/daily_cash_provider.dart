// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - PROVIDER CAISSE JOURNALIÈRE
// Gestion de l'état de la caisse du livreur
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:drift/drift.dart';
import '../models/delivery.dart';
import '../services/api_service.dart';
import '../database/database.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// ÉTAT
// ═══════════════════════════════════════════════════════════════════════════════

class DailyCashState {
  final DailyCash? today;
  final List<DailyCash> history;
  final bool isLoading;
  final String? error;

  const DailyCashState({
    this.today,
    this.history = const [],
    this.isLoading = false,
    this.error,
  });

  DailyCashState copyWith({
    DailyCash? today,
    List<DailyCash>? history,
    bool? isLoading,
    String? error,
  }) {
    return DailyCashState(
      today: today ?? this.today,
      history: history ?? this.history,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFIER
// ═══════════════════════════════════════════════════════════════════════════════

class DailyCashNotifier extends StateNotifier<DailyCashState> {
  final ApiService _apiService;
  final AppDatabase _database;

  DailyCashNotifier(this._apiService, this._database) : super(const DailyCashState());

  /// Charger la caisse du jour
  Future<void> loadTodayCash() async {
    state = state.copyWith(isLoading: true, error: null);
    
    try {
      final response = await _apiService.get<Map<String, dynamic>>('/daily-cash/today');
      
      if (response.success && response.data != null) {
        final cash = DailyCash.fromJson(response.data!);
        state = state.copyWith(today: cash, isLoading: false);
        
        // Sauvegarder en local
        await _database.upsertDailyCash(LocalDailyCashCompanion(
          id: Value(cash.id),
          organizationId: Value(cash.organizationId),
          delivererId: Value(cash.delivererId),
          date: Value(cash.date),
          expectedCollection: Value(cash.expectedCollection),
          actualCollection: Value(cash.actualCollection),
          newDebtCreated: Value(cash.newDebtCreated),
          deliveriesTotal: Value(cash.deliveriesTotal),
          deliveriesCompleted: Value(cash.deliveriesCompleted),
          deliveriesFailed: Value(cash.deliveriesFailed),
          isClosed: Value(cash.isClosed),
          closedAt: Value(cash.closedAt),
          cashHandedOver: Value(cash.cashHandedOver),
          discrepancy: Value(cash.discrepancy),
          discrepancyNotes: Value(cash.discrepancyNotes),
        ));
      } else {
        state = state.copyWith(error: response.errorMessage, isLoading: false);
      }
    } catch (e) {
      state = state.copyWith(error: e.toString(), isLoading: false);
    }
  }

  /// Charger l'historique
  Future<void> loadHistory({int page = 1, int limit = 20}) async {
    state = state.copyWith(isLoading: true, error: null);
    
    try {
      final response = await _apiService.get('/daily-cash/my-history', queryParameters: {
        'page': page.toString(),
        'limit': limit.toString(),
      });
      
      if (response.success && response.data != null) {
        final List<dynamic> data = response.data!['data'] ?? [];
        final history = data.map((e) => DailyCash.fromJson(e)).toList();
        state = state.copyWith(history: history, isLoading: false);
      } else {
        state = state.copyWith(error: response.errorMessage, isLoading: false);
      }
    } catch (e) {
      state = state.copyWith(error: e.toString(), isLoading: false);
    }
  }

  /// Clôturer la journée
  Future<bool> closeDay({
    required double cashHandedOver,
    double? discrepancy,
    String? discrepancyNotes,
  }) async {
    state = state.copyWith(isLoading: true, error: null);
    
    try {
      final response = await _apiService.post('/daily-cash/close', data: {
        'cashHandedOver': cashHandedOver,
        'discrepancy': discrepancy,
        'discrepancyNotes': discrepancyNotes,
      });
      
      if (response.success) {
        await loadTodayCash();
        return true;
      } else {
        state = state.copyWith(error: response.errorMessage, isLoading: false);
        return false;
      }
    } catch (e) {
      state = state.copyWith(error: e.toString(), isLoading: false);
      return false;
    }
  }

  /// Mettre à jour avec les données locales (mode offline)
  Future<void> updateFromLocal() async {
    final now = DateTime.now();
    final localCash = await _database.getDailyCash('', now);
    if (localCash != null) {
      state = state.copyWith(today: _mapLocalToDailyCash(localCash));
    }
  }
  
  DailyCash _mapLocalToDailyCash(LocalDailyCash local) {
    return DailyCash(
      id: local.id,
      organizationId: local.organizationId,
      delivererId: local.delivererId,
      date: local.date,
      expectedCollection: local.expectedCollection,
      actualCollection: local.actualCollection,
      newDebtCreated: local.newDebtCreated,
      deliveriesTotal: local.deliveriesTotal,
      deliveriesCompleted: local.deliveriesCompleted,
      deliveriesFailed: local.deliveriesFailed,
      isClosed: local.isClosed,
      closedAt: local.closedAt,
      closedBy: null,
      cashHandedOver: local.cashHandedOver,
      discrepancy: local.discrepancy,
      discrepancyNotes: local.discrepancyNotes,
      createdAt: local.date,
      updatedAt: null,
    );
  }

  /// Effacer l'erreur
  void clearError() {
    state = state.copyWith(error: null);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════

final dailyCashNotifierProvider = StateNotifierProvider<DailyCashNotifier, DailyCashState>((ref) {
  final apiService = ref.watch(apiServiceProvider);
  final database = ref.watch(databaseProvider);
  return DailyCashNotifier(apiService, database);
});

final dailyCashProvider = Provider<DailyCash?>((ref) {
  return ref.watch(dailyCashNotifierProvider).today;
});

final dailyCashHistoryProvider = Provider<List<DailyCash>>((ref) {
  return ref.watch(dailyCashNotifierProvider).history;
});
