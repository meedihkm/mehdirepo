// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - SERVICE AUTHENTIFICATION CLIENT
// OTP et gestion de session
// ═══════════════════════════════════════════════════════════════════════════════

import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/models.dart';

class AuthService extends ChangeNotifier {
  static const String _tokenKey = 'access_token';
  static const String _refreshTokenKey = 'refresh_token';
  static const String _userKey = 'user_data';

  final FlutterSecureStorage _secureStorage;
  final SharedPreferences _prefs;

  CustomerUser? _currentUser;
  String? _accessToken;
  bool _isAuthenticated = false;

  AuthService(this._secureStorage, this._prefs) {
    _loadSession();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GETTERS
  // ───────────────────────────────────────────────────────────────────────────

  CustomerUser? get currentUser => _currentUser;
  bool get isAuthenticated => _isAuthenticated;
  String? get accessToken => _accessToken;

  // ───────────────────────────────────────────────────────────────────────────
  // SESSION
  // ───────────────────────────────────────────────────────────────────────────

  Future<void> _loadSession() async {
    _accessToken = await _secureStorage.read(key: _tokenKey);
    final userJson = await _secureStorage.read(key: _userKey);

    if (_accessToken != null && userJson != null) {
      try {
        _currentUser = CustomerUser.fromJson(jsonDecode(userJson));
        _isAuthenticated = true;
        notifyListeners();
      } catch (e) {
        // Session invalide, nettoyer
        await logout();
      }
    }
  }

  Future<void> saveSession(AuthResponse response) async {
    _accessToken = response.accessToken;
    _currentUser = response.user;
    _isAuthenticated = true;

    await _secureStorage.write(key: _tokenKey, value: response.accessToken);
    if (response.refreshToken != null) {
      await _secureStorage.write(key: _refreshTokenKey, value: response.refreshToken);
    }
    await _secureStorage.write(key: _userKey, value: jsonEncode(response.user.toJson()));

    notifyListeners();
  }

  Future<void> logout() async {
    _accessToken = null;
    _currentUser = null;
    _isAuthenticated = false;

    await _secureStorage.delete(key: _tokenKey);
    await _secureStorage.delete(key: _refreshTokenKey);
    await _secureStorage.delete(key: _userKey);

    notifyListeners();
  }

  Future<String?> getAccessToken() async {
    if (_accessToken != null) return _accessToken;
    _accessToken = await _secureStorage.read(key: _tokenKey);
    return _accessToken;
  }

  Future<String?> getRefreshToken() async {
    return await _secureStorage.read(key: _refreshTokenKey);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // REFRESH TOKEN
  // ───────────────────────────────────────────────────────────────────────────

  Future<bool> refreshToken() async {
    final refreshToken = await getRefreshToken();
    if (refreshToken == null) return false;

    try {
      // Cette méthode sera appelée par ApiService
      // Le refresh est géré dans l'intercepteur
      return true;
    } catch (e) {
      return false;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MISE À JOUR UTILISATEUR
  // ───────────────────────────────────────────────────────────────────────────

  Future<void> updateUser(CustomerUser user) async {
    _currentUser = user;
    await _secureStorage.write(key: _userKey, value: jsonEncode(user.toJson()));
    notifyListeners();
  }

  Future<void> updateDebt(double newDebt) async {
    if (_currentUser != null) {
      _currentUser = _currentUser!.copyWith(currentDebt: newDebt);
      await _secureStorage.write(key: _userKey, value: jsonEncode(_currentUser!.toJson()));
      notifyListeners();
    }
  }
}
