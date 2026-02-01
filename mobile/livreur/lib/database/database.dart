// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - BASE DE DONNÉES LOCALE (DRIFT)
// SQLite pour mode offline
// ═══════════════════════════════════════════════════════════════════════════════

import 'dart:io';
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;

part 'database.g.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// TABLES
// ═══════════════════════════════════════════════════════════════════════════════

// Table des livraisons (cache offline)
class LocalDeliveries extends Table {
  TextColumn get id => text()();
  TextColumn get organizationId => text()();
  TextColumn get orderId => text()();
  TextColumn get delivererId => text()();
  TextColumn get status => text()();
  DateTimeColumn get scheduledDate => dateTime()();
  TextColumn get scheduledTime => text().nullable()();
  IntColumn get sequenceNumber => integer().nullable()();
  RealColumn get orderAmount => real()();
  RealColumn get existingDebt => real()();
  RealColumn get totalToCollect => real()();
  RealColumn get amountCollected => real().nullable()();
  TextColumn get collectionMode => text().nullable()();
  DateTimeColumn get assignedAt => dateTime().nullable()();
  DateTimeColumn get pickedUpAt => dateTime().nullable()();
  DateTimeColumn get arrivedAt => dateTime().nullable()();
  DateTimeColumn get completedAt => dateTime().nullable()();
  TextColumn get proofOfDelivery => text().nullable()(); // JSON
  TextColumn get failureReason => text().nullable()();
  TextColumn get notes => text().nullable()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime().nullable()();
  DateTimeColumn get syncedAt => dateTime().nullable()();
  BoolColumn get isSynced => boolean().withDefault(const Constant(false))();
  
  // Données dénormalisées du client et commande
  TextColumn get customerData => text()(); // JSON
  TextColumn get orderData => text()(); // JSON
  
  @override
  Set<Column> get primaryKey => {id};
  
  @override
  String get tableName => 'local_deliveries';
}

// Table des clients (cache offline)
class LocalCustomers extends Table {
  TextColumn get id => text()();
  TextColumn get organizationId => text()();
  TextColumn get name => text()();
  TextColumn get phone => text()();
  TextColumn get phoneSecondary => text().nullable()();
  TextColumn get address => text()();
  TextColumn get city => text().nullable()();
  TextColumn get zone => text().nullable()();
  TextColumn get coordinates => text().nullable()(); // JSON
  RealColumn get currentDebt => real()();
  RealColumn get creditLimit => real()();
  BoolColumn get creditLimitEnabled => boolean().withDefault(const Constant(true))();
  TextColumn get deliveryNotes => text().nullable()();
  TextColumn get customPrices => text().nullable()(); // JSON
  DateTimeColumn get syncedAt => dateTime().nullable()();
  
  @override
  Set<Column> get primaryKey => {id};
  
  @override
  String get tableName => 'local_customers';
}

// Table des produits (cache offline)
class LocalProducts extends Table {
  TextColumn get id => text()();
  TextColumn get organizationId => text()();
  TextColumn get name => text()();
  TextColumn get description => text().nullable()();
  RealColumn get price => real()();
  TextColumn get unit => text()();
  TextColumn get categoryId => text().nullable()();
  TextColumn get imageUrl => text().nullable()();
  BoolColumn get isAvailable => boolean().withDefault(const Constant(true))();
  DateTimeColumn get syncedAt => dateTime().nullable()();
  
  @override
  Set<Column> get primaryKey => {id};
  
  @override
  String get tableName => 'local_products';
}

// Table des transactions en attente (file d'attente offline)
class PendingTransactions extends Table {
  TextColumn get id => text()();
  TextColumn get type => text()(); // 'delivery_complete', 'delivery_fail', 'payment', 'debt_collection'
  TextColumn get entityId => text()(); // ID de l'entité concernée
  TextColumn get data => text()(); // JSON des données
  DateTimeColumn get createdAt => dateTime()();
  IntColumn get retryCount => integer().withDefault(const Constant(0))();
  TextColumn get errorMessage => text().nullable()();
  DateTimeColumn get lastAttempt => dateTime().nullable()();
  
  @override
  Set<Column> get primaryKey => {id};
  
  @override
  String get tableName => 'pending_transactions';
}

