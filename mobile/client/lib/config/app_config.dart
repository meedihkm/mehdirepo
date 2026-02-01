// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - CONFIGURATION APP CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

class AppConfig {
  // ───────────────────────────────────────────────────────────────────────────
  // API
  // ───────────────────────────────────────────────────────────────────────────

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.awid.dz/v1',
  );

  static const String wsBaseUrl = String.fromEnvironment(
    'WS_BASE_URL',
    defaultValue: 'wss://api.awid.dz/ws',
  );

  // ───────────────────────────────────────────────────────────────────────────
  // APP
  // ───────────────────────────────────────────────────────────────────────────

  static const String appName = 'AWID Client';
  static const String appVersion = '1.0.0';
  static const String buildNumber = '1';

  // ───────────────────────────────────────────────────────────────────────────
  // FONCTIONNALITÉS
  // ───────────────────────────────────────────────────────────────────────────

  static const bool enablePushNotifications = true;
  static const bool enableOfflineMode = true;
  static const int maxCartItems = 100;
  static const int otpLength = 6;
  static const int otpExpirySeconds = 300; // 5 minutes

  // ───────────────────────────────────────────────────────────────────────────
  // CRÉNEAUX HORAIRES DE LIVRAISON
  // ───────────────────────────────────────────────────────────────────────────

  static const List<String> deliveryTimeSlots = [
    '08:00-10:00',
    '10:00-12:00',
    '12:00-14:00',
    '14:00-16:00',
    '16:00-18:00',
  ];

  // ───────────────────────────────────────────────────────────────────────────
  // PAGINATION
  // ───────────────────────────────────────────────────────────────────────────

  static const int defaultPageSize = 20;
  static const int maxPageSize = 100;
}
