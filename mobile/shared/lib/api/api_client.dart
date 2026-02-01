// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - CLIENT API FLUTTER
// Configuration Dio avec intercepteurs (auth, retry, logging)
// ═══════════════════════════════════════════════════════════════════════════════

import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../config/app_config.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// STORAGE SÉCURISÉ
// ═══════════════════════════════════════════════════════════════════════════════

const _storage = FlutterSecureStorage(
  aOptions: AndroidOptions(encryptedSharedPreferences: true),
  iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
);

class TokenStorage {
  static const _accessTokenKey = 'access_token';
  static const _refreshTokenKey = 'refresh_token';

  static Future<String?> getAccessToken() async {
    return await _storage.read(key: _accessTokenKey);
  }

  static Future<String?> getRefreshToken() async {
    return await _storage.read(key: _refreshTokenKey);
  }

  static Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _storage.write(key: _accessTokenKey, value: accessToken);
    await _storage.write(key: _refreshTokenKey, value: refreshToken);
  }

  static Future<void> clearTokens() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
  }

  static Future<bool> hasTokens() async {
    final token = await getAccessToken();
    return token != null && token.isNotEmpty;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXCEPTIONS PERSONNALISÉES
// ═══════════════════════════════════════════════════════════════════════════════

class ApiException implements Exception {
  final String code;
  final String message;
  final int? statusCode;
  final dynamic details;

  ApiException({
    required this.code,
    required this.message,
    this.statusCode,
    this.details,
  });

  @override
  String toString() => 'ApiException: [$code] $message';

  factory ApiException.fromDioError(DioException error) {
    if (error.response?.data != null && error.response?.data is Map) {
      final errorData = error.response!.data['error'] ?? error.response!.data;
      return ApiException(
        code: errorData['code'] ?? 'UNKNOWN_ERROR',
        message: errorData['message'] ?? 'Une erreur est survenue',
        statusCode: error.response?.statusCode,
        details: errorData['details'],
      );
    }

    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return ApiException(
          code: 'TIMEOUT',
          message: 'La connexion a expiré. Vérifiez votre connexion internet.',
        );
      case DioExceptionType.connectionError:
        return ApiException(
          code: 'NO_CONNECTION',
          message: 'Impossible de se connecter au serveur.',
        );
      default:
        return ApiException(
          code: 'UNKNOWN_ERROR',
          message: error.message ?? 'Une erreur inattendue est survenue',
        );
    }
  }
}

class UnauthorizedException extends ApiException {
  UnauthorizedException()
      : super(
          code: 'UNAUTHORIZED',
          message: 'Session expirée. Veuillez vous reconnecter.',
          statusCode: 401,
        );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERCEPTEUR D'AUTHENTIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

class AuthInterceptor extends Interceptor {
  final Dio _dio;
  bool _isRefreshing = false;
  final List<Function> _refreshQueue = [];

  AuthInterceptor(this._dio);

  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // Ne pas ajouter le token pour les routes d'auth
    if (_isAuthRoute(options.path)) {
      return handler.next(options);
    }

