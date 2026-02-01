// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - SERVICE DE SYNCHRONISATION
// Gestion du mode offline et synchronisation avec le backend
// ═══════════════════════════════════════════════════════════════════════════════

import 'dart:async';
import 'dart:convert';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../database/database.dart';
import '../models/delivery.dart';
import 'api_service.dart';
import 'connectivity_manager.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════

final syncServiceProvider = Provider<SyncService>((ref) {
  return SyncService(
    ref.watch(databaseProvider),
    ref.watch(apiServiceProvider),
    ref.watch(connectivityManagerProvider),
  );
});

final syncStatusProvider = StreamProvider<SyncStatus>((ref) {
  final syncService = ref.watch(syncServiceProvider);
  return syncService.syncStatusStream;
});

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

class SyncService {
  final AppDatabase _db;
  final ApiService _api;
  final ConnectivityManager _connectivity;
  
  final _syncStatusController = StreamController<SyncStatus>.broadcast();
  Stream<SyncStatus> get syncStatusStream => _syncStatusController.stream;
  
  Timer? _syncTimer;
  bool _isSyncing = false;
  
  SyncService(this._db, this._api, this._connectivity) {
    _init();
  }
  
  void _init() {
    // Écouter les changements de connectivité
    _connectivity.connectionStream.listen((isOnline) {
      if (isOnline) {
        // Tenter de synchroniser quand on revient online
        syncPendingTransactions();
      }
    });
    
    // Timer de synchronisation périodique (toutes les 5 minutes)
    _syncTimer = Timer.periodic(const Duration(minutes: 5), (_) {
      if (_connectivity.isOnline) {
        syncPendingTransactions();
      }
    });
  }
  
