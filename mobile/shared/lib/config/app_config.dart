// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - CONFIGURATION APP
// Variables d'environnement et configuration
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/foundation.dart';

class AppConfig {
  // ═══════════════════════════════════════════════════════════════════════════════
  // ENVIRONNEMENT
  // ═══════════════════════════════════════════════════════════════════════════════

  static const String environment = String.fromEnvironment(
    'ENVIRONMENT',
    defaultValue: 'development',
  );

  static bool get isProduction => environment == 'production';
  static bool get isDevelopment => environment == 'development';
  static bool get isStaging => environment == 'staging';
  static bool get isDebug => kDebugMode;

  // ═══════════════════════════════════════════════════════════════════════════════
  // API
  // ═══════════════════════════════════════════════════════════════════════════════

  static String get apiBaseUrl {
    switch (environment) {
      case 'production':
        return 'https://api.awid.dz/v1';
      case 'staging':
        return 'https://staging-api.awid.dz/v1';
      default:
        // Développement local
        return const String.fromEnvironment(
          'API_URL',
          defaultValue: 'http://10.0.2.2:3000/api', // Android emulator
        );
    }
  }

  static String get websocketUrl {
    switch (environment) {
      case 'production':
        return 'wss://api.awid.dz';
      case 'staging':
        return 'wss://staging-api.awid.dz';
      default:
        return 'ws://10.0.2.2:3000';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // TIMEOUTS
  // ═══════════════════════════════════════════════════════════════════════════════

  static const Duration connectionTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 30);
  static const Duration sendTimeout = Duration(seconds: 30);

  // ═══════════════════════════════════════════════════════════════════════════════
  // CACHE
  // ═══════════════════════════════════════════════════════════════════════════════

  static const Duration cacheMaxAge = Duration(days: 7);
  static const int maxCacheSize = 100 * 1024 * 1024; // 100 MB

  // ═══════════════════════════════════════════════════════════════════════════════
  // SYNC
  // ═══════════════════════════════════════════════════════════════════════════════

  static const Duration syncInterval = Duration(minutes: 5);
  static const Duration positionUpdateInterval = Duration(seconds: 30);
  static const int maxOfflineTransactions = 1000;
  static const double maxOfflineAmount = 500000; // 500,000 DA

  // ═══════════════════════════════════════════════════════════════════════════════
  // PAGINATION
  // ═══════════════════════════════════════════════════════════════════════════════

  static const int defaultPageSize = 20;
  static const int maxPageSize = 100;

  // ═══════════════════════════════════════════════════════════════════════════════
  // IMPRESSION
  // ═══════════════════════════════════════════════════════════════════════════════

  static const int printerTimeout = 10; // secondes
  static const int receiptWidth = 48; // caractères pour imprimante 58mm
  static const int receiptWidthLarge = 64; // caractères pour imprimante 80mm

  // ═══════════════════════════════════════════════════════════════════════════════
  // LOCALISATION
  // ═══════════════════════════════════════════════════════════════════════════════

  static const String defaultLocale = 'fr_DZ';
  static const String currency = 'DZD';
  static const String currencySymbol = 'DA';

  // ═══════════════════════════════════════════════════════════════════════════════
  // MAPS
  // ═══════════════════════════════════════════════════════════════════════════════

  static const String googleMapsApiKey = String.fromEnvironment(
    'GOOGLE_MAPS_API_KEY',
    defaultValue: '',
  );

  // Centre par défaut: Alger
  static const double defaultLatitude = 36.7538;
  static const double defaultLongitude = 3.0588;
  static const double defaultZoom = 12.0;

  // ═══════════════════════════════════════════════════════════════════════════════
  // FIREBASE
  // ═══════════════════════════════════════════════════════════════════════════════

  static const bool firebaseEnabled = bool.fromEnvironment(
    'FIREBASE_ENABLED',
    defaultValue: true,
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // FEATURE FLAGS
  // ═══════════════════════════════════════════════════════════════════════════════

  static const bool enableOfflineMode = true;
  static const bool enableSignatureCapture = true;
  static const bool enablePhotoProof = true;
  static const bool enableBluetoothPrinter = true;
  static const bool enableRouteOptimization = true;
  static const bool enableDebtCollection = true;

  // ═══════════════════════════════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════════

  static const int minPasswordLength = 8;
  static const int otpLength = 6;
  static const Duration otpExpiry = Duration(minutes: 5);

  // Regex téléphone algérien
  static final RegExp phoneRegex = RegExp(r'^(0|\\+213)[5-7][0-9]{8}$');

  // ═══════════════════════════════════════════════════════════════════════════════
  // DEBUG
  // ═══════════════════════════════════════════════════════════════════════════════

  static bool get showDebugBanner => isDebug;
  static bool get enableNetworkLogs => isDebug;
  static bool get enableCrashlytics => isProduction;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTES MÉTIER
// ═══════════════════════════════════════════════════════════════════════════════

class BusinessConstants {
  // Modes de paiement
  static const List<String> paymentModes = ['cash', 'check', 'ccp', 'bank_transfer'];

  // Statuts de livraison
  static const List<String> deliveryStatuses = [
    'pending',
    'assigned',
    'in_transit',
    'delivered',
    'failed',
  ];

  // Statuts de commande
  static const List<String> orderStatuses = [
    'draft',
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'delivering',
    'delivered',
    'cancelled',
  ];

  // Raisons d'échec de livraison
  static const List<String> failureReasons = [
    'customer_absent',
    'address_not_found',
    'customer_refused',
    'wrong_products',
    'damaged_products',
    'payment_issue',
    'access_issue',
    'other',
  ];

  // Catégories de dépenses
  static const List<String> expenseCategories = [
    'fuel',
    'parking',
    'toll',
    'food',
    'maintenance',
    'other',
  ];

  // Tranches de crédit pour filtrage
  static const List<Map<String, dynamic>> debtRanges = [
    {'label': 'Tous', 'min': 0, 'max': null},
    {'label': '< 10K', 'min': 0, 'max': 10000},
    {'label': '10K - 50K', 'min': 10000, 'max': 50000},
    {'label': '50K - 100K', 'min': 50000, 'max': 100000},
    {'label': '> 100K', 'min': 100000, 'max': null},
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// THÈME
// ═══════════════════════════════════════════════════════════════════════════════

class AppColors {
  // Couleurs principales
  static const int primaryValue = 0xFF1E88E5;
  static const int secondaryValue = 0xFF26A69A;

  // Statuts
  static const int successValue = 0xFF4CAF50;
  static const int warningValue = 0xFFFF9800;
  static const int errorValue = 0xFFF44336;
  static const int infoValue = 0xFF2196F3;

  // Livraison
  static const int pendingValue = 0xFF9E9E9E;
  static const int assignedValue = 0xFF2196F3;
  static const int inTransitValue = 0xFFFF9800;
  static const int deliveredValue = 0xFF4CAF50;
  static const int failedValue = 0xFFF44336;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSETS
// ═══════════════════════════════════════════════════════════════════════════════

class AppAssets {
  // Images
  static const String logo = 'assets/images/logo.png';
  static const String logoWhite = 'assets/images/logo_white.png';
  static const String emptyBox = 'assets/images/empty_box.png';
  static const String noConnection = 'assets/images/no_connection.png';

  // Icons
  static const String iconDelivery = 'assets/icons/delivery.svg';
  static const String iconCash = 'assets/icons/cash.svg';
  static const String iconRoute = 'assets/icons/route.svg';
  static const String iconCustomer = 'assets/icons/customer.svg';

  // Animations (Lottie)
  static const String animLoading = 'assets/animations/loading.json';
  static const String animSuccess = 'assets/animations/success.json';
  static const String animError = 'assets/animations/error.json';
}
