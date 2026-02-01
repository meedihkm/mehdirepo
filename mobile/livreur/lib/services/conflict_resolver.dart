// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - CONFLICT RESOLVER
// Résolution de conflits lors de la synchronisation offline → online
// Stratégie: last-write-wins + merge intelligent pour les livraisons
// ═══════════════════════════════════════════════════════════════════════════════

import 'dart:convert';
import 'package:flutter/foundation.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

enum ConflictType {
  statusConflict,     // Même livraison, statuts différents
  dataConflict,       // Même entité, données différentes
  deletedRemotely,    // Entité supprimée côté serveur
  concurrentEdit,     // Modifié offline ET online
}

enum ResolutionStrategy {
  localWins,          // Donnée locale prioritaire
  remoteWins,         // Donnée serveur prioritaire
  merge,              // Fusion intelligente
  manual,             // Demander à l'utilisateur
}

class ConflictRecord {
  final String entityType;
  final String entityId;
  final ConflictType type;
  final Map<String, dynamic> localData;
  final Map<String, dynamic> remoteData;
  final Map<String, dynamic>? resolvedData;
  final ResolutionStrategy strategy;
  final DateTime detectedAt;
  final bool isResolved;

  ConflictRecord({
    required this.entityType,
    required this.entityId,
    required this.type,
    required this.localData,
    required this.remoteData,
    this.resolvedData,
    required this.strategy,
    DateTime? detectedAt,
    this.isResolved = false,
  }) : detectedAt = detectedAt ?? DateTime.now();
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFLICT RESOLVER
// ═══════════════════════════════════════════════════════════════════════════════

class ConflictResolver {
  final List<ConflictRecord> _conflicts = [];
  List<ConflictRecord> get conflicts => List.unmodifiable(_conflicts);
  List<ConflictRecord> get unresolvedConflicts =>
      _conflicts.where((c) => !c.isResolved).toList();

  // ─── DELIVERY STATUS RESOLUTION ────────────────────────────────────────
  // Hiérarchie des statuts: assigned → in_progress → completed/failed
  // Un statut plus avancé gagne toujours

  static const _deliveryStatusOrder = {
    'assigned': 0,
    'in_progress': 1,
    'arriving': 2,
    'completed': 3,
    'failed': 3,       // Même niveau que completed (terminal)
    'cancelled': 4,    // Serveur peut annuler
  };

  Map<String, dynamic> resolveDeliveryStatus({
    required Map<String, dynamic> localData,
    required Map<String, dynamic> remoteData,
  }) {
    final localStatus = localData['status'] as String? ?? 'assigned';
    final remoteStatus = remoteData['status'] as String? ?? 'assigned';

    final localOrder = _deliveryStatusOrder[localStatus] ?? 0;
    final remoteOrder = _deliveryStatusOrder[remoteStatus] ?? 0;

    // Si serveur a annulé → serveur gagne
    if (remoteStatus == 'cancelled') {
      _logConflict('delivery', localData['id'], 'Annulé par serveur → remote wins');
      return remoteData;
    }

    // Si statuts terminaux différents (completed vs failed)
    if (localOrder == 3 && remoteOrder == 3 && localStatus != remoteStatus) {
      // Le local (livreur) sait mieux → local wins
      _logConflict('delivery', localData['id'],
          'Conflit terminal: local=$localStatus remote=$remoteStatus → local wins');
      return _mergeDeliveryData(localData, remoteData, useLocalStatus: true);
    }

    // Le statut le plus avancé gagne
    if (localOrder >= remoteOrder) {
      return _mergeDeliveryData(localData, remoteData, useLocalStatus: true);
    } else {
      return _mergeDeliveryData(localData, remoteData, useLocalStatus: false);
    }
  }