// Table de la caisse journalière
class LocalDailyCash extends Table {
  TextColumn get id => text()();
  TextColumn get organizationId => text()();
  TextColumn get delivererId => text()();
  DateTimeColumn get date => dateTime()();
  RealColumn get expectedCollection => real().withDefault(const Constant(0))();
  RealColumn get actualCollection => real().withDefault(const Constant(0))();
  RealColumn get newDebtCreated => real().withDefault(const Constant(0))();
  IntColumn get deliveriesTotal => integer().withDefault(const Constant(0))();
  IntColumn get deliveriesCompleted => integer().withDefault(const Constant(0))();
  IntColumn get deliveriesFailed => integer().withDefault(const Constant(0))();
  BoolColumn get isClosed => boolean().withDefault(const Constant(false))();
  DateTimeColumn get closedAt => dateTime().nullable()();
  RealColumn get cashHandedOver => real().nullable()();
  RealColumn get discrepancy => real().nullable()();
  TextColumn get discrepancyNotes => text().nullable()();
  BoolColumn get isSynced => boolean().withDefault(const Constant(false))();
  
  @override
  Set<Column> get primaryKey => {id};
  
  @override
  String get tableName => 'local_daily_cash';
}

// Table des paiements enregistrés localement
class LocalPayments extends Table {
  TextColumn get id => text()();
  TextColumn get organizationId => text()();
  TextColumn get customerId => text()();
  TextColumn get orderId => text().nullable()();
  TextColumn get deliveryId => text().nullable()();
  RealColumn get amount => real()();
  TextColumn get mode => text()();
  TextColumn get paymentType => text()();
  TextColumn get receiptNumber => text().nullable()();
  DateTimeColumn get collectedAt => dateTime()();
  TextColumn get notes => text().nullable()();
  BoolColumn get isSynced => boolean().withDefault(const Constant(false))();
  DateTimeColumn get syncedAt => dateTime().nullable()();
  
  @override
  Set<Column> get primaryKey => {id};
  
  @override
  String get tableName => 'local_payments';
}

// Table des paramètres de synchronisation
class SyncMetadata extends Table {
  TextColumn get key => text()();
  TextColumn get value => text()();
  DateTimeColumn get updatedAt => dateTime()();
  
  @override
  Set<Column> get primaryKey => {key};
  
