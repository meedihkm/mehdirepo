// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - INDICATEUR DE SYNCHRONISATION
// Affiche l'état de connexion et synchronisation
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/sync_provider.dart';
import '../services/connectivity_manager.dart';

class SyncIndicator extends ConsumerWidget {
  final bool? isOnline;
  final int? pendingCount;
  
  const SyncIndicator({Key? key, this.isOnline, this.pendingCount}) : super(key: key);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isOnlineAsync = ref.watch(isOnlineProvider);
    final syncState = ref.watch(syncNotifierProvider);
    
    // Afficher l'état de synchronisation en priorité
    if (syncState.status == SyncStatus.syncing) {
      return IconButton(
        icon: const SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
        tooltip: 'Synchronisation...',
        onPressed: () {},
      );
    }
    
    // Utiliser les valeurs passées en paramètre ou les providers
    if (isOnline != null) {
      // Mode avec paramètres
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (pendingCount != null && pendingCount! > 0)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              margin: const EdgeInsets.only(right: 4),
              decoration: BoxDecoration(
                color: Colors.orange,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '$pendingCount',
                style: const TextStyle(color: Colors.white, fontSize: 12),
              ),
            ),
          Icon(
            isOnline! ? Icons.cloud_done : Icons.cloud_off,
            color: isOnline! ? null : Colors.orange,
          ),
        ],
      );
    }
    
    // Afficher le statut de connexion via provider
    return isOnlineAsync.when(
      data: (online) {
        if (online) {
          return IconButton(
            icon: const Icon(Icons.cloud_done),
            tooltip: 'En ligne',
            onPressed: () {},
          );
        } else {
          return IconButton(
            icon: const Icon(Icons.cloud_off, color: Colors.orange),
            tooltip: 'Hors ligne',
            onPressed: () {},
          );
        }
      },
      loading: () => IconButton(
        icon: const Icon(Icons.cloud_queue),
        tooltip: 'Vérification...',
        onPressed: () {},
      ),
      error: (_, __) => IconButton(
        icon: const Icon(Icons.cloud_off, color: Colors.red),
        tooltip: 'Erreur de connexion',
        onPressed: () {},
      ),
    );
  }
}
