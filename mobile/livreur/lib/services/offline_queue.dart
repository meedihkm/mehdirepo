// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - OFFLINE QUEUE
// File d'attente persistante pour opérations hors-ligne
// Stocke en SQLite, rejouent à la reconnexion avec retry et backoff
// ═══════════════════════════════════════════════════════════════════════════════

import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import 'package:uuid/uuid.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// MODELS
// ═══════════════════════════════════════════════════════════════════════════════

enum QueueItemStatus { pending, processing, failed, completed }

enum QueuePriority {
  critical, // Compléter livraison, encaisser paiement
  high,     // Mise à jour statut livraison
  normal,   // Sync données
  low,      // Logs, analytics
}

class QueueItem {
  final String id;
  final String operation;     // 'delivery.complete', 'delivery.fail', 'payment.collect', etc.
  final String entityType;    // 'delivery', 'payment', 'daily_cash'
  final String entityId;
  final Map<String, dynamic> payload;
  final QueuePriority priority;
  final QueueItemStatus status;
  final DateTime createdAt;
  final DateTime? processedAt;
  final int retryCount;
  final int maxRetries;
  final String? errorMessage;
  final String? serverResponse;

  QueueItem({
    String? id,
    required this.operation,
    required this.entityType,
    required this.entityId,
    required this.payload,
    this.priority = QueuePriority.normal,
    this.status = QueueItemStatus.pending,
    DateTime? createdAt,
    this.processedAt,
    this.retryCount = 0,
    this.maxRetries = 5,
    this.errorMessage,
    this.serverResponse,
  })  : id = id ?? const Uuid().v4(),
        createdAt = createdAt ?? DateTime.now();

  Map<String, dynamic> toMap() => {
    'id': id,
    'operation': operation,
    'entity_type': entityType,
    'entity_id': entityId,
    'payload': jsonEncode(payload),
    'priority': priority.index,
    'status': status.name,
    'created_at': createdAt.toIso8601String(),
    'processed_at': processedAt?.toIso8601String(),
    'retry_count': retryCount,
    'max_retries': maxRetries,
    'error_message': errorMessage,
    'server_response': serverResponse,
  };

  factory QueueItem.fromMap(Map<String, dynamic> map) => QueueItem(
    id: map['id'],
    operation: map['operation'],
    entityType: map['entity_type'],
    entityId: map['entity_id'],
    payload: jsonDecode(map['payload']),
    priority: QueuePriority.values[map['priority'] ?? 2],
    status: QueueItemStatus.values.firstWhere((s) => s.name == map['status']),
    createdAt: DateTime.parse(map['created_at']),
    processedAt: map['processed_at'] != null ? DateTime.parse(map['processed_at']) : null,
    retryCount: map['retry_count'] ?? 0,
    maxRetries: map['max_retries'] ?? 5,
    errorMessage: map['error_message'],
    serverResponse: map['server_response'],
  );

