// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - ÉCRAN CAISSE JOURNALIÈRE
// lib/screens/cash/daily_cash_screen.dart
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../models/delivery.dart';
import '../../providers/daily_cash_provider.dart';
import '../../theme/app_colors.dart';

class DailyCashScreen extends ConsumerWidget {
  const DailyCashScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dailyCashAsync = ref.watch(dailyCashProvider);
    final formatter = NumberFormat('#,###', 'fr_FR');

    final dailyCashState = ref.watch(dailyCashNotifierProvider);
    
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Ma Caisse'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.read(dailyCashNotifierProvider.notifier).loadTodayCash(),
          ),
          IconButton(
            icon: const Icon(Icons.history),
            onPressed: () => _showHistory(context, ref),
          ),
        ],
      ),
      body: dailyCashState.isLoading
          ? const Center(child: CircularProgressIndicator())
          : dailyCashState.error != null
              ? Center(child: Text('Erreur: ${dailyCashState.error}'))
              : dailyCashState.today == null
                  ? const Center(child: Text('Aucune donnée de caisse disponible'))
                  : _buildContent(context, ref, dailyCashState.today!, formatter),
    );
  }

  Widget _buildContent(
    BuildContext context,
    WidgetRef ref,
    DailyCash dailyCash,
    NumberFormat formatter,
  ) {
    return SingleChildScrollView(
      child: Column(
        children: [
          // En-tête avec date
          _buildHeader(dailyCash, formatter),

          // Stats de livraisons
          _buildDeliveryStats(dailyCash),

          // Résumé financier
          _buildFinancialSummary(dailyCash, formatter),

          // Liste des transactions
          _buildTransactionsList(dailyCash, formatter),

          // Bouton clôturer
          if (!dailyCash.isClosed)
            _buildCloseButton(context, ref, dailyCash, formatter),

          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildHeader(DailyCash dailyCash, NumberFormat formatter) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.primary, AppColors.primaryDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        children: [
          Text(
            DateFormat('EEEE d MMMM yyyy', 'fr_FR').format(dailyCash.date),
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '${formatter.format(dailyCash.actualCollection)} DZD',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 36,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Cash collecté',
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 14,
            ),
          ),
          if (dailyCash.isClosed) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: const [
                  Icon(Icons.lock, color: Colors.white, size: 16),
                  SizedBox(width: 4),
                  Text(
                    'Journée clôturée',
                    style: TextStyle(color: Colors.white),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildDeliveryStats(DailyCash dailyCash) {
    final completed = dailyCash.deliveriesCompleted;
    final total = dailyCash.deliveriesTotal;
    final failed = dailyCash.deliveriesFailed;
    final progress = total > 0 ? completed / total : 0.0;

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              const Icon(Icons.local_shipping, color: AppColors.primary),
              const SizedBox(width: 8),
              const Text(
                'Livraisons',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _buildStatBox(
                value: '$completed',
                label: 'Complétées',
                color: Colors.green,
              ),
              _buildStatBox(
                value: '$failed',
                label: 'Échouées',
                color: failed > 0 ? Colors.red : Colors.grey,
              ),
              _buildStatBox(
                value: '${total - completed - failed}',
                label: 'Restantes',
                color: Colors.orange,
              ),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress,
              backgroundColor: Colors.grey[200],
              valueColor: const AlwaysStoppedAnimation<Color>(Colors.green),
              minHeight: 8,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '${(progress * 100).toStringAsFixed(0)}% terminé',
            style: TextStyle(
              color: Colors.grey[600],
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatBox({
    required String value,
    required String label,
    required Color color,
  }) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFinancialSummary(DailyCash dailyCash, NumberFormat formatter) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.account_balance_wallet, color: Colors.green),
              const SizedBox(width: 8),
              const Text(
                'Résumé financier',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildFinanceRow(
            'Attendu',
            '${formatter.format(dailyCash.expectedCollection)} DZD',
            Colors.grey[700]!,
          ),
          const SizedBox(height: 8),
          _buildFinanceRow(
            'Collecté',
            '${formatter.format(dailyCash.actualCollection)} DZD',
            Colors.green,
          ),
          const SizedBox(height: 8),
          _buildFinanceRow(
            'Nouvelles dettes',
            '${formatter.format(dailyCash.newDebtCreated)} DZD',
            dailyCash.newDebtCreated > 0 ? Colors.orange : Colors.grey,
          ),
          if (dailyCash.isClosed && dailyCash.discrepancy != null) ...[
            const Divider(height: 24),
            _buildFinanceRow(
              'Remis à l\'admin',
              '${formatter.format(dailyCash.cashHandedOver ?? 0)} DZD',
              AppColors.primary,
            ),
            if (dailyCash.discrepancy != 0) ...[
              const SizedBox(height: 8),
              _buildFinanceRow(
                'Écart',
                '${formatter.format(dailyCash.discrepancy!)} DZD',
                dailyCash.discrepancy! < 0 ? Colors.red : Colors.green,
              ),
              if (dailyCash.discrepancyNotes != null &&
                  dailyCash.discrepancyNotes!.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  'Note: ${dailyCash.discrepancyNotes}',
                  style: TextStyle(
                    color: Colors.grey[600],
                    fontSize: 12,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ],
            ],
          ],
        ],
      ),
    );
  }

  Widget _buildFinanceRow(String label, String value, Color color) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(color: Colors.grey[700])),
        Text(
          value,
          style: TextStyle(
            fontWeight: FontWeight.w600,
            color: color,
          ),
        ),
      ],
    );
  }

  Widget _buildTransactionsList(DailyCash dailyCash, NumberFormat formatter) {
    // Le modèle DailyCash n'a pas de champ transactions
    // On affiche un message indiquant que les transactions seront disponibles
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Row(
              children: [
                const Icon(Icons.list_alt, color: AppColors.primary),
                const SizedBox(width: 8),
                const Text(
                  'Transactions du jour',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const Spacer(),
                Text(
                  '${dailyCash.deliveriesCompleted}',
                  style: TextStyle(
                    color: Colors.grey[600],
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Center(
            child: Column(
              children: [
                const SizedBox(height: 24),
                Icon(Icons.receipt_long, size: 48, color: Colors.grey[300]),
                const SizedBox(height: 8),
                Text(
                  'Détails des transactions non disponibles hors ligne',
                  style: TextStyle(color: Colors.grey[500]),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCloseButton(
    BuildContext context,
    WidgetRef ref,
    DailyCash dailyCash,
    NumberFormat formatter,
  ) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: ElevatedButton.icon(
        onPressed: () => _showCloseDialog(context, ref, dailyCash, formatter),
        icon: const Icon(Icons.lock_outline),
        label: const Text('Clôturer la journée'),
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }

  void _showCloseDialog(
    BuildContext context,
    WidgetRef ref,
    DailyCash dailyCash,
    NumberFormat formatter,
  ) {
    final cashController = TextEditingController(
      text: dailyCash.actualCollection.toStringAsFixed(0),
    );
    final notesController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Clôturer la journée'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Cash collecté selon l\'app: ${formatter.format(dailyCash.actualCollection)} DZD',
              style: const TextStyle(fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: cashController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Montant remis à l\'admin',
                suffixText: 'DZD',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: notesController,
              decoration: const InputDecoration(
                labelText: 'Notes (si écart)',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Annuler'),
          ),
          ElevatedButton(
            onPressed: () async {
              final cashHandedOver = double.tryParse(cashController.text) ?? 0;
              Navigator.pop(context);

              await ref.read(dailyCashNotifierProvider.notifier).closeDay(
                    cashHandedOver: cashHandedOver,
                    discrepancyNotes: notesController.text.isEmpty
                        ? null
                        : notesController.text,
                  );
            },
            child: const Text('Clôturer'),
          ),
        ],
      ),
    );
  }

  void _showHistory(BuildContext context, WidgetRef ref) {
    // Navigation vers l'historique
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER: Synchronisation offline
// lib/providers/sync_provider.dart
// ═══════════════════════════════════════════════════════════════════════════════

/*
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:drift/drift.dart';

import '../database/local_database.dart';
import '../services/api_service.dart';
import '../services/connectivity_service.dart';

// État de synchronisation
class SyncState {
  final bool isSyncing;
  final int pendingCount;
  final DateTime? lastSyncAt;
  final String? lastError;

  const SyncState({
    this.isSyncing = false,
    this.pendingCount = 0,
    this.lastSyncAt,
    this.lastError,
  });

  SyncState copyWith({
    bool? isSyncing,
    int? pendingCount,
    DateTime? lastSyncAt,
    String? lastError,
  }) {
    return SyncState(
      isSyncing: isSyncing ?? this.isSyncing,
      pendingCount: pendingCount ?? this.pendingCount,
      lastSyncAt: lastSyncAt ?? this.lastSyncAt,
      lastError: lastError,
    );
  }
}

// Provider de sync
class SyncNotifier extends StateNotifier<SyncState> {
  final ApiService _api;
  final LocalDatabase _db;
  final ConnectivityService _connectivity;

  SyncNotifier(this._api, this._db, this._connectivity) : super(const SyncState()) {
    // Écouter les changements de connectivité
    _connectivity.onConnectivityChanged.listen((isOnline) {
      if (isOnline) {
        syncPendingTransactions();
      }
    });

    // Charger le compte de transactions en attente
    _loadPendingCount();
  }

  Future<void> _loadPendingCount() async {
    final count = await _db.pendingTransactionsDao.count();
    state = state.copyWith(pendingCount: count);
  }

  // Synchroniser les transactions en attente
  Future<void> syncPendingTransactions() async {
    if (state.isSyncing || !_connectivity.isOnline) return;

    state = state.copyWith(isSyncing: true, lastError: null);

    try {
      final pending = await _db.pendingTransactionsDao.getAll();

      for (final tx in pending) {
        try {
          await _api.post('/sync/push', body: {
            'transactions': [
              {
                'id': tx.localId,
                'type': tx.type,
                'data': tx.data,
                'createdAt': tx.createdAt.toIso8601String(),
              }
            ],
          });

          // Supprimer la transaction synchronisée
          await _db.pendingTransactionsDao.delete(tx.localId);
        } catch (e) {
          // Incrémenter le compteur de retry
          await _db.pendingTransactionsDao.incrementRetry(tx.localId, e.toString());
        }
      }

      state = state.copyWith(
        isSyncing: false,
        lastSyncAt: DateTime.now(),
      );
    } catch (e) {
      state = state.copyWith(
        isSyncing: false,
        lastError: e.toString(),
      );
    }

    await _loadPendingCount();
  }

  // Ajouter une transaction en attente
  Future<void> addPendingTransaction({
    required String type,
    required Map<String, dynamic> data,
  }) async {
    await _db.pendingTransactionsDao.insert(
      PendingTransaction(
        localId: DateTime.now().millisecondsSinceEpoch.toString(),
        type: type,
        data: data,
        createdAt: DateTime.now(),
      ),
    );

    await _loadPendingCount();

    // Tenter de synchroniser si en ligne
    if (_connectivity.isOnline) {
      syncPendingTransactions();
    }
  }

  // Télécharger les données initiales
  Future<void> downloadInitialData() async {
    if (!_connectivity.isOnline) {
      throw Exception('Pas de connexion internet');
    }

    state = state.copyWith(isSyncing: true);

    try {
      final response = await _api.get('/sync/initial');
      final data = SyncData.fromJson(response);

      // Sauvegarder en local
      await _db.transaction(() async {
        // Livraisons
        await _db.deliveriesDao.clear();
        await _db.deliveriesDao.insertAll(data.deliveries);

        // Clients
        await _db.customersDao.clear();
        await _db.customersDao.insertAll(data.customers);

        // Produits
        await _db.productsDao.clear();
        await _db.productsDao.insertAll(data.products);

        // Sauvegarder le token de sync
        await _db.settingsDao.setSyncToken(data.syncToken);
      });

      state = state.copyWith(
        isSyncing: false,
        lastSyncAt: DateTime.now(),
      );
    } catch (e) {
      state = state.copyWith(
        isSyncing: false,
        lastError: e.toString(),
      );
      rethrow;
    }
  }
}

// Provider
final syncProvider = StateNotifierProvider<SyncNotifier, SyncState>((ref) {
  return SyncNotifier(
    ref.watch(apiServiceProvider),
    ref.watch(localDatabaseProvider),
    ref.watch(connectivityServiceProvider),
  );
});

// Provider du compteur de transactions en attente
final pendingTransactionsCountProvider = Provider<int>((ref) {
  return ref.watch(syncProvider).pendingCount;
});
*/
