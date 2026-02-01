// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - CUSTOMER PROVIDER
// Gestion du profil client
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/models.dart';
import 'providers.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════

/// Provider pour le client actuellement connecté
final currentCustomerProvider = FutureProvider<CustomerUser>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.getProfile();

  if (response.success && response.data != null) {
    // Mettre à jour le cache local
    await ref.read(authServiceProvider).updateUser(response.data!);
    return response.data!;
  }

  throw Exception(response.errorMessage ?? 'Erreur de chargement du profil');
});

/// Provider pour le relevé de compte
final statementProvider = FutureProvider.family<Statement, DateTimeRange>((ref, range) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.getStatement(
    startDate: range.start,
    endDate: range.end,
  );

  if (response.success && response.data != null) {
    return response.data!;
  }

  throw Exception(response.errorMessage ?? 'Erreur de chargement');
});

/// Provider pour l'historique des transactions
final transactionsProvider = FutureProvider.family<List<Transaction>, DateTimeRange>((ref, range) async {
  final statement = await ref.watch(statementProvider(range).future);
  return statement.transactions;
});
