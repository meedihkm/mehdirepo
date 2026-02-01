// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - PROVIDER CAISSE JOURNALIÈRE
// État et logique pour la gestion de la caisse
// ═══════════════════════════════════════════════════════════════════════════════

import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../api/api_client.dart';
import '../database/database.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

class DailyCashData {
  final String id;
  final String date;
  final String status; // open, closed, remitted
  final double openingAmount;
  final CollectionsData collections;
  final double totalExpenses;
  final double expectedCash;
  final double? actualCash;
  final double? actualChecks;
  final double? variance;
  final List<ExpenseData> expenses;
  final DateTime openedAt;
  final DateTime? closedAt;

  DailyCashData({
    required this.id,
    required this.date,
    required this.status,
    required this.openingAmount,
    required this.collections,
    required this.totalExpenses,
    required this.expectedCash,
    this.actualCash,
    this.actualChecks,
    this.variance,
    required this.expenses,
    required this.openedAt,
    this.closedAt,
  });

  factory DailyCashData.fromJson(Map<String, dynamic> json) {
    return DailyCashData(
      id: json['id'],
      date: json['date'],
      status: json['status'],
      openingAmount: (json['openingAmount'] ?? 0).toDouble(),
      collections: CollectionsData.fromJson(json['collections'] ?? {}),
      totalExpenses: (json['expenses'] ?? 0).toDouble(),
      expectedCash: (json['expectedCash'] ?? 0).toDouble(),
      actualCash: json['actualCash']?.toDouble(),
      actualChecks: json['actualChecks']?.toDouble(),
      variance: json['variance']?.toDouble(),
      expenses: (json['expensesList'] as List<dynamic>?)
              ?.map((e) => ExpenseData.fromJson(e))
              .toList() ??
          [],
      openedAt: DateTime.parse(json['openedAt']),
      closedAt: json['closedAt'] != null ? DateTime.parse(json['closedAt']) : null,
    );
  }
}

class CollectionsData {
  final double cash;
  final double checks;
  final double ccp;
  final double bankTransfer;
  final double total;

  CollectionsData({
    required this.cash,
    required this.checks,
    required this.ccp,
    required this.bankTransfer,
    required this.total,
  });

  factory CollectionsData.fromJson(Map<String, dynamic> json) {
    return CollectionsData(
      cash: (json['cash'] ?? 0).toDouble(),
      checks: (json['checks'] ?? 0).toDouble(),
      ccp: (json['ccp'] ?? 0).toDouble(),
      bankTransfer: (json['bankTransfer'] ?? 0).toDouble(),
      total: (json['total'] ?? 0).toDouble(),
    );
  }
}

class ExpenseData {
  final String id;
  final double amount;
  final String category;
  final String description;
  final DateTime createdAt;

  ExpenseData({
    required this.id,
    required this.amount,
    required this.category,
    required this.description,
    required this.createdAt,
  });