  Map<String, dynamic> _mergeDeliveryData(
    Map<String, dynamic> localData,
    Map<String, dynamic> remoteData, {
    required bool useLocalStatus,
  }) {
    final merged = Map<String, dynamic>.from(remoteData);

    // Toujours garder les données collectées localement
    final localOnlyFields = [
      'amount_collected',
      'payment_mode',
      'delivery_notes',
      'signature_image',
      'photo_proof',
      'completed_at',
      'failed_reason',
      'actual_latitude',
      'actual_longitude',
    ];

    for (final field in localOnlyFields) {
      if (localData[field] != null) {
        merged[field] = localData[field];
      }
    }

    if (useLocalStatus) {
      merged['status'] = localData['status'];
    }

    // Timestamp le plus récent
    final localUpdated = DateTime.tryParse(localData['updated_at'] ?? '');
    final remoteUpdated = DateTime.tryParse(remoteData['updated_at'] ?? '');
    if (localUpdated != null && remoteUpdated != null) {
      merged['updated_at'] = (localUpdated.isAfter(remoteUpdated) ? localUpdated : remoteUpdated)
          .toIso8601String();
    }

    return merged;
  }

  // ─── PAYMENT RESOLUTION ────────────────────────────────────────────────
  // Paiements collectés offline: TOUJOURS garder le local (argent physique)

  Map<String, dynamic> resolvePayment({
    required Map<String, dynamic> localData,
    required Map<String, dynamic> remoteData,
  }) {
    // Un paiement local est toujours valide (argent reçu physiquement)
    _logConflict('payment', localData['id'],
        'Paiement collecté offline → local wins toujours');
    return localData;
  }

  // ─── DAILY CASH RESOLUTION ────────────────────────────────────────────

  Map<String, dynamic> resolveDailyCash({
    required Map<String, dynamic> localData,
    required Map<String, dynamic> remoteData,
  }) {
    // Merge: prendre les montants les plus élevés (car le livreur ajoute)
    final merged = Map<String, dynamic>.from(remoteData);

    final localCash = (localData['cash_collected'] as num?)?.toDouble() ?? 0;
    final remoteCash = (remoteData['cash_collected'] as num?)?.toDouble() ?? 0;
    merged['cash_collected'] = localCash > remoteCash ? localCash : remoteCash;

    final localCheck = (localData['check_collected'] as num?)?.toDouble() ?? 0;
    final remoteCheck = (remoteData['check_collected'] as num?)?.toDouble() ?? 0;
    merged['check_collected'] = localCheck > remoteCheck ? localCheck : remoteCheck;

    // Fusionner les détails de paiements
    final localPayments = localData['payment_details'] as List? ?? [];
    final remotePayments = remoteData['payment_details'] as List? ?? [];
    final allPaymentIds = <String>{};
    final mergedPayments = <Map<String, dynamic>>[];

    for (final p in remotePayments) {
      allPaymentIds.add(p['id']);
      mergedPayments.add(Map<String, dynamic>.from(p));
    }
    for (final p in localPayments) {
      if (!allPaymentIds.contains(p['id'])) {
        mergedPayments.add(Map<String, dynamic>.from(p));
      }
    }
    merged['payment_details'] = mergedPayments;

    return merged;
  }

  // ─── GENERIC RESOLUTION ────────────────────────────────────────────────

  Map<String, dynamic> resolve({
    required String entityType,
    required Map<String, dynamic> localData,
    required Map<String, dynamic> remoteData,
  }) {
    switch (entityType) {
      case 'delivery':
        return resolveDeliveryStatus(localData: localData, remoteData: remoteData);
      case 'payment':
        return resolvePayment(localData: localData, remoteData: remoteData);
      case 'daily_cash':
        return resolveDailyCash(localData: localData, remoteData: remoteData);
      default:
        // Défaut: last-write-wins
        final localTime = DateTime.tryParse(localData['updated_at'] ?? '');
        final remoteTime = DateTime.tryParse(remoteData['updated_at'] ?? '');

        if (localTime != null && remoteTime != null) {
          return localTime.isAfter(remoteTime) ? localData : remoteData;
        }
        return remoteData;
    }
  }

  // ─── LOGGING ───────────────────────────────────────────────────────────

  void _logConflict(String entityType, dynamic entityId, String resolution) {
    debugPrint('[ConflictResolver] $entityType:$entityId → $resolution');
    _conflicts.add(ConflictRecord(
      entityType: entityType,
      entityId: entityId?.toString() ?? 'unknown',
      type: ConflictType.dataConflict,
      localData: {},
      remoteData: {},
      strategy: ResolutionStrategy.merge,
      isResolved: true,
    ));
  }

  void clearHistory() => _conflicts.clear();
}