  @override
  String get tableName => 'sync_metadata';
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE
// ═══════════════════════════════════════════════════════════════════════════════

@DriftDatabase(tables: [
  LocalDeliveries,
  LocalCustomers,
  LocalProducts,
  PendingTransactions,
  LocalDailyCash,
  LocalPayments,
  SyncMetadata,
])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());
  
  @override
  int get schemaVersion => 1;
  
  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (Migrator m) async {
      await m.createAll();
    },
    onUpgrade: (Migrator m, int from, int to) async {
      // Gérer les migrations futures ici
    },
  );
  
  // ═══════════════════════════════════════════════════════════════════════════
  // LIVRAISONS
  // ═══════════════════════════════════════════════════════════════════════════
  
  Future<List<LocalDelivery>> getDeliveriesForDate(DateTime date) {
    final startOfDay = DateTime(date.year, date.month, date.day);
    final endOfDay = startOfDay.add(const Duration(days: 1));
    
    return (select(localDeliveries)
      ..where((d) => d.scheduledDate.isBetweenValues(startOfDay, endOfDay))
      ..orderBy([(d) => OrderingTerm(expression: d.sequenceNumber)]))
      .get();
  }
  
  Future<LocalDelivery?> getDelivery(String id) {
    return (select(localDeliveries)
      ..where((d) => d.id.equals(id)))
      .getSingleOrNull();
  }
  
  Future<int> insertDelivery(LocalDeliveriesCompanion delivery) {
    return into(localDeliveries).insert(delivery, mode: InsertMode.replace);
  }
  
  Future<bool> updateDelivery(String id, LocalDeliveriesCompanion delivery) {
    return update(localDeliveries).replace(delivery.copyWith(id: Value(id)));
  }
  
  Future<List<LocalDelivery>> getAllDeliveries() {
    return select(localDeliveries).get();
  }
  
  Future<int> updateDeliverySequence(String id, int sequenceNumber) {
    return (update(localDeliveries)
      ..where((d) => d.id.equals(id)))
      .write(LocalDeliveriesCompanion(
        sequenceNumber: Value(sequenceNumber),
        updatedAt: Value(DateTime.now()),
      ));
  }
  
  Future<int> markDeliverySynced(String id) {
    return (update(localDeliveries)
      ..where((d) => d.id.equals(id)))
      .write(LocalDeliveriesCompanion(
        isSynced: const Value(true),
        syncedAt: Value(DateTime.now()),
      ));
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CLIENTS
  // ═══════════════════════════════════════════════════════════════════════════
  
  Future<List<LocalCustomer>> getAllCustomers() {
    return select(localCustomers).get();
  }
  
  Future<LocalCustomer?> getCustomer(String id) {
    return (select(localCustomers)
      ..where((c) => c.id.equals(id)))
      .getSingleOrNull();
  }
  
  Future<int> insertCustomer(LocalCustomersCompanion customer) {
    return into(localCustomers).insert(customer, mode: InsertMode.replace);
  }
  
  Future<void> insertCustomers(List<LocalCustomersCompanion> customers) async {
    await batch((batch) {
      batch.insertAll(localCustomers, customers, mode: InsertMode.replace);
    });
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUITS
  // ═══════════════════════════════════════════════════════════════════════════
  
  Future<List<LocalProduct>> getAllProducts() {
    return (select(localProducts)
      ..where((p) => p.isAvailable.equals(true)))
      .get();
  }
  
  Future<void> insertProducts(List<LocalProductsCompanion> products) async {
    await batch((batch) {
      batch.insertAll(localProducts, products, mode: InsertMode.replace);
    });
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSACTIONS EN ATTENTE
  // ═══════════════════════════════════════════════════════════════════════════
  
  Future<List<PendingTransaction>> getPendingTransactions() {
    return (select(pendingTransactions)
      ..orderBy([(t) => OrderingTerm(expression: t.createdAt)]))
      .get();
  }
  
  Future<int> getPendingTransactionCount() async {
    final count = await pendingTransactions.count().getSingle();
    return count;
  }
  
  Future<String> insertPendingTransaction(PendingTransactionsCompanion transaction) {
    return into(pendingTransactions).insert(transaction);
  }
  
  Future<int> deletePendingTransaction(String id) {
    return (delete(pendingTransactions)
      ..where((t) => t.id.equals(id)))
      .go();
  }
  
  Future<int> incrementRetryCount(String id, String? errorMessage) {
    return (update(pendingTransactions)
      ..where((t) => t.id.equals(id)))
      .write(PendingTransactionsCompanion(
        retryCount: const Value(1), // Sera incrémenté par la requête SQL
        errorMessage: Value(errorMessage),
        lastAttempt: Value(DateTime.now()),
      ));
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CAISSE JOURNALIÈRE
  // ═══════════════════════════════════════════════════════════════════════════
  
  Future<LocalDailyCash?> getDailyCash(String delivererId, DateTime date) {
    final startOfDay = DateTime(date.year, date.month, date.day);
    
    return (select(localDailyCash)
      ..where((c) => c.delivererId.equals(delivererId) & c.date.equals(startOfDay)))
      .getSingleOrNull();
  }
  
  Future<int> upsertDailyCash(LocalDailyCashCompanion cash) {
    return into(localDailyCash).insert(cash, mode: InsertMode.replace);
  }
  
  Future<int> closeDailyCash(String id, double cashHandedOver, String? notes) {
    return (update(localDailyCash)
      ..where((c) => c.id.equals(id)))
      .write(LocalDailyCashCompanion(
        isClosed: const Value(true),
        closedAt: Value(DateTime.now()),
        cashHandedOver: Value(cashHandedOver),
        discrepancyNotes: Value(notes),
      ));
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // MÉTADONNÉES DE SYNC
  // ═══════════════════════════════════════════════════════════════════════════
  
  Future<String?> getSyncMetadata(String key) async {
    final result = await (select(syncMetadata)
      ..where((m) => m.key.equals(key)))
      .getSingleOrNull();
    return result?.value;
  }
  
  Future<void> setSyncMetadata(String key, String value) async {
    await into(syncMetadata).insert(
      SyncMetadataCompanion(
        key: Value(key),
        value: Value(value),
        updatedAt: Value(DateTime.now()),
      ),
      mode: InsertMode.replace,
    );
  }
  
  Future<DateTime?> getLastSyncAt() async {
    final value = await getSyncMetadata('last_sync_at');
    if (value != null) {
      return DateTime.tryParse(value);
    }
    return null;
  }
  
  Future<void> setLastSyncAt(DateTime date) async {
    await setSyncMetadata('last_sync_at', date.toIso8601String());
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // NETTOYAGE
  // ═══════════════════════════════════════════════════════════════════════════
  
  Future<void> clearOldData(int daysToKeep) async {
    final cutoff = DateTime.now().subtract(Duration(days: daysToKeep));
    
    // Supprimer les livraisons anciennes synchronisées
    await (delete(localDeliveries)
      ..where((d) => d.scheduledDate.isSmallerThanValue(cutoff) & d.isSynced.equals(true)))
      .go();
    
    // Supprimer les transactions traitées
    await (delete(pendingTransactions)
      ..where((t) => t.createdAt.isSmallerThanValue(cutoff)))
      .go();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONNEXION
// ═══════════════════════════════════════════════════════════════════════════════

LazyDatabase _openConnection() {
  return LazyDatabase(() async {
    final dbFolder = await getApplicationDocumentsDirectory();
    final file = File(p.join(dbFolder.path, 'awid_livreur.db'));
    return NativeDatabase.createInBackground(file);
  });
}
