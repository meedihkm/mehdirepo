// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - PROVIDERS DE CONNECTIVITÉ
// Ré-exportation des providers pour une importation plus propre
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/connectivity_manager.dart';

// Ré-export des providers depuis le service
export '../services/connectivity_manager.dart' show 
  connectivityManagerProvider,
  isOnlineProvider;

/// Provider qui expose l'état de connectivité comme StreamProvider
/// (alternative pour une utilisation plus simple)
final connectivityProvider = StreamProvider<bool>((ref) {
  final connectivityManager = ref.watch(connectivityManagerProvider);
  return connectivityManager.connectionStream;
});

/// Provider qui indique simplement si l'appareil est en ligne
/// Retourne true par défaut pendant le chargement
final isOnlineSimpleProvider = Provider<bool>((ref) {
  final connectivityAsync = ref.watch(connectivityProvider);
  return connectivityAsync.when(
    data: (isOnline) => isOnline,
    loading: () => true,
    error: (_, __) => false,
  );
});
