// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - GESTIONNAIRE DE CONNECTIVITÉ
// Surveillance de la connexion réseau
// ═══════════════════════════════════════════════════════════════════════════════

import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════

final connectivityManagerProvider = Provider<ConnectivityManager>((ref) {
  return ConnectivityManager();
});

final isOnlineProvider = StreamProvider<bool>((ref) {
  final manager = ref.watch(connectivityManagerProvider);
  return manager.connectionStream;
});

// ═══════════════════════════════════════════════════════════════════════════════
// MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

class ConnectivityManager {
  final Connectivity _connectivity = Connectivity();
  final _connectionController = StreamController<bool>.broadcast();
  
  bool _isOnline = true;
  bool get isOnline => _isOnline;
  
  Stream<bool> get connectionStream => _connectionController.stream;
  
  ConnectivityManager() {
    _init();
  }
  
  void _init() async {
    // Vérifier l'état initial
    final result = await _connectivity.checkConnectivity();
    _updateConnectionStatus(result);
    
    // Écouter les changements
    _connectivity.onConnectivityChanged.listen(_updateConnectionStatus);
  }
  
  void _updateConnectionStatus(ConnectivityResult result) {
    final wasOnline = _isOnline;
    
    switch (result) {
      case ConnectivityResult.wifi:
      case ConnectivityResult.mobile:
      case ConnectivityResult.ethernet:
        _isOnline = true;
        break;
      case ConnectivityResult.none:
      case ConnectivityResult.bluetooth:
      case ConnectivityResult.vpn:
      case ConnectivityResult.other:
        _isOnline = false;
        break;
    }
    
    if (wasOnline != _isOnline) {
      _connectionController.add(_isOnline);
    }
  }
  
  void dispose() {
    _connectionController.close();
  }
}
