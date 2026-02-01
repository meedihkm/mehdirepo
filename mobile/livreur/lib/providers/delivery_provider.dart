// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - PROVIDERS LIVRAISON
// Gestion d'état avec Riverpod
// ═══════════════════════════════════════════════════════════════════════════════

import 'dart:convert';
import 'dart:math';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../database/database.dart';
import '../models/delivery.dart';
import '../services/api_service.dart';
import '../services/sync_service.dart';
import '../services/connectivity_manager.dart';
import '../services/storage_service.dart';
import '../services/location_service.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════

final databaseProvider = Provider<AppDatabase>((ref) => AppDatabase());

final deliveriesProvider = StreamProvider<List<Delivery>>((ref) {
  final db = ref.watch(databaseProvider);
  final date = ref.watch(selectedDateProvider);
  
  return db.getDeliveriesForDate(date).map((localDeliveries) {
    return localDeliveries.map((d) => _mapLocalToDelivery(d)).toList();
  });
});

final selectedDateProvider = StateProvider<DateTime>((ref) => DateTime.now());

final deliveryDetailProvider = FutureProvider.family<Delivery, String>((ref, id) async {
  final db = ref.watch(databaseProvider);
  final local = await db.getDelivery(id);
  
  if (local == null) {
    throw Exception('Livraison non trouvée');
  }
  
  return _mapLocalToDelivery(local);
});

final myRouteProvider = FutureProvider<List<Delivery>>((ref) async {
  final api = ref.watch(apiServiceProvider);
  final db = ref.watch(databaseProvider);
  final connectivity = ref.watch(connectivityManagerProvider);
  final date = ref.watch(selectedDateProvider);
  
  // Si online, récupérer depuis le serveur
  if (connectivity.isOnline) {
    final response = await api.getMyRoute(date: date);
    
    if (response.success && response.data != null) {
      // Sauvegarder en local
      for (final delivery in response.data!) {
        await _saveDeliveryToLocal(db, delivery);
      }
    }
  }
  
  // Récupérer depuis la base locale
  final localDeliveries = await db.getDeliveriesForDate(date);
  return localDeliveries.map((d) => _mapLocalToDelivery(d)).toList();
});

final deliveryNotifierProvider = StateNotifierProvider<DeliveryNotifier, AsyncValue<void>>((ref) {
  return DeliveryNotifier(ref);
});

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFIER
// ═══════════════════════════════════════════════════════════════════════════════

