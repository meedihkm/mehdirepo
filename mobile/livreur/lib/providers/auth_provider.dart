// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - PROVIDER AUTHENTIFICATION LIVREUR
// Gestion de l'état d'authentification avec Riverpod
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../config/app_config.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// MODÈLES
// ═══════════════════════════════════════════════════════════════════════════════

class AuthUser {
  final String id;
  final String email;
  final String name;
  final String role;
  final String organizationId;
  final String? organizationName;
  final String? avatarUrl;
  final String? phone;

  const AuthUser({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    required this.organizationId,
    this.organizationName,
    this.avatarUrl,
    this.phone,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id'] ?? '',
      email: json['email'] ?? '',
      name: json['name'] ?? '',
      role: json['role'] ?? '',
      organizationId: json['organizationId'] ?? json['organization_id'] ?? '',
      organizationName: json['organizationName'] ?? json['organization_name'],
      avatarUrl: json['avatarUrl'] ?? json['avatar_url'],
      phone: json['phone'],
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'email': email,
    'name': name,
    'role': role,
    'organizationId': organizationId,
    'organizationName': organizationName,
    'avatarUrl': avatarUrl,
    'phone': phone,
  };

  bool get isAdmin => role == 'admin';
  bool get isManager => role == 'manager';
  bool get isDeliverer => role == 'deliverer';
  bool get isKitchen => role == 'kitchen';
  bool get canManage => isAdmin || isManager;
}

class AuthState {
  final bool isAuthenticated;
  final AuthUser? user;
  final String? token;
  final bool isLoading;
  final String? error;

  const AuthState({
    this.isAuthenticated = false,
    this.user,
    this.token,
    this.isLoading = false,
    this.error,
  });

  AuthState copyWith({
    bool? isAuthenticated,
    AuthUser? user,
    String? token,
    bool? isLoading,
    String? error,
  }) {
    return AuthState(
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      user: user ?? this.user,
      token: token ?? this.token,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }

  factory AuthState.initial() => const AuthState();

  factory AuthState.authenticated(AuthUser user, String token) => AuthState(
    isAuthenticated: true,
    user: user,
    token: token,
  );

  factory AuthState.unauthenticated() => const AuthState();

  factory AuthState.loading() => const AuthState(isLoading: true);

  factory AuthState.error(String message) => AuthState(error: message);
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFIER
// ═══════════════════════════════════════════════════════════════════════════════

class AuthNotifier extends StateNotifier<AuthState> {
  final ApiService _apiService;
  final StorageService _storage;

  AuthNotifier(this._apiService, this._storage) : super(AuthState.initial()) {
    _checkAuthStatus();
  }

  /// Vérifier le statut d'authentification au démarrage
  Future<void> _checkAuthStatus() async {
    final token = await _storage.getToken();
    final userData = await _storage.getUserData();

    if (token != null && userData != null) {
      try {
        final user = AuthUser.fromJson(userData);
        state = AuthState.authenticated(user, token);
      } catch (e) {
        await logout();
      }
    }
  }

  /// Connexion avec email/mot de passe
  Future<bool> login(String email, String password) async {
    state = AuthState.loading();

    try {
      final response = await _apiService.login(email, password);

      if (response.success && response.data != null) {
        final data = response.data!;
        final token = data['accessToken'] ?? data['token'];
        final userData = data['user'] ?? data;

        if (token != null && userData != null) {
          final user = AuthUser.fromJson(userData);

          // Sauvegarder localement
          await _storage.setToken(token);
          await _storage.setUserData(userData);
          await _storage.setString('user_role', user.role);
          await _storage.setString('organization_id', user.organizationId);

          state = AuthState.authenticated(user, token);
          return true;
        }
      }

      state = AuthState.error(response.errorMessage ?? 'Échec de la connexion');
      return false;
    } catch (e) {
      state = AuthState.error('Erreur de connexion: $e');
      return false;
    }
  }

  /// Rafraîchir le token
  Future<bool> refreshToken() async {
    try {
      final response = await _apiService.refreshToken();

      if (response.success && response.data != null) {
        final newToken = response.data!['accessToken'] ?? response.data!['token'];
        if (newToken != null) {
          await _storage.setToken(newToken);
          state = state.copyWith(token: newToken);
          return true;
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  /// Mettre à jour le profil utilisateur
  Future<void> updateUser(AuthUser user) async {
    await _storage.setUserData(user.toJson());
    state = state.copyWith(user: user);
  }

  /// Mettre à jour le token FCM
  Future<void> updateFcmToken(String fcmToken) async {
    try {
      await _apiService.post('/notifications/register-token', data: {
        'token': fcmToken,
        'platform': defaultTargetPlatform.name.toLowerCase(),
      });
    } catch (e) {
      // Ignorer les erreurs FCM
    }
  }

  /// Déconnexion
  Future<void> logout() async {
    try {
      await _apiService.post('/auth/logout');
    } catch (e) {
      // Ignorer les erreurs
    }

    await _storage.clear();
    state = AuthState.unauthenticated();
  }

  /// Effacer l'erreur
  void clearError() {
    state = state.copyWith(error: null);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════

final authNotifierProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final apiService = ref.watch(apiServiceProvider);
  final storage = ref.watch(storageServiceProvider);
  return AuthNotifier(apiService, storage);
});

final authStateProvider = Provider<AuthState>((ref) {
  return ref.watch(authNotifierProvider);
});

final currentUserProvider = Provider<AuthUser?>((ref) {
  return ref.watch(authNotifierProvider).user;
});

final isAuthenticatedProvider = Provider<bool>((ref) {
  return ref.watch(authNotifierProvider).isAuthenticated;
});

final userRoleProvider = Provider<String?>((ref) {
  return ref.watch(authNotifierProvider).user?.role;
});

final organizationIdProvider = Provider<String?>((ref) {
  return ref.watch(authNotifierProvider).user?.organizationId;
});

// Storage Service Provider
final storageServiceProvider = Provider<StorageService>((ref) => StorageService());