  factory ExpenseData.fromJson(Map<String, dynamic> json) {
    return ExpenseData(
      id: json['id'],
      amount: (json['amount'] ?? 0).toDouble(),
      category: json['category'] ?? 'other',
      description: json['description'] ?? '',
      createdAt: DateTime.parse(json['createdAt']),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════════

typedef DailyCashState = AsyncValue<DailyCashData?>;

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFIER
// ═══════════════════════════════════════════════════════════════════════════════

class DailyCashNotifier extends StateNotifier<DailyCashState> {
  final ApiClient _apiClient;
  final AppDatabase _database;
  final Ref _ref;

  DailyCashNotifier(this._apiClient, this._database, this._ref)
      : super(const AsyncValue.loading());

  /// Charger la caisse du jour
  Future<void> loadTodayCash() async {
    state = const AsyncValue.loading();

    try {
      // D'abord, essayer de charger depuis le serveur
      final response = await _apiClient.get('/daily-cash/my');
      
      if (response.data != null) {
        final cash = DailyCashData.fromJson(response.data['data']);
        state = AsyncValue.data(cash);
        
        // Sauvegarder localement
        await _saveCashLocally(cash);
      } else {
        state = const AsyncValue.data(null);
      }
    } catch (e) {
      // En cas d'erreur, charger depuis la base locale
      try {
        final localCash = await _database.getTodayCash();
        if (localCash != null) {
          final expenses = await _database.getExpensesForCash(localCash.id);
          state = AsyncValue.data(_convertLocalCash(localCash, expenses));
        } else {
          state = const AsyncValue.data(null);
        }
      } catch (e2) {
        state = AsyncValue.error(e.toString(), StackTrace.current);
      }
    }
  }

  /// Ouvrir la caisse
  Future<void> openCash(double openingAmount) async {
    final previousState = state;
    state = const AsyncValue.loading();

    try {
      final response = await _apiClient.post('/daily-cash/open', data: {
        'openingAmount': openingAmount,
      });

      final cash = DailyCashData.fromJson(response.data['data']);
      state = AsyncValue.data(cash);
      await _saveCashLocally(cash);
    } catch (e) {
      // En mode offline, créer localement
      final id = const Uuid().v4();
      final now = DateTime.now();
      final date = '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';

      await _database.upsertDailyCash(DailyCashCompanion.insert(
        id: id,
        date: date,
        status: 'open',
        openingAmount: Value(openingAmount),
        openedAt: now,
        isSynced: const Value(false),
      ));

      // Ajouter à la queue de sync
      await _database.addPendingTransaction(PendingTransactionsCompanion.insert(
        id: const Uuid().v4(),
        type: 'open_cash',
        data: jsonEncode({
          'id': id,
          'openingAmount': openingAmount,
          'date': date,
        }),
        createdAt: now,
      ));

      await loadTodayCash();
    }
  }

  /// Clôturer la caisse
  Future<void> closeCash({
    required double actualCash,
    required double actualChecks,
    String? notes,
  }) async {
    final currentCash = state.value;
    if (currentCash == null) return;

    final previousState = state;
    state = const AsyncValue.loading();

    try {
      final response = await _apiClient.post('/daily-cash/close', data: {
        'actualCash': actualCash,
        'actualChecks': actualChecks,
        'notes': notes,
      });

      final cash = DailyCashData.fromJson(response.data['data']);
      state = AsyncValue.data(cash);
      await _saveCashLocally(cash);
    } catch (e) {
      // En mode offline, mettre à jour localement
      await _database.upsertDailyCash(DailyCashCompanion(
        id: Value(currentCash.id),
        date: Value(currentCash.date),
        status: const Value('closed'),
        openingAmount: Value(currentCash.openingAmount),
        totalCashCollected: Value(currentCash.collections.cash),
        totalChecksCollected: Value(currentCash.collections.checks),
        totalExpenses: Value(currentCash.totalExpenses),
        expectedCash: Value(currentCash.expectedCash),
        actualCash: Value(actualCash),
        actualChecks: Value(actualChecks),
        variance: Value(actualCash - currentCash.expectedCash),
        notes: Value(notes),
        openedAt: Value(currentCash.openedAt),
        closedAt: Value(DateTime.now()),
        isSynced: const Value(false),
      ));

      // Ajouter à la queue de sync
      await _database.addPendingTransaction(PendingTransactionsCompanion.insert(
        id: const Uuid().v4(),
        type: 'close_cash',
        data: jsonEncode({
          'id': currentCash.id,
          'actualCash': actualCash,
          'actualChecks': actualChecks,
          'notes': notes,
        }),
        createdAt: DateTime.now(),
      ));

      await loadTodayCash();
    }
  }

  /// Ajouter une dépense
  Future<void> addExpense({
    required double amount,
    required String category,
    required String description,
    String? receiptPhoto,
  }) async {
    final currentCash = state.value;
    if (currentCash == null) return;

    try {
      final response = await _apiClient.post('/daily-cash/expense', data: {
        'amount': amount,
        'category': category,
        'description': description,
        'receiptPhoto': receiptPhoto,
      });

      await loadTodayCash();
    } catch (e) {
      // En mode offline, créer localement
      final expenseId = const Uuid().v4();
      final now = DateTime.now();

      await _database.addExpense(ExpensesCompanion.insert(
        id: expenseId,
        dailyCashId: currentCash.id,
        amount: amount,
        category: category,
        description: description,
        receiptPhoto: Value(receiptPhoto),
        createdAt: now,
        isSynced: const Value(false),
      ));

      // Ajouter à la queue de sync
      await _database.addPendingTransaction(PendingTransactionsCompanion.insert(
        id: const Uuid().v4(),
        type: 'add_expense',
        data: jsonEncode({
          'id': expenseId,
          'dailyCashId': currentCash.id,
          'amount': amount,
          'category': category,
          'description': description,
          'receiptPhoto': receiptPhoto,
        }),
        createdAt: now,
      ));

      await loadTodayCash();
    }
  }

  /// Remettre la caisse
  Future<void> remitCash({
    required String remittedTo,
    required double cashAmount,
    required List<Map<String, dynamic>> checks,
    String? notes,
  }) async {
    final currentCash = state.value;
    if (currentCash == null || currentCash.status != 'closed') return;

    state = const AsyncValue.loading();

    try {
      final response = await _apiClient.post('/daily-cash/remit', data: {
        'remittedTo': remittedTo,
        'cashAmount': cashAmount,
        'checks': checks,
        'notes': notes,
      });

      await loadTodayCash();
    } catch (e) {
      state = AsyncValue.error(e.toString(), StackTrace.current);
    }
  }

  // Helpers privés
  Future<void> _saveCashLocally(DailyCashData cash) async {
    await _database.upsertDailyCash(DailyCashCompanion(
      id: Value(cash.id),
      date: Value(cash.date),
      status: Value(cash.status),
      openingAmount: Value(cash.openingAmount),
      totalCashCollected: Value(cash.collections.cash),
      totalChecksCollected: Value(cash.collections.checks),
      totalExpenses: Value(cash.totalExpenses),
      expectedCash: Value(cash.expectedCash),
      actualCash: Value(cash.actualCash),
      actualChecks: Value(cash.actualChecks),
      variance: Value(cash.variance),
      openedAt: Value(cash.openedAt),
      closedAt: Value(cash.closedAt),
      isSynced: const Value(true),
    ));
  }

  DailyCashData _convertLocalCash(DailyCashData localData, List<Expense> expenses) {
    return DailyCashData(
      id: localData.id,
      date: localData.date,
      status: localData.status,
      openingAmount: localData.openingAmount,
      collections: localData.collections,
      totalExpenses: expenses.fold(0.0, (sum, e) => sum + e.amount),
      expectedCash: localData.expectedCash,
      actualCash: localData.actualCash,
      actualChecks: localData.actualChecks,
      variance: localData.variance,
      expenses: expenses.map((e) => ExpenseData(
        id: e.id,
        amount: e.amount,
        category: e.category,
        description: e.description,
        createdAt: e.createdAt,
      )).toList(),
      openedAt: localData.openedAt,
      closedAt: localData.closedAt,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

final dailyCashProvider =
    StateNotifierProvider<DailyCashNotifier, DailyCashState>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  final database = ref.watch(databaseProvider);
  return DailyCashNotifier(apiClient, database, ref);
});