class DeliveryNotifier extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;
  
  DeliveryNotifier(this._ref) : super(const AsyncValue.data(null));
  
  Future<DeliveryCompletionResult?> completeDelivery(
    String deliveryId,
    CompleteDeliveryRequest request,
  ) async {
    state = const AsyncValue.loading();
    
    try {
      final api = _ref.read(apiServiceProvider);
      final db = _ref.read(databaseProvider);
      final sync = _ref.read(syncServiceProvider);
      final connectivity = _ref.read(connectivityManagerProvider);
      
      // Si online, envoyer directement au serveur
      if (connectivity.isOnline) {
        final response = await api.completeDelivery(
          deliveryId,
          amountCollected: request.amountCollected,
          collectionMode: request.collectionMode.name,
          notes: request.notes,
          signature: request.signature != null ? {
            'data': request.signature!.data,
            'name': request.signature!.name,
          } : null,
          location: request.location != null ? {
            'lat': request.location!.lat,
            'lng': request.location!.lng,
          } : null,
        );
        
        if (response.success) {
          // Mettre à jour la base locale
          await _updateLocalDeliveryStatus(
            db,
            deliveryId,
            'delivered',
            request.amountCollected,
          );
          
          state = const AsyncValue.data(null);
          return response.data != null 
              ? _mapApiResultToCompletionResult(response.data!)
              : null;
        } else {
          throw Exception(response.errorMessage);
        }
      } else {
        // Mode offline: mettre en file d'attente
        await sync.queueTransaction(
          type: 'delivery_complete',
          entityId: deliveryId,
          data: {
            'deliveryId': deliveryId,
            'amountCollected': request.amountCollected,
            'collectionMode': request.collectionMode.name,
            'notes': request.notes,
            'signature': request.signature?.toJson(),
            'location': request.location?.toJson(),
          },
        );
        
        // Mettre à jour le statut localement
        await _updateLocalDeliveryStatus(
          db,
          deliveryId,
          'delivered',
          request.amountCollected,
        );
        
        state = const AsyncValue.data(null);
        
        // Retourner un résultat simulé
        return DeliveryCompletionResult(
          delivery: await _getLocalDelivery(deliveryId),
          transaction: TransactionDetail(
            orderAmount: 0, // Sera calculé côté serveur
            debtBefore: 0,
            amountPaid: request.amountCollected,
            appliedToOrder: 0,
            appliedToDebt: 0,
            newDebtCreated: 0,
            debtAfter: 0,
          ),
          customer: const CustomerSummary(
            id: '',
            name: '',
            currentDebt: 0,
            creditLimit: 0,
          ),
        );
      }
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
      return null;
    }
  }
  
  Future<void> failDelivery(String deliveryId, String reason) async {
    state = const AsyncValue.loading();
    
    try {
      final api = _ref.read(apiServiceProvider);
      final db = _ref.read(databaseProvider);
      final sync = _ref.read(syncServiceProvider);
      final connectivity = _ref.read(connectivityManagerProvider);
      
      if (connectivity.isOnline) {
        final response = await api.failDelivery(deliveryId, reason: reason);
        
        if (!response.success) {
          throw Exception(response.errorMessage);
        }
      } else {
        await sync.queueTransaction(
          type: 'delivery_fail',
          entityId: deliveryId,
          data: {
            'deliveryId': deliveryId,
            'reason': reason,
          },
        );
      }
      
      // Mettre à jour localement
      await _updateLocalDeliveryStatus(db, deliveryId, 'failed', null);
      
      state = const AsyncValue.data(null);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }
  
  Future<void> updateStatus(String deliveryId, String status) async {
    state = const AsyncValue.loading();
    
    try {
      final api = _ref.read(apiServiceProvider);
      final db = _ref.read(databaseProvider);
      final connectivity = _ref.read(connectivityManagerProvider);
      
      if (connectivity.isOnline) {
        await api.updateDeliveryStatus(deliveryId, status: status);
      }
      
      // Mettre à jour localement
      await db.updateDelivery(
        deliveryId,
        LocalDeliveriesCompanion(
          status: Value(status),
          updatedAt: Value(DateTime.now()),
        ),
      );
      
      state = const AsyncValue.data(null);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }
  
  Future<void> collectDebt(CollectDebtRequest request) async {
    state = const AsyncValue.loading();
    
    try {
      final api = _ref.read(apiServiceProvider);
      final sync = _ref.read(syncServiceProvider);
      final connectivity = _ref.read(connectivityManagerProvider);
      
      if (connectivity.isOnline) {
        final response = await api.collectDebt(
          customerId: request.customerId,
          amount: request.amount,
          collectionMode: request.collectionMode.name,
          notes: request.notes,
        );
        
        if (!response.success) {
          throw Exception(response.errorMessage);
        }
      } else {
        await sync.queueTransaction(
          type: 'debt_collection',
          entityId: request.customerId,
          data: {
            'customerId': request.customerId,
            'amount': request.amount,
            'collectionMode': request.collectionMode.name,
            'notes': request.notes,
          },
        );
      }
      
      state = const AsyncValue.data(null);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  /// Optimise l'ordre des livraisons en fonction de la position actuelle
  Future<void> optimizeRoute(List<String> deliveryIds) async {
    if (deliveryIds.length < 2) return;

    try {
      final locationService = _ref.read(locationServiceProvider);
      final position = await locationService.getCurrentPosition();
      if (position == null) {
        throw Exception('Position actuelle non disponible');
      }

      final currentPos = LatLng(position.latitude, position.longitude);

      // Récupérer les livraisons à optimiser depuis la base de données
      final db = _ref.read(databaseProvider);
      final allLocalDeliveries = await db.getAllDeliveries();
      final deliveriesToOptimize = allLocalDeliveries
          .where((d) =>
              deliveryIds.contains(d.id) && d.status != 'delivered')
          .map((d) => _mapLocalToDelivery(d))
          .toList();

      if (deliveriesToOptimize.length < 2) {
        return;
      }

      // Algorithme du plus proche voisin (Nearest Neighbor)
      final optimized = <Delivery>[];
      var currentPosition = currentPos;
      final remaining = List<Delivery>.from(deliveriesToOptimize);

      while (remaining.isNotEmpty) {
        // Trouver la livraison la plus proche
        Delivery? nearest;
        double minDistance = double.infinity;

        for (final delivery in remaining) {
          final deliveryPos = LatLng(
            delivery.customer?.coordinates?.lat ?? 0,
            delivery.customer?.coordinates?.lng ?? 0,
          );

          // Ignorer les livraisons sans coordonnées valides
          if (deliveryPos.latitude == 0 && deliveryPos.longitude == 0) {
            continue;
          }

          final distance = _calculateDistance(currentPosition, deliveryPos);
          if (distance < minDistance) {
            minDistance = distance;
            nearest = delivery;
          }
        }

        if (nearest != null) {
          optimized.add(nearest);
          remaining.remove(nearest);
          currentPosition = LatLng(
            nearest.customer?.coordinates?.lat ?? 0,
            nearest.customer?.coordinates?.lng ?? 0,
          );
        } else {
          // Aucune livraison avec coordonnées trouvée, ajouter le reste tel quel
          optimized.addAll(remaining);
          break;
        }
      }

      // Mettre à jour l'ordre dans la base de données
      for (int i = 0; i < optimized.length; i++) {
        await db.updateDeliverySequence(optimized[i].id, i + 1);
      }

      // Sauvegarder l'ordre localement
      await _saveRouteOrder(optimized);
    } catch (e, stack) {
      throw Exception('Erreur lors de l\'optimisation: $e');
    }
  }

  /// Calcule la distance entre deux points (formule de Haversine)
  double _calculateDistance(LatLng p1, LatLng p2) {
    const earthRadius = 6371000; // en mètres

    final dLat = _toRadians(p2.latitude - p1.latitude);
    final dLon = _toRadians(p2.longitude - p1.longitude);

    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(_toRadians(p1.latitude)) *
            cos(_toRadians(p2.latitude)) *
            sin(dLon / 2) *
            sin(dLon / 2);

    final c = 2 * atan2(sqrt(a), sqrt(1 - a));

    return earthRadius * c;
  }

  double _toRadians(double degrees) {
    return degrees * pi / 180;
  }

  /// Sauvegarde l'ordre des livraisons
  Future<void> _saveRouteOrder(List<Delivery> deliveries) async {
    final storage = StorageService();
    await storage.initialize();
    final orderData = deliveries.map((d) => d.id).toList();
    await storage.setString('route_order', jsonEncode(orderData));
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ───────────────────────────────────────────────────────────────────────────
  
  Future<void> _updateLocalDeliveryStatus(
    AppDatabase db,
    String deliveryId,
    String status,
    double? amountCollected,
  ) async {
    await db.updateDelivery(
      deliveryId,
      LocalDeliveriesCompanion(
        status: Value(status),
        amountCollected: amountCollected != null ? Value(amountCollected) : const Value.absent(),
        completedAt: Value(DateTime.now()),
        updatedAt: Value(DateTime.now()),
        isSynced: const Value(false),
      ),
    );
  }
  
  Future<Delivery> _getLocalDelivery(String id) async {
    final db = _ref.read(databaseProvider);
    final local = await db.getDelivery(id);
    if (local == null) throw Exception('Delivery not found');
    return _mapLocalToDelivery(local);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAPPERS
// ═══════════════════════════════════════════════════════════════════════════════

Delivery _mapLocalToDelivery(LocalDelivery local) {
  final customerData = jsonDecode(local.customerData) as Map<String, dynamic>;
  final orderData = jsonDecode(local.orderData) as Map<String, dynamic>;
  
  return Delivery(
    id: local.id,
    organizationId: local.organizationId,
    orderId: local.orderId,
    delivererId: local.delivererId,
    status: DeliveryStatus.values.firstWhere(
      (e) => e.name == local.status,
      orElse: () => DeliveryStatus.pending,
    ),
    scheduledDate: local.scheduledDate,
    scheduledTime: local.scheduledTime,
    sequenceNumber: local.sequenceNumber,
    orderAmount: local.orderAmount,
    existingDebt: local.existingDebt,
    totalToCollect: local.totalToCollect,
    amountCollected: local.amountCollected,
    collectionMode: local.collectionMode != null
        ? PaymentMode.values.firstWhere(
            (e) => e.name == local.collectionMode,
            orElse: () => PaymentMode.cash,
          )
        : null,
    assignedAt: local.assignedAt,
    pickedUpAt: local.pickedUpAt,
    arrivedAt: local.arrivedAt,
    completedAt: local.completedAt,
    proofOfDelivery: local.proofOfDelivery != null
        ? ProofOfDelivery.fromJson(jsonDecode(local.proofOfDelivery!))
        : null,
    failureReason: local.failureReason,
    notes: local.notes,
    createdAt: local.createdAt,
    updatedAt: local.updatedAt,
    customer: CustomerInfo(
      id: customerData['id'] ?? '',
      name: customerData['name'] ?? '',
      phone: customerData['phone'] ?? '',
      address: customerData['address'] ?? '',
      city: customerData['city'],
      zone: customerData['zone'],
      coordinates: customerData['coordinates'] != null
          ? Coordinates.fromJson(customerData['coordinates'])
          : null,
      currentDebt: (customerData['currentDebt'] as num?)?.toDouble() ?? 0,
      creditLimit: (customerData['creditLimit'] as num?)?.toDouble() ?? 0,
      creditLimitEnabled: customerData['creditLimitEnabled'],
      deliveryNotes: customerData['deliveryNotes'],
    ),
    order: OrderInfo(
      id: orderData['id'] ?? '',
      orderNumber: orderData['orderNumber'] ?? '',
      status: orderData['status'] ?? '',
      paymentStatus: orderData['paymentStatus'] ?? '',
      subtotal: (orderData['subtotal'] as num?)?.toDouble() ?? 0,
      total: (orderData['total'] as num?)?.toDouble() ?? 0,
      customer: CustomerInfo(
        id: customerData['id'] ?? '',
        name: customerData['name'] ?? '',
        phone: customerData['phone'] ?? '',
        address: customerData['address'] ?? '',
        currentDebt: (customerData['currentDebt'] as num?)?.toDouble() ?? 0,
        creditLimit: (customerData['creditLimit'] as num?)?.toDouble() ?? 0,
      ),
      items: (orderData['items'] as List<dynamic>?)
              ?.map((i) => OrderItem(
                    id: i['id'] ?? '',
                    productId: i['productId'] ?? '',
                    productName: i['productName'] ?? i['product_name_snapshot'] ?? '',
                    quantity: (i['quantity'] as num?)?.toDouble() ?? 0,
                    unitPrice: (i['unitPrice'] ?? i['unit_price_snapshot'] as num?)?.toDouble() ?? 0,
                    totalPrice: (i['totalPrice'] ?? i['total_price'] as num?)?.toDouble() ?? 0,
                  ))
              .toList() ??
          [],
    ),
  );
}

Future<void> _saveDeliveryToLocal(AppDatabase db, DeliveryInfo delivery) async {
  // Sauvegarder les données de l'API dans la base locale
  final customer = delivery.order.customer;
  
  await db.insertDelivery(LocalDeliveriesCompanion(
    id: Value(delivery.id),
    organizationId: Value(''), // Sera rempli par le backend
    orderId: Value(delivery.order.id),
    delivererId: Value(''), // Sera rempli par le backend
    status: Value(delivery.status),
    scheduledDate: Value(delivery.scheduledDate),
    sequenceNumber: Value(delivery.sequenceNumber),
    orderAmount: Value(delivery.orderAmount),
    existingDebt: Value(0), // Sera calculé
    totalToCollect: Value(delivery.totalToCollect),
    customerData: Value(jsonEncode({
      'id': customer.id,
      'name': customer.name,
      'phone': customer.phone,
      'address': customer.address,
      'currentDebt': customer.currentDebt,
      'creditLimit': customer.creditLimit,
    })),
    orderData: Value(jsonEncode({
      'id': delivery.order.id,
      'orderNumber': delivery.order.orderNumber,
      'status': delivery.order.status,
      'total': delivery.order.total,
      'items': delivery.order.items.map((i) => {
        'id': i.id,
        'productId': i.productId,
        'productName': i.productName,
        'quantity': i.quantity,
        'unitPrice': i.unitPrice,
        'totalPrice': i.totalPrice,
      }).toList(),
    })),
    createdAt: Value(DateTime.now()),
    isSynced: const Value(true),
  ));
}

DeliveryCompletionResult _mapApiResultToCompletionResult(CompleteDeliveryResult result) {
  return DeliveryCompletionResult(
    delivery: Delivery(
      id: result.delivery.id,
      organizationId: '', // À remplir si nécessaire
      orderId: result.delivery.order.id,
      delivererId: '',
      status: DeliveryStatus.delivered,
      scheduledDate: result.delivery.scheduledDate,
      orderAmount: result.transaction.orderAmount,
      existingDebt: result.transaction.debtBefore,
      totalToCollect: result.transaction.orderAmount + result.transaction.debtBefore,
      amountCollected: result.transaction.amountPaid,
      createdAt: DateTime.now(),
      customer: CustomerInfo(
        id: result.customer.id,
        name: result.customer.name,
        phone: '',
        address: '',
        currentDebt: result.customer.currentDebt,
        creditLimit: result.customer.creditLimit,
      ),
    ),
    transaction: TransactionDetail(
      orderAmount: result.transaction.orderAmount,
      debtBefore: result.transaction.debtBefore,
      amountPaid: result.transaction.amountPaid,
      appliedToOrder: result.transaction.appliedToOrder,
      appliedToDebt: result.transaction.appliedToDebt,
      newDebtCreated: result.transaction.newDebtCreated,
      debtAfter: result.transaction.debtAfter,
    ),
    customer: CustomerSummary(
      id: result.customer.id,
      name: result.customer.name,
      currentDebt: result.customer.currentDebt,
      creditLimit: result.customer.creditLimit,
    ),
  );
}
