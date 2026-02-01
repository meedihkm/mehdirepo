// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - PROVIDER AUTHENTIFICATION
// Gestion de l'état d'authentification avec Riverpod
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

import '../api/api_client.dart';
import '../models/user.dart';

part 'auth_provider.freezed.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// ÉTAT D'AUTHENTIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

@freezed
class AuthState with _$AuthState {
  const factory AuthState.initial() = _Initial;
  const factory AuthState.loading() = _Loading;
  const factory AuthState.authenticated(User user) = _Authenticated;
  const factory AuthState.unauthenticated() = _Unauthenticated;
  const factory AuthState.error(String message) = _Error;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFIER D'AUTHENTIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

class AuthNotifier extends StateNotifier<AuthState> {
  final ApiClient _api;

  AuthNotifier(this._api) : super(const AuthState.initial());

  /// Vérifier si l'utilisateur est déjà connecté
  Future<void> checkAuthStatus() async {
    state = const AuthState.loading();

    final hasToken = await TokenStorage.hasTokens();
    if (!hasToken) {
      state = const AuthState.unauthenticated();
      return;
    }

    try {
      final userData = await _api.get('/auth/me');
      final user = User.fromJson(userData);
      state = AuthState.authenticated(user);
    } catch (e) {
      await TokenStorage.clearTokens();
      state = const AuthState.unauthenticated();
    }
  }

  /// Connexion admin/manager/livreur
  Future<void> login({
    required String email,
    required String password,
    String? deviceId,
  }) async {
    state = const AuthState.loading();

    try {
      final response = await _api.post('/auth/login', data: {
        'email': email,
        'password': password,
        if (deviceId != null) 'deviceId': deviceId,
      });

      await TokenStorage.saveTokens(
        accessToken: response['tokens']['accessToken'],
        refreshToken: response['tokens']['refreshToken'],
      );

      final user = User.fromJson(response['user']);
      state = AuthState.authenticated(user);
    } on ApiException catch (e) {
      state = AuthState.error(e.message);
    } catch (e) {
      state = AuthState.error('Une erreur inattendue est survenue');
    }
  }

  /// Demande OTP (client)
  Future<String?> requestOtp(String phone) async {
    try {
      final response = await _api.post('/auth/customer/request-otp', data: {
        'phone': phone,
      });
      return response['message'];
    } on ApiException catch (e) {
      state = AuthState.error(e.message);
      return null;
    }
  }

  /// Vérification OTP (client)
  Future<void> verifyOtp({
    required String phone,
    required String otp,
    String? deviceId,
  }) async {
    state = const AuthState.loading();

    try {
      final response = await _api.post('/auth/customer/verify-otp', data: {
        'phone': phone,
        'otp': otp,
        if (deviceId != null) 'deviceId': deviceId,
      });

      await TokenStorage.saveTokens(
        accessToken: response['tokens']['accessToken'],
        refreshToken: response['tokens']['refreshToken'],
      );

      final user = User.fromJson(response['user']);
      state = AuthState.authenticated(user);
    } on ApiException catch (e) {
      state = AuthState.error(e.message);
    }
  }

  /// Déconnexion
  Future<void> logout() async {
    try {
      await _api.post('/auth/logout');
    } catch (e) {
      // Ignorer les erreurs de logout
    }

    await TokenStorage.clearTokens();
    state = const AuthState.unauthenticated();
  }

  /// Changement de mot de passe
  Future<bool> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    try {
      await _api.put('/auth/password', data: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      });
      return true;
    } on ApiException catch (e) {
      state = AuthState.error(e.message);
      return false;
    }
  }

  /// Réinitialiser l'erreur
  void clearError() {
    if (state is _Error) {
      state = const AuthState.unauthenticated();
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final api = ref.watch(apiClientProvider);
  return AuthNotifier(api);
});

/// Provider pour vérifier si l'utilisateur est connecté
final isAuthenticatedProvider = Provider<bool>((ref) {
  final authState = ref.watch(authProvider);
  return authState.maybeWhen(
    authenticated: (_) => true,
    orElse: () => false,
  );
});

/// Provider pour récupérer l'utilisateur connecté
final currentUserProvider = Provider<User?>((ref) {
  final authState = ref.watch(authProvider);
  return authState.maybeWhen(
    authenticated: (user) => user,
    orElse: () => null,
  );
});

/// Provider pour le rôle de l'utilisateur
final userRoleProvider = Provider<String?>((ref) {
  final user = ref.watch(currentUserProvider);
  return user?.role;
});

// ═══════════════════════════════════════════════════════════════════════════════
// MODÈLE USER (Placeholder - À mettre dans models/)
// ═══════════════════════════════════════════════════════════════════════════════

class User {
  final String id;
  final String email;
  final String name;
  final String role;
  final String organizationId;
  final String organizationName;

  User({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    required this.organizationId,
    required this.organizationName,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'],
      email: json['email'],
      name: json['name'],
      role: json['role'],
      organizationId: json['organizationId'],
      organizationName: json['organizationName'] ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'email': email,
    'name': name,
    'role': role,
    'organizationId': organizationId,
    'organizationName': organizationName,
  };

  bool get isAdmin => role == 'admin';
  bool get isManager => role == 'manager';
  bool get isDeliverer => role == 'deliverer';
  bool get isKitchen => role == 'kitchen';
  bool get isCustomer => role == 'customer';
}
