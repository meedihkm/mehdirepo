// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - SERVICE API APP CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../config/app_config.dart';
import '../models/models.dart';
import 'auth_service.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// RÉPONSE API
// ═══════════════════════════════════════════════════════════════════════════════

class ApiResponse<T> {
  final bool success;
  final T? data;
  final String? errorMessage;
  final int? statusCode;

  ApiResponse({
    required this.success,
    this.data,
    this.errorMessage,
    this.statusCode,
  });

  factory ApiResponse.success(T data) => ApiResponse(
        success: true,
        data: data,
      );

  factory ApiResponse.error(String message, {int? statusCode}) => ApiResponse(
        success: false,
        errorMessage: message,
        statusCode: statusCode,
      );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE API
// ═══════════════════════════════════════════════════════════════════════════════

class ApiService {
  late final Dio _dio;
  final AuthService _authService;

  ApiService(this._authService) {
    _dio = Dio(BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));

    _setupInterceptors();
  }

  void _setupInterceptors() {
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _authService.getAccessToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        
        if (kDebugMode) {
          print('📤 REQUEST: ${options.method} ${options.path}');
          print('Headers: ${options.headers}');
          print('Data: ${options.data}');
        }
        
        return handler.next(options);
      },
      onResponse: (response, handler) {
        if (kDebugMode) {
          print('📥 RESPONSE: ${response.statusCode} ${response.requestOptions.path}');
          print('Data: ${response.data}');
        }
        return handler.next(response);
      },
      onError: (error, handler) async {
        if (kDebugMode) {
          print('❌ ERROR: ${error.response?.statusCode} ${error.requestOptions.path}');
          print('Message: ${error.message}');
          print('Response: ${error.response?.data}');
        }

        // Gérer le token expiré (401)
        if (error.response?.statusCode == 401) {
          final refreshed = await _authService.refreshToken();
          if (refreshed) {
            // Réessayer la requête avec le nouveau token
            final token = await _authService.getAccessToken();
            error.requestOptions.headers['Authorization'] = 'Bearer $token';
            return handler.resolve(await _dio.fetch(error.requestOptions));
          } else {
            // Déconnexion si le refresh échoue
            await _authService.logout();
          }
        }

        return handler.next(error);
      },
    ));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTHENTIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  Future<ApiResponse<void>> requestOtp(String phone) async {
    try {
      final response = await _dio.post('/auth/customer/request-otp', data: {
        'phone': phone,
      });

      if (response.statusCode == 200) {
        return ApiResponse.success(null);
      }

      return ApiResponse.error(
        response.data['message'] ?? 'Erreur lors de l\'envoi du code',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return _handleDioError(e);
    } catch (e) {
      return ApiResponse.error('Erreur inattendue: $e');
    }
  }

  Future<ApiResponse<AuthResponse>> verifyOtp(
    String phone,
    String otp, {
    String? deviceId,
  }) async {
    try {
      final response = await _dio.post('/auth/customer/verify-otp', data: {
        'phone': phone,
        'otp': otp,
        'deviceId': deviceId,
      });

      if (response.statusCode == 200) {
        final authResponse = AuthResponse.fromJson(response.data['data']);
        return ApiResponse.success(authResponse);
      }

      return ApiResponse.error(
        response.data['message'] ?? 'Code invalide',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return _handleDioError(e);
    } catch (e) {
      return ApiResponse.error('Erreur inattendue: $e');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CATÉGORIES
  // ═══════════════════════════════════════════════════════════════════════════

  Future<ApiResponse<List<Category>>> getCategories() async {
    try {
      final response = await _dio.get('/categories');

      if (response.statusCode == 200) {
        final List<dynamic> data = response.data['data'] ?? [];
        final categories = data.map((e) => Category.fromJson(e)).toList();
        return ApiResponse.success(categories);
      }

      return ApiResponse.error(
        response.data['message'] ?? 'Erreur lors du chargement des catégories',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return _handleDioError(e);
    } catch (e) {
      return ApiResponse.error('Erreur inattendue: $e');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUITS
  // ═══════════════════════════════════════════════════════════════════════════

  Future<ApiResponse<List<Product>>> getProducts({
    String? categoryId,
    String? search,
    bool? featured,
  }) async {
    try {
      final queryParams = <String, dynamic>{};
      if (categoryId != null) queryParams['categoryId'] = categoryId;
      if (search != null) queryParams['search'] = search;
      if (featured != null) queryParams['featured'] = featured.toString();

      final response = await _dio.get('/products', queryParameters: queryParams);

      if (response.statusCode == 200) {
        final List<dynamic> data = response.data['data'] ?? [];
        final products = data.map((e) => Product.fromJson(e)).toList();
        return ApiResponse.success(products);
      }

      return ApiResponse.error(
        response.data['message'] ?? 'Erreur lors du chargement des produits',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return _handleDioError(e);
    } catch (e) {
      return ApiResponse.error('Erreur inattendue: $e');
    }
  }

  Future<ApiResponse<Product>> getProduct(String id) async {
    try {
      final response = await _dio.get('/products/$id');

      if (response.statusCode == 200) {
        final product = Product.fromJson(response.data['data']);
        return ApiResponse.success(product);
      }

      return ApiResponse.error(
        response.data['message'] ?? 'Produit non trouvé',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return _handleDioError(e);
    } catch (e) {
      return ApiResponse.error('Erreur inattendue: $e');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMANDES
  // ═══════════════════════════════════════════════════════════════════════════

  Future<ApiResponse<Order>> createOrder(CreateOrderRequest request) async {
    try {
      final response = await _dio.post('/orders', data: request.toJson());

      if (response.statusCode == 201) {
        final order = Order.fromJson(response.data['data']);
        return ApiResponse.success(order);
      }

      return ApiResponse.error(
        response.data['message'] ?? 'Erreur lors de la création de la commande',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return _handleDioError(e);
    } catch (e) {
      return ApiResponse.error('Erreur inattendue: $e');
    }
  }

  Future<ApiResponse<List<Order>>> getOrders({
    OrderStatus? status,
    List<OrderStatus>? statuses,
    DateTime? startDate,
    DateTime? endDate,
    int? page,
    int? limit,
  }) async {
    try {
      final queryParams = <String, dynamic>{};
      if (status != null) queryParams['status'] = status.name;
      if (statuses != null && statuses.isNotEmpty) {
        queryParams['statuses'] = statuses.map((s) => s.name).join(',');
      }
      if (startDate != null) queryParams['startDate'] = startDate.toIso8601String();
      if (endDate != null) queryParams['endDate'] = endDate.toIso8601String();
      if (page != null) queryParams['page'] = page.toString();
      if (limit != null) queryParams['limit'] = limit.toString();

      final response = await _dio.get('/orders', queryParameters: queryParams);

      if (response.statusCode == 200) {
        final List<dynamic> data = response.data['data'] ?? [];
        final orders = data.map((e) => Order.fromJson(e)).toList();
        return ApiResponse.success(orders);
      }

      return ApiResponse.error(
        response.data['message'] ?? 'Erreur lors du chargement des commandes',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return _handleDioError(e);
    } catch (e) {
      return ApiResponse.error('Erreur inattendue: $e');
    }
  }

  Future<ApiResponse<Order>> duplicateOrder(String orderId) async {
    try {
      final response = await _dio.post('/orders/$orderId/duplicate');

      if (response.statusCode == 201) {
        final order = Order.fromJson(response.data['data']);
        return ApiResponse.success(order);
      }

      return ApiResponse.error(
        response.data['message'] ?? 'Erreur lors de la duplication',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return _handleDioError(e);
    } catch (e) {
      return ApiResponse.error('Erreur inattendue: $e');
    }
  }

  Future<ApiResponse<Order>> getOrder(String id) async {
    try {
      final response = await _dio.get('/orders/$id');

      if (response.statusCode == 200) {
        final order = Order.fromJson(response.data['data']);
        return ApiResponse.success(order);
      }

      return ApiResponse.error(
        response.data['message'] ?? 'Commande non trouvée',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return _handleDioError(e);
    } catch (e) {
      return ApiResponse.error('Erreur inattendue: $e');
    }
  }

  Future<ApiResponse<void>> cancelOrder(String id, {String? reason}) async {
    try {
      final response = await _dio.post('/orders/$id/cancel', data: {
        if (reason != null) 'reason': reason,
      });

      if (response.statusCode == 200) {
        return ApiResponse.success(null);
      }

      return ApiResponse.error(
        response.data['message'] ?? 'Erreur lors de l\'annulation',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return _handleDioError(e);
    } catch (e) {
      return ApiResponse.error('Erreur inattendue: $e');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPTE CLIENT
  // ═══════════════════════════════════════════════════════════════════════════

  Future<ApiResponse<CustomerUser>> getProfile() async {
    try {
      final response = await _dio.get('/customers/me');

      if (response.statusCode == 200) {
        final user = CustomerUser.fromJson(response.data['data']);
        return ApiResponse.success(user);
      }

      return ApiResponse.error(
        response.data['message'] ?? 'Erreur lors du chargement du profil',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return _handleDioError(e);
    } catch (e) {
      return ApiResponse.error('Erreur inattendue: $e');
    }
  }

  Future<ApiResponse<Statement>> getStatement({
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    try {
      final queryParams = <String, dynamic>{};
      if (startDate != null) {
        queryParams['startDate'] = startDate.toIso8601String();
      }
      if (endDate != null) {
        queryParams['endDate'] = endDate.toIso8601String();
      }

      final response = await _dio.get('/customers/me/statement', queryParameters: queryParams);

      if (response.statusCode == 200) {
        final statement = Statement.fromJson(response.data['data']);
        return ApiResponse.success(statement);
      }

      return ApiResponse.error(
        response.data['message'] ?? 'Erreur lors du chargement du relevé',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return _handleDioError(e);
    } catch (e) {
      return ApiResponse.error('Erreur inattendue: $e');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  Future<ApiResponse<List<AppNotification>>> getNotifications({
    bool? unreadOnly,
    int? page,
    int? limit,
  }) async {
    try {
      final queryParams = <String, dynamic>{};
      if (unreadOnly != null) queryParams['unreadOnly'] = unreadOnly.toString();
      if (page != null) queryParams['page'] = page.toString();
      if (limit != null) queryParams['limit'] = limit.toString();

      final response = await _dio.get('/notifications', queryParameters: queryParams);

      if (response.statusCode == 200) {
        final List<dynamic> data = response.data['data'] ?? [];
        final notifications = data.map((e) => AppNotification.fromJson(e)).toList();
        return ApiResponse.success(notifications);
      }

      return ApiResponse.error(
        response.data['message'] ?? 'Erreur lors du chargement des notifications',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return _handleDioError(e);
    } catch (e) {
      return ApiResponse.error('Erreur inattendue: $e');
    }
  }

  Future<ApiResponse<void>> markNotificationRead(String id) async {
    try {
      final response = await _dio.patch('/notifications/$id/read');

      if (response.statusCode == 200) {
        return ApiResponse.success(null);
      }

      return ApiResponse.error(
        response.data['message'] ?? 'Erreur',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return _handleDioError(e);
    } catch (e) {
      return ApiResponse.error('Erreur inattendue: $e');
    }
  }

  Future<ApiResponse<void>> markAllNotificationsRead() async {
    try {
      final response = await _dio.patch('/notifications/read-all');

      if (response.statusCode == 200) {
        return ApiResponse.success(null);
      }

      return ApiResponse.error(
        response.data['message'] ?? 'Erreur',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return _handleDioError(e);
    } catch (e) {
      return ApiResponse.error('Erreur inattendue: $e');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GESTION DES ERREURS
  // ═══════════════════════════════════════════════════════════════════════════

  ApiResponse<T> _handleDioError<T>(DioException error) {
    String message;
    int? statusCode = error.response?.statusCode;

    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        message = 'Connexion trop lente. Vérifiez votre connexion internet.';
        break;
      case DioExceptionType.badResponse:
        message = error.response?.data?['message'] ?? 
                  'Erreur serveur (${error.response?.statusCode})';
        break;
      case DioExceptionType.connectionError:
        message = 'Pas de connexion internet.';
        break;
      default:
        message = 'Une erreur est survenue. Veuillez réessayer.';
    }

    return ApiResponse.error(message, statusCode: statusCode);
  }
}