    final token = await TokenStorage.getAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }

    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401 && !_isAuthRoute(err.requestOptions.path)) {
      // Tenter de rafraîchir le token
      if (!_isRefreshing) {
        _isRefreshing = true;

        try {
          final refreshed = await _refreshToken();
          _isRefreshing = false;

          if (refreshed) {
            // Réessayer la requête originale
            final response = await _retryRequest(err.requestOptions);
            return handler.resolve(response);
          }
        } catch (e) {
          _isRefreshing = false;
          // Échec du refresh, déconnecter
          await TokenStorage.clearTokens();
        }
      } else {
        // Attendre que le refresh soit terminé
        final completer = Completer<Response>();
        _refreshQueue.add(() async {
          try {
            final response = await _retryRequest(err.requestOptions);
            completer.complete(response);
          } catch (e) {
            completer.completeError(e);
          }
        });
        return handler.resolve(await completer.future);
      }
    }

    handler.next(err);
  }

  bool _isAuthRoute(String path) {
    return path.contains('/auth/login') ||
        path.contains('/auth/refresh') ||
        path.contains('/auth/customer/request-otp') ||
        path.contains('/auth/customer/verify-otp');
  }

  Future<bool> _refreshToken() async {
    try {
      final refreshToken = await TokenStorage.getRefreshToken();
      if (refreshToken == null) return false;

      final response = await _dio.post(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
        options: Options(headers: {'Authorization': ''}), // Pas de token
      );

      if (response.statusCode == 200 && response.data['success']) {
        final tokens = response.data['data'];
        await TokenStorage.saveTokens(
          accessToken: tokens['accessToken'],
          refreshToken: tokens['refreshToken'],
        );

        // Exécuter les requêtes en attente
        for (final callback in _refreshQueue) {
          callback();
        }
        _refreshQueue.clear();

        return true;
      }
    } catch (e) {
      // Échec du refresh
    }

    return false;
  }

  Future<Response> _retryRequest(RequestOptions options) async {
    final token = await TokenStorage.getAccessToken();
    options.headers['Authorization'] = 'Bearer $token';
    return _dio.fetch(options);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERCEPTEUR DE LOGGING
// ═══════════════════════════════════════════════════════════════════════════════

class LoggingInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    print('🌐 ${options.method} ${options.path}');
    if (options.data != null) {
      print('📤 Body: ${options.data}');
    }
    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    print('✅ ${response.statusCode} ${response.requestOptions.path}');
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    print('❌ ${err.response?.statusCode} ${err.requestOptions.path}');
    print('   ${err.message}');
    handler.next(err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERCEPTEUR DE RETRY
// ═══════════════════════════════════════════════════════════════════════════════

class RetryInterceptor extends Interceptor {
  final Dio _dio;
  final int maxRetries;
  final Duration retryDelay;

  RetryInterceptor(
    this._dio, {
    this.maxRetries = 3,
    this.retryDelay = const Duration(seconds: 1),
  });

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    final shouldRetry = _shouldRetry(err);
    final retryCount = err.requestOptions.extra['retryCount'] ?? 0;

    if (shouldRetry && retryCount < maxRetries) {
      await Future.delayed(retryDelay * (retryCount + 1));

      try {
        err.requestOptions.extra['retryCount'] = retryCount + 1;
        final response = await _dio.fetch(err.requestOptions);
        return handler.resolve(response);
      } catch (e) {
        return handler.next(err);
      }
    }

    handler.next(err);
  }

  bool _shouldRetry(DioException err) {
    return err.type == DioExceptionType.connectionTimeout ||
        err.type == DioExceptionType.receiveTimeout ||
        (err.response?.statusCode != null && err.response!.statusCode! >= 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT API
// ═══════════════════════════════════════════════════════════════════════════════

class ApiClient {
  late final Dio _dio;

  ApiClient() {
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
        sendTimeout: const Duration(seconds: 30),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    // Ajouter les intercepteurs
    _dio.interceptors.addAll([
      AuthInterceptor(_dio),
      RetryInterceptor(_dio),
      if (AppConfig.isDebug) LoggingInterceptor(),
    ]);
  }

  // GET
  Future<T> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    T Function(dynamic)? fromJson,
  }) async {
    try {
      final response = await _dio.get(path, queryParameters: queryParameters);
      return _handleResponse(response, fromJson);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  // POST
  Future<T> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    T Function(dynamic)? fromJson,
  }) async {
    try {
      final response = await _dio.post(
        path,
        data: data,
        queryParameters: queryParameters,
      );
      return _handleResponse(response, fromJson);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  // PUT
  Future<T> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    T Function(dynamic)? fromJson,
  }) async {
    try {
      final response = await _dio.put(
        path,
        data: data,
        queryParameters: queryParameters,
      );
      return _handleResponse(response, fromJson);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  // DELETE
  Future<T> delete<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    T Function(dynamic)? fromJson,
  }) async {
    try {
      final response = await _dio.delete(path, queryParameters: queryParameters);
      return _handleResponse(response, fromJson);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  // Upload file
  Future<T> uploadFile<T>(
    String path,
    File file, {
    String fieldName = 'file',
    Map<String, dynamic>? additionalData,
    T Function(dynamic)? fromJson,
    void Function(int, int)? onProgress,
  }) async {
    try {
      final formData = FormData.fromMap({
        fieldName: await MultipartFile.fromFile(
          file.path,
          filename: file.path.split('/').last,
        ),
        if (additionalData != null) ...additionalData,
      });

      final response = await _dio.post(
        path,
        data: formData,
        onSendProgress: onProgress,
      );
      return _handleResponse(response, fromJson);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  T _handleResponse<T>(Response response, T Function(dynamic)? fromJson) {
    if (response.data['success'] != true) {
      throw ApiException(
        code: response.data['error']?['code'] ?? 'ERROR',
        message: response.data['error']?['message'] ?? 'Une erreur est survenue',
        statusCode: response.statusCode,
        details: response.data['error']?['details'],
      );
    }

    final data = response.data['data'];
    if (fromJson != null) {
      return fromJson(data);
    }
    return data as T;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER RIVERPOD
// ═══════════════════════════════════════════════════════════════════════════════

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient();
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export 'api_client.dart';