  QueueItem copyWith({
    QueueItemStatus? status,
    int? retryCount,
    String? errorMessage,
    String? serverResponse,
    DateTime? processedAt,
  }) => QueueItem(
    id: id,
    operation: operation,
    entityType: entityType,
    entityId: entityId,
    payload: payload,
    priority: priority,
    status: status ?? this.status,
    createdAt: createdAt,
    processedAt: processedAt ?? this.processedAt,
    retryCount: retryCount ?? this.retryCount,
    maxRetries: maxRetries,
    errorMessage: errorMessage ?? this.errorMessage,
    serverResponse: serverResponse ?? this.serverResponse,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// OFFLINE QUEUE
// ═══════════════════════════════════════════════════════════════════════════════

typedef QueueProcessor = Future<bool> Function(QueueItem item);

class OfflineQueue {
  Database? _db;
  bool _isProcessing = false;
  final Map<String, QueueProcessor> _processors = {};

  final _queueController = StreamController<List<QueueItem>>.broadcast();
  Stream<List<QueueItem>> get queueStream => _queueController.stream;

  final _processingController = StreamController<QueueItem>.broadcast();
  Stream<QueueItem> get processingStream => _processingController.stream;

  // ─── INITIALISATION ────────────────────────────────────────────────────

  Future<void> initialize() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, 'awid_offline_queue.db');

    _db = await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE queue_items (
            id TEXT PRIMARY KEY,
            operation TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            payload TEXT NOT NULL,
            priority INTEGER DEFAULT 2,
            status TEXT DEFAULT 'pending',
            created_at TEXT NOT NULL,
            processed_at TEXT,
            retry_count INTEGER DEFAULT 0,
            max_retries INTEGER DEFAULT 5,
            error_message TEXT,
            server_response TEXT
          )
        ''');

        await db.execute('''
          CREATE INDEX idx_queue_status ON queue_items(status, priority, created_at)
        ''');
      },
    );

    debugPrint('[OfflineQueue] Initialisée. ${await pendingCount()} items en attente.');
  }

  // ─── ENREGISTREMENT PROCESSORS ─────────────────────────────────────────

  void registerProcessor(String operation, QueueProcessor processor) {
    _processors[operation] = processor;
    debugPrint('[OfflineQueue] Processeur enregistré: $operation');
  }

  // ─── AJOUT EN QUEUE ────────────────────────────────────────────────────

  Future<QueueItem> enqueue({
    required String operation,
    required String entityType,
    required String entityId,
    required Map<String, dynamic> payload,
    QueuePriority priority = QueuePriority.normal,
  }) async {
    final item = QueueItem(
      operation: operation,
      entityType: entityType,
      entityId: entityId,
      payload: payload,
      priority: priority,
    );

    await _db!.insert('queue_items', item.toMap(),
        conflictAlgorithm: ConflictAlgorithm.replace);

    debugPrint('[OfflineQueue] + $operation pour $entityType:$entityId (priorité: ${priority.name})');
    _notifyQueueChanged();

    return item;
  }

  // ─── TRAITEMENT DE LA QUEUE ────────────────────────────────────────────

  Future<int> processQueue() async {
    if (_isProcessing) {
      debugPrint('[OfflineQueue] Traitement déjà en cours, skip.');
      return 0;
    }

    _isProcessing = true;
    int processed = 0;

    try {
      // Récupérer items par priorité puis par date
      final items = await _getPendingItems();
      debugPrint('[OfflineQueue] ${items.length} items à traiter');

      for (final item in items) {
        final processor = _processors[item.operation];

        if (processor == null) {
          debugPrint('[OfflineQueue] ⚠️ Pas de processeur pour: ${item.operation}');
          await _updateItem(item.copyWith(
            status: QueueItemStatus.failed,
            errorMessage: 'Aucun processeur enregistré pour ${item.operation}',
          ));
          continue;
        }

        // Marquer comme en cours
        _processingController.add(item);
        await _updateItem(item.copyWith(status: QueueItemStatus.processing));

        try {
          final success = await processor(item);

          if (success) {
            await _updateItem(item.copyWith(
              status: QueueItemStatus.completed,
              processedAt: DateTime.now(),
            ));
            processed++;
            debugPrint('[OfflineQueue] ✅ ${item.operation} traité');
          } else {
            await _handleFailure(item, 'Processeur a retourné false');
          }
        } catch (e) {
          await _handleFailure(item, e.toString());
        }
      }

      // Nettoyer les items complétés (garder 24h pour historique)
      final cutoff = DateTime.now().subtract(const Duration(hours: 24));
      await _db!.delete('queue_items',
        where: 'status = ? AND processed_at < ?',
        whereArgs: ['completed', cutoff.toIso8601String()],
      );

    } finally {
      _isProcessing = false;
      _notifyQueueChanged();
    }

    debugPrint('[OfflineQueue] Traitement terminé: $processed/${ await pendingCount() + processed} réussis');
    return processed;
  }

  Future<void> _handleFailure(QueueItem item, String error) async {
    final newRetryCount = item.retryCount + 1;

    if (newRetryCount >= item.maxRetries) {
      debugPrint('[OfflineQueue] ❌ ${item.operation} - Max retries atteint');
      await _updateItem(item.copyWith(
        status: QueueItemStatus.failed,
        retryCount: newRetryCount,
        errorMessage: error,
      ));
    } else {
      debugPrint('[OfflineQueue] ⚠️ ${item.operation} - Retry ${newRetryCount}/${item.maxRetries}');
      await _updateItem(item.copyWith(
        status: QueueItemStatus.pending,
        retryCount: newRetryCount,
        errorMessage: error,
      ));
    }
  }

  // ─── HELPERS DB ────────────────────────────────────────────────────────

  Future<List<QueueItem>> _getPendingItems() async {
    final maps = await _db!.query(
      'queue_items',
      where: 'status IN (?, ?)',
      whereArgs: ['pending', 'processing'],
      orderBy: 'priority ASC, created_at ASC',
    );
    return maps.map((m) => QueueItem.fromMap(m)).toList();
  }

  Future<void> _updateItem(QueueItem item) async {
    await _db!.update('queue_items', item.toMap(),
        where: 'id = ?', whereArgs: [item.id]);
  }

  Future<int> pendingCount() async {
    final result = await _db!.rawQuery(
      'SELECT COUNT(*) as c FROM queue_items WHERE status IN (?, ?)',
      ['pending', 'processing'],
    );
    return Sqflite.firstIntValue(result) ?? 0;
  }

  Future<int> failedCount() async {
    final result = await _db!.rawQuery(
      'SELECT COUNT(*) as c FROM queue_items WHERE status = ?',
      ['failed'],
    );
    return Sqflite.firstIntValue(result) ?? 0;
  }

  Future<List<QueueItem>> getAllItems() async {
    final maps = await _db!.query('queue_items', orderBy: 'created_at DESC');
    return maps.map((m) => QueueItem.fromMap(m)).toList();
  }

  Future<void> retryFailed() async {
    await _db!.update('queue_items',
      {'status': 'pending', 'retry_count': 0, 'error_message': null},
      where: 'status = ?',
      whereArgs: ['failed'],
    );
    _notifyQueueChanged();
  }

  Future<void> removeItem(String id) async {
    await _db!.delete('queue_items', where: 'id = ?', whereArgs: [id]);
    _notifyQueueChanged();
  }

  Future<void> clearCompleted() async {
    await _db!.delete('queue_items', where: 'status = ?', whereArgs: ['completed']);
    _notifyQueueChanged();
  }

  void _notifyQueueChanged() async {
    final items = await getAllItems();
    _queueController.add(items);
  }

  Future<void> dispose() async {
    _queueController.close();
    _processingController.close();
    await _db?.close();
  }
}