  void dispose() {
    _syncTimer?.cancel();
    _syncStatusController.close();
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SYNCHRONISATION INITIALE (Premier chargement ou reset)
  // ═══════════════════════════════════════════════════════════════════════════
  
  /// Récupérer le nombre de transactions en attente
  Future<int> getPendingCount() async {
    return await _db.getPendingTransactionCount();
  }
  
  /// Récupérer la date de dernière synchronisation
  Future<DateTime?> getLastSyncAt() async {
    return await _db.getLastSyncAt();
  }
  
  Future<bool> performInitialSync(String delivererId, String organizationId) async {
    try {
      _updateStatus(isSyncing: true);
      
      // Récupérer les données initiales du serveur
      final response = await _api.get('/sync/initial', queryParameters: {
        'date': DateTime.now().toIso8601String(),
      });
      
      if (!response.success) {
        throw Exception(response.errorMessage ?? 'Échec de la synchronisation initiale');
      }
      
      final data = response.data;
      
      // Sauvegarder les clients
      if (data['customers'] != null) {
        final customers = (data['customers'] as List)
            .map((c) => LocalCustomersCompanion(
              id: Value(c['id']),
              organizationId: Value(c['organizationId']),
              name: Value(c['name']),
              phone: Value(c['phone']),
              phoneSecondary: Value(c['phoneSecondary']),
              address: Value(c['address']),
              city: Value(c['city']),
              zone: Value(c['zone']),
              coordinates: Value(c['coordinates'] != null ? jsonEncode(c['coordinates']) : null),
              currentDebt: Value((c['currentDebt'] as num).toDouble()),
              creditLimit: Value((c['creditLimit'] as num).toDouble()),
              creditLimitEnabled: Value(c['creditLimitEnabled'] ?? true),
              deliveryNotes: Value(c['deliveryNotes']),
              customPrices: Value(c['customPrices'] != null ? jsonEncode(c['customPrices']) : null),
              syncedAt: Value(DateTime.now()),
            ))
            .toList();
        
        await _db.insertCustomers(customers);
      }
      
      // Sauvegarder les produits
      if (data['products'] != null) {
        final products = (data['products'] as List)
            .map((p) => LocalProductsCompanion(
              id: Value(p['id']),
              organizationId: Value(p['organizationId']),
              name: Value(p['name']),
              description: Value(p['description']),
              price: Value((p['price'] as num).toDouble()),
              unit: Value(p['unit'] ?? 'pièce'),
              categoryId: Value(p['categoryId']),
              imageUrl: Value(p['imageUrl']),
              isAvailable: Value(p['isAvailable'] ?? true),
              syncedAt: Value(DateTime.now()),
            ))
            .toList();
        
        await _db.insertProducts(products);
      }
      
      // Sauvegarder les livraisons
      if (data['myRoute'] != null) {
        await _saveDeliveries(data['myRoute'] as List);
      }
      
      // Mettre à jour la date de dernière synchro
      await _db.setLastSyncAt(DateTime.now());
      
      _updateStatus(isSyncing: false);
      return true;
    } catch (e) {
      _updateStatus(isSyncing: false, error: e.toString());
      return false;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PULL - Récupérer les mises à jour depuis le serveur
  // ═══════════════════════════════════════════════════════════════════════════
  
  Future<bool> pullUpdates() async {
    if (!_connectivity.isOnline) {
      return false;
    }
    
    try {
      _updateStatus(isSyncing: true);
      
      final lastSyncAt = await _db.getLastSyncAt();
      
      final response = await _api.get('/sync/pull', queryParameters: {
        'lastSyncAt': lastSyncAt?.toIso8601String() ?? DateTime(2000).toIso8601String(),
        'entities': ['deliveries', 'customers'],
      });
      
      if (!response.success) {
        throw Exception(response.errorMessage ?? 'Échec du pull');
      }
      
      final data = response.data;
      
      // Mettre à jour les livraisons
      if (data['deliveries'] != null) {
        await _saveDeliveries(data['deliveries'] as List);
      }
      
      // Mettre à jour les clients
      if (data['customers'] != null) {
        for (final customer in data['customers']) {
          await _db.insertCustomer(LocalCustomersCompanion(
            id: Value(customer['id']),
            organizationId: Value(customer['organizationId']),
            name: Value(customer['name']),
            phone: Value(customer['phone']),
            address: Value(customer['address']),
            currentDebt: Value((customer['currentDebt'] as num).toDouble()),
            creditLimit: Value((customer['creditLimit'] as num).toDouble()),
            syncedAt: Value(DateTime.now()),
          ));
        }
      }
      
      await _db.setLastSyncAt(DateTime.now());
      
      _updateStatus(isSyncing: false);
      return true;
    } catch (e) {
      _updateStatus(isSyncing: false, error: e.toString());
      return false;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PUSH - Envoyer les transactions en attente
  // ═══════════════════════════════════════════════════════════════════════════
  
  Future<SyncResult> syncPendingTransactions() async {
    if (!_connectivity.isOnline || _isSyncing) {
      return SyncResult(success: false, pendingCount: await _db.getPendingTransactionCount());
    }
    
    _isSyncing = true;
    _updateStatus(isSyncing: true);
    
    try {
      final pendingTransactions = await _db.getPendingTransactions();
      
      if (pendingTransactions.isEmpty) {
        _isSyncing = false;
        _updateStatus(isSyncing: false);
        return SyncResult(success: true, processed: 0, failed: 0, pendingCount: 0);
      }
      
      // Convertir en format API
      final transactions = pendingTransactions.map((t) => {
        return {
          'id': t.id,
          'type': t.type,
          'data': jsonDecode(t.data),
          'createdAt': t.createdAt.toIso8601String(),
        };
      }).toList();
      
      final response = await _api.post('/sync/push', data: {
        'transactions': transactions,
      });
      
      if (!response.success) {
        throw Exception(response.errorMessage ?? 'Échec du push');
      }
      
      final result = response.data;
      final processedIds = (result['processed'] as List<dynamic>).cast<String>();
      final failed = result['failed'] as List<dynamic>;
      
      // Supprimer les transactions traitées avec succès
      for (final id in processedIds) {
        await _db.deletePendingTransaction(id);
        
        // Marquer la livraison comme synchronisée
        final transaction = pendingTransactions.firstWhere((t) => t.id == id);
        if (transaction.entityId.isNotEmpty) {
          await _db.markDeliverySynced(transaction.entityId);
        }
      }
      
      // Mettre à jour les transactions échouées
      for (final fail in failed) {
        await _db.incrementRetryCount(fail['id'], fail['error']);
      }
      
      final remainingCount = await _db.getPendingTransactionCount();
      
      _isSyncing = false;
      _updateStatus(isSyncing: false, pendingCount: remainingCount);
      
      return SyncResult(
        success: failed.isEmpty || processedIds.isNotEmpty,
        processed: processedIds.length,
        failed: failed.length,
        pendingCount: remainingCount,
        errors: failed.map((f) => f['error'] as String).toList(),
      );
    } catch (e) {
      _isSyncing = false;
      _updateStatus(isSyncing: false, error: e.toString());
      return SyncResult(
        success: false,
        pendingCount: await _db.getPendingTransactionCount(),
        errors: [e.toString()],
      );
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // AJOUTER UNE TRANSACTION EN ATTENTE
  // ═══════════════════════════════════════════════════════════════════════════
  
  Future<String> queueTransaction({
    required String type,
    required String entityId,
    required Map<String, dynamic> data,
  }) async {
    final id = '${DateTime.now().millisecondsSinceEpoch}_${_generateRandomString(6)}';
    
    await _db.insertPendingTransaction(PendingTransactionsCompanion(
      id: Value(id),
      type: Value(type),
      entityId: Value(entityId),
      data: Value(jsonEncode(data)),
      createdAt: Value(DateTime.now()),
      retryCount: const Value(0),
    ));
    
    // Essayer de synchroniser immédiatement si online
    if (_connectivity.isOnline) {
      syncPendingTransactions();
    }
    
    final pendingCount = await _db.getPendingTransactionCount();
    _updateStatus(pendingCount: pendingCount);
    
    return id;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SAUVEGARDER LES LIVRAISONS
  // ═══════════════════════════════════════════════════════════════════════════
  
  Future<void> _saveDeliveries(List<dynamic> deliveries) async {
    for (final d in deliveries) {
      final order = d['order'];
      final customer = order?['customer'];
      
      await _db.insertDelivery(LocalDeliveriesCompanion(
        id: Value(d['id']),
        organizationId: Value(d['organizationId']),
        orderId: Value(d['orderId']),
        delivererId: Value(d['delivererId']),
        status: Value(d['status']),
        scheduledDate: Value(DateTime.parse(d['scheduledDate'])),
        scheduledTime: Value(d['scheduledTime']),
        sequenceNumber: Value(d['sequenceNumber']),
        orderAmount: Value((d['orderAmount'] as num).toDouble()),
        existingDebt: Value((d['existingDebt'] as num?)?.toDouble() ?? 0),
        totalToCollect: Value((d['totalToCollect'] as num?)?.toDouble() ?? 
            (d['orderAmount'] as num).toDouble()),
        amountCollected: Value(d['amountCollected'] != null 
            ? (d['amountCollected'] as num).toDouble() 
            : null),
        collectionMode: Value(d['collectionMode']),
        assignedAt: Value(d['assignedAt'] != null 
            ? DateTime.parse(d['assignedAt']) 
            : null),
        pickedUpAt: Value(d['pickedUpAt'] != null 
            ? DateTime.parse(d['pickedUpAt']) 
            : null),
        arrivedAt: Value(d['arrivedAt'] != null 
            ? DateTime.parse(d['arrivedAt']) 
            : null),
        completedAt: Value(d['completedAt'] != null 
            ? DateTime.parse(d['completedAt']) 
            : null),
        proofOfDelivery: Value(d['proofOfDelivery'] != null 
            ? jsonEncode(d['proofOfDelivery']) 
            : null),
        failureReason: Value(d['failureReason']),
        notes: Value(d['notes']),
        createdAt: Value(DateTime.parse(d['createdAt'])),
        updatedAt: Value(d['updatedAt'] != null 
            ? DateTime.parse(d['updatedAt']) 
            : null),
        isSynced: const Value(true),
        syncedAt: Value(DateTime.now()),
        customerData: Value(customer != null ? jsonEncode(customer) : '{}'),
        orderData: Value(order != null ? jsonEncode(order) : '{}'),
      ));
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // MISE À JOUR DU STATUT
  // ═══════════════════════════════════════════════════════════════════════════
  
  void _updateStatus({
    bool? isSyncing,
    int? pendingCount,
    String? error,
  }) async {
    final count = pendingCount ?? await _db.getPendingTransactionCount();
    
    _syncStatusController.add(SyncStatus(
      isOnline: _connectivity.isOnline,
      isSyncing: isSyncing ?? _isSyncing,
      pendingCount: count,
      lastSyncAt: await _db.getLastSyncAt(),
      lastError: error,
    ));
  }
  
  String _generateRandomString(int length) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return List.generate(length, (_) => chars[(DateTime.now().millisecond + _) % chars.length]).join();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODÈLES
// ═══════════════════════════════════════════════════════════════════════════════

class SyncResult {
  final bool success;
  final int processed;
  final int failed;
  final int pendingCount;
  final List<String> errors;
  
  SyncResult({
    required this.success,
    this.processed = 0,
    this.failed = 0,
    required this.pendingCount,
    this.errors = const [],
  });
}

class SyncStatus {
  final bool isOnline;
  final bool isSyncing;
  final int pendingCount;
  final DateTime? lastSyncAt;
  final String? lastError;
  
  SyncStatus({
    required this.isOnline,
    required this.isSyncing,
    required this.pendingCount,
    this.lastSyncAt,
    this.lastError,
  });
  
  bool get hasPendingTransactions => pendingCount > 0;
  bool get hasError => lastError != null;
}
