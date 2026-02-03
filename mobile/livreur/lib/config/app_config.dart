// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - CONFIGURATION APP LIVREUR
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/foundation.dart';

class AppConfig {
  // ═══════════════════════════════════════════════════════════════════════════
  // API
  // ═══════════════════════════════════════════════════════════════════════════

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: kReleaseMode 
      ? 'https://api.awid.dz/v1'  // Production
      : 'http://62.171.130.92:3500/api/v1', // VPS Production
  );

  static const String wsBaseUrl = String.fromEnvironment(
    'WS_BASE_URL',
    defaultValue: kReleaseMode
      ? 'wss://api.awid.dz/ws'
      : 'ws://62.171.130.92:3500/ws',
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // APP
  // ═══════════════════════════════════════════════════════════════════════════

  static const String appName = 'AWID Livreur';
  static const String appVersion = '1.0.0';
  static const String buildNumber = '1';

  // ═══════════════════════════════════════════════════════════════════════════
  // TIMEOUTS
  // ═══════════════════════════════════════════════════════════════════════════

  static const Duration connectTimeout = Duration(seconds: 10);
  static const Duration receiveTimeout = Duration(seconds: 30);
  static const Duration sendTimeout = Duration(seconds: 10);

  // ═══════════════════════════════════════════════════════════════════════════
  // FONCTIONNALITÉS
  // ═══════════════════════════════════════════════════════════════════════════

  static const bool enablePushNotifications = true;
  static const bool enableOfflineMode = true;
  static const bool enableLocationTracking = true;
  static const bool enableBluetoothPrinting = true;

  // ═══════════════════════════════════════════════════════════════════════════
  // SYNCHRONISATION
  // ═══════════════════════════════════════════════════════════════════════════

  static const Duration syncInterval = Duration(minutes: 5);
  static const int maxSyncRetries = 3;
  static const Duration syncRetryDelay = Duration(seconds: 30);

  // ═══════════════════════════════════════════════════════════════════════════
  // LOCATION
  // ═══════════════════════════════════════════════════════════════════════════

  static const Duration locationUpdateInterval = Duration(seconds: 30);
  static const double locationMinDistance = 10; // mètres

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGINATION
  // ═══════════════════════════════════════════════════════════════════════════

  static const int defaultPageSize = 20;
  static const int maxPageSize = 100;

  // ═══════════════════════════════════════════════════════════════════════════
  // IMPRESSION
  // ═══════════════════════════════════════════════════════════════════════════

  static const int printerDefaultWidth = 58; // mm (58 ou 80)
  static const Duration printerTimeout = Duration(seconds: 10);

  // ═══════════════════════════════════════════════════════════════════════════
  // CACHE
  // ═══════════════════════════════════════════════════════════════════════════

  static const Duration cacheValidity = Duration(hours: 24);
  static const int maxCacheSize = 50 * 1024 * 1024; // 50 MB
}

// ═══════════════════════════════════════════════════════════════════════════
// CLÉS DE STOCKAGE
// ═══════════════════════════════════════════════════════════════════════════

class StorageKeys {
  static const String token = 'auth_token';
  static const String refreshToken = 'refresh_token';
  static const String userData = 'user_data';
  static const String userRole = 'user_role';
  static const String organizationId = 'organization_id';
  static const String fcmToken = 'fcm_token';
  static const String lastSync = 'last_sync';
  static const String pendingTransactions = 'pending_transactions';
  static const String settings = 'app_settings';
  static const String dailyCash = 'daily_cash';
}

// ═══════════════════════════════════════════════════════════════════════════
// ÉVÉNEMENTS
// ═══════════════════════════════════════════════════════════════════════════

class AppEvents {
  static const String syncCompleted = 'sync_completed';
  static const String syncFailed = 'sync_failed';
  static const String connectivityChanged = 'connectivity_changed';
  static const String locationUpdated = 'location_updated';
  static const String deliveryCompleted = 'delivery_completed';
  static const String newNotification = 'new_notification';
}
