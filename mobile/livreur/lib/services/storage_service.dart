// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - SERVICE DE STOCKAGE
// Stockage sécurisé local (SharedPreferences + FlutterSecureStorage)
// ═══════════════════════════════════════════════════════════════════════════════

import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class StorageService {
  static const _secureStorage = FlutterSecureStorage(
    aOptions: AndroidOptions(
      encryptedSharedPreferences: true,
    ),
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.first_unlock,
    ),
  );

  late final SharedPreferences _prefs;

  // Clés de stockage
  static const String _tokenKey = 'auth_token';
  static const String _refreshTokenKey = 'refresh_token';
  static const String _userDataKey = 'user_data';
  static const String _userRoleKey = 'user_role';
  static const String _organizationIdKey = 'organization_id';
  static const String _fcmTokenKey = 'fcm_token';
  static const String _lastSyncKey = 'last_sync';
  static const String _settingsKey = 'app_settings';

  // Initialisation
  Future<void> initialize() async {
    _prefs = await SharedPreferences.getInstance();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TOKENS (Stockage sécurisé)
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> setToken(String token) async {
    await _secureStorage.write(key: _tokenKey, value: token);
  }

  Future<String?> getToken() async {
    return await _secureStorage.read(key: _tokenKey);
  }

  Future<void> setRefreshToken(String token) async {
    await _secureStorage.write(key: _refreshTokenKey, value: token);
  }

  Future<String?> getRefreshToken() async {
    return await _secureStorage.read(key: _refreshTokenKey);
  }

  Future<void> deleteTokens() async {
    await _secureStorage.delete(key: _tokenKey);
    await _secureStorage.delete(key: _refreshTokenKey);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DONNÉES UTILISATEUR
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> setUserData(Map<String, dynamic> userData) async {
    await _secureStorage.write(
      key: _userDataKey,
      value: jsonEncode(userData),
    );
  }

  Future<Map<String, dynamic>?> getUserData() async {
    final data = await _secureStorage.read(key: _userDataKey);
    if (data == null) return null;
    try {
      return jsonDecode(data) as Map<String, dynamic>;
    } catch (e) {
      return null;
    }
  }

  Future<void> setUserRole(String role) async {
    await _secureStorage.write(key: _userRoleKey, value: role);
  }

  Future<String?> getUserRole() async {
    return await _secureStorage.read(key: _userRoleKey);
  }

  Future<void> setOrganizationId(String orgId) async {
    await _secureStorage.write(key: _organizationIdKey, value: orgId);
  }

  Future<String?> getOrganizationId() async {
    return await _secureStorage.read(key: _organizationIdKey);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FCM TOKEN
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> setFcmToken(String token) async {
    await _prefs.setString(_fcmTokenKey, token);
  }

  Future<String?> getFcmToken() async {
    return _prefs.getString(_fcmTokenKey);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYNCHRONISATION
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> setLastSync(DateTime date) async {
    await _prefs.setString(_lastSyncKey, date.toIso8601String());
  }

  Future<DateTime?> getLastSync() async {
    final str = _prefs.getString(_lastSyncKey);
    if (str == null) return null;
    return DateTime.tryParse(str);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PARAMÈTRES
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> setSettings(Map<String, dynamic> settings) async {
    await _prefs.setString(_settingsKey, jsonEncode(settings));
  }

  Future<Map<String, dynamic>> getSettings() async {
    final str = _prefs.getString(_settingsKey);
    if (str == null) return {};
    try {
      return jsonDecode(str) as Map<String, dynamic>;
    } catch (e) {
      return {};
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GÉNÉRIQUE
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> setString(String key, String value) async {
    await _prefs.setString(key, value);
  }

  String? getString(String key) {
    return _prefs.getString(key);
  }

  Future<void> setBool(String key, bool value) async {
    await _prefs.setBool(key, value);
  }

  bool? getBool(String key) {
    return _prefs.getBool(key);
  }

  Future<void> setInt(String key, int value) async {
    await _prefs.setInt(key, value);
  }

  int? getInt(String key) {
    return _prefs.getInt(key);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFACEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> clear() async {
    await _secureStorage.deleteAll();
    await _prefs.clear();
  }

  Future<void> clearSecure() async {
    await _secureStorage.deleteAll();
  }

  Future<void> clearPrefs() async {
    await _prefs.clear();
  }
}

// Singleton
final storageService = StorageService();
