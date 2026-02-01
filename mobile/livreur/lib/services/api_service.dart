// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - SERVICE API
// Client HTTP avec gestion des tokens et retry
// ═══════════════════════════════════════════════════════════════════════════════

import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const String _baseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://localhost:3000/api/v1',
);

const Duration _connectTimeout = Duration(seconds: 30);
const Duration _receiveTimeout = Duration(seconds: 30);
const int _maxRetries = 3;

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════

final apiServiceProvider = Provider<ApiService>((ref) {
  return ApiService();
});

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

class ApiService {
  late Dio _dio;
  String? _accessToken;
  String? _refreshToken;
  
  ApiService() {
    _initDio();
    _loadTokens();
  }
  
  void _initDio() {
    _dio = Dio(BaseOptions(
      baseUrl: _baseUrl,
      connectTimeout: _connectTimeout,
      receiveTimeout: _receiveTimeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));
    
    // Intercepteur pour ajouter le token
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        if (_accessToken != null) {
          options.headers['Authorization'] = 'Bearer $_accessToken';
        }
        return handler.next(options);
      },
      onError: (error, handler) async {
        // Gérer le 401 en tentant de refresh le token
        if (error.response?.statusCode == 401 && _refreshToken != null) {
          final refreshed = await _refreshAccessToken();
          if (refreshed) {
            // Réessayer la requête
            final opts = error.requestOptions;
            opts.headers['Authorization'] = 'Bearer $_accessToken';
            try {
              final response = await _dio.fetch(opts);
              return handler.resolve(response);
            } catch (e) {
              return handler.next(error);
            }
          }
        }
        return handler.next(error);
      },
    ));
    
    // Intercepteur de logs en mode debug
    assert(() {
      _dio.interceptors.add(LogInterceptor(
        requestBody: true,
        responseBody: true,
      ));
      return true;
    }());
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // AUTHENTIFICATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  Future<ApiResponse<AuthResult>> login(String email, String password) async {
    try {
      final response = await _dio.post('/auth/login', data: {
        'email': email,
        'password': password,
      });
      
      final data = response.data['data'];
      await _saveTokens(
        accessToken: data['accessToken'],
        refreshToken: data['refreshToken'],
      );
      
      return ApiResponse.success(AuthResult(
        user: UserInfo.fromJson(data['user']),
        organization: OrganizationInfo.fromJson(data['organization']),
      ));
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }
  
  Future<void> logout() async {
    try {
      await _dio.post('/auth/logout');
    } finally {
      await _clearTokens();
    }
  }
  
  Future<bool> _refreshAccessToken() async {
    try {
      final response = await _dio.post('/auth/refresh', data: {
        'refreshToken': _refreshToken,
      });
      
      final data = response.data['data'];
      await _saveTokens(
        accessToken: data['accessToken'],
        refreshToken: data['refreshToken'] ?? _refreshToken,
      );
      
      return true;
    } catch (e) {
      await _clearTokens();
      return false;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // LIVRAISONS
  // ═══════════════════════════════════════════════════════════════════════════
  
  Future<ApiResponse<List<DeliveryInfo>>> getMyRoute({DateTime? date}) async {
    try {
      final response = await _dio.get('/deliveries/my-route', queryParameters: {
        if (date != null) 'date': date.toIso8601String(),
      });
      
      final deliveries = (response.data['data'] as List)
          .map((d) => DeliveryInfo.fromJson(d))
          .toList();
      
      return ApiResponse.success(deliveries);
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }
  
  Future<ApiResponse<DeliveryDetail>> getDelivery(String id) async {
    try {
      final response = await _dio.get('/deliveries/$id');
      return ApiResponse.success(DeliveryDetail.fromJson(response.data['data']));
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }
  
  Future<ApiResponse<CompleteDeliveryResult>> completeDelivery(
    String id, {
    required double amountCollected,
    required String collectionMode,
    String? notes,
    Map<String, dynamic>? signature,
    Map<String, dynamic>? location,
  }) async {
    try {
      final response = await _dio.put('/deliveries/$id/complete', data: {
        'amountCollected': amountCollected,
        'collectionMode': collectionMode,
        if (notes != null) 'notes': notes,
        if (signature != null) 'signature': signature,
        if (location != null) 'location': location,
      });
      
      return ApiResponse.success(CompleteDeliveryResult.fromJson(response.data['data']));
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }
  
  Future<ApiResponse<void>> failDelivery(
    String id, {
    required String reason,
    Map<String, dynamic>? location,
  }) async {
    try {
      await _dio.put('/deliveries/$id/fail', data: {
        'reason': reason,
        if (location != null) 'location': location,
      });
      
      return ApiResponse.success(null);
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }
  
  Future<ApiResponse<void>> updateDeliveryStatus(
    String id, {
    required String status,
    Map<String, dynamic>? location,
  }) async {
    try {
      await _dio.put('/deliveries/$id/status', data: {
        'status': status,
        if (location != null) 'location': location,
      });
      
      return ApiResponse.success(null);
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PAIEMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  
  Future<ApiResponse<PaymentResult>> collectDebt({
    required String customerId,
    required double amount,
    required String collectionMode,
    String? notes,
  }) async {
    try {
      final response = await _dio.post('/deliveries/collect-debt', data: {
        'customerId': customerId,
        'amount': amount,
        'collectionMode': collectionMode,
        if (notes != null) 'notes': notes,
      });
      
      return ApiResponse.success(PaymentResult.fromJson(response.data['data']));
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CAISSE JOURNALIÈRE
  // ═══════════════════════════════════════════════════════════════════════════
  
  Future<ApiResponse<DailyCashInfo>> getTodayCash() async {
    try {
      final response = await _dio.get('/daily-cash/today');
      return ApiResponse.success(DailyCashInfo.fromJson(response.data['data']));
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }
  
  Future<ApiResponse<void>> closeDailyCash({
    required double cashHandedOver,
    String? discrepancyNotes,
  }) async {
    try {
      await _dio.post('/daily-cash/close', data: {
        'cashHandedOver': cashHandedOver,
        if (discrepancyNotes != null) 'discrepancyNotes': discrepancyNotes,
      });
      
      return ApiResponse.success(null);
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SYNCHRONISATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  Future<ApiResponse<Map<String, dynamic>>> getInitialSyncData() async {
    try {
      final response = await _dio.get('/sync/initial');
      return ApiResponse.success(response.data['data']);
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }
  
  Future<ApiResponse<Map<String, dynamic>>> pushTransactions(
    List<Map<String, dynamic>> transactions,
  ) async {
    try {
      final response = await _dio.post('/sync/push', data: {
        'transactions': transactions,
      });
      return ApiResponse.success(response.data['data']);
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // MÉTHODES GÉNÉRIQUES
  // ═══════════════════════════════════════════════════════════════════════════
  
  Future<ApiResponse<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    try {
      final response = await _dio.get(path, queryParameters: queryParameters);
      return ApiResponse.success(response.data['data']);
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }
  
  Future<ApiResponse<T>> post<T>(
    String path, {
    dynamic data,
  }) async {
    try {
      final response = await _dio.post(path, data: data);
      return ApiResponse.success(response.data['data']);
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }
  
  Future<ApiResponse<T>> put<T>(
    String path, {
    dynamic data,
  }) async {
    try {
      final response = await _dio.put(path, data: data);
      return ApiResponse.success(response.data['data']);
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // GESTION DES TOKENS
  // ═══════════════════════════════════════════════════════════════════════════
  
  Future<void> _loadTokens() async {
    final prefs = await SharedPreferences.getInstance();
    _accessToken = prefs.getString('access_token');
    _refreshToken = prefs.getString('refresh_token');
  }
  
  Future<void> _saveTokens({
    required String accessToken,
    required String? refreshToken,
  }) async {
    _accessToken = accessToken;
    _refreshToken = refreshToken;
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('access_token', accessToken);
    if (refreshToken != null) {
      await prefs.setString('refresh_token', refreshToken);
    }
  }
  
  Future<void> _clearTokens() async {
    _accessToken = null;
    _refreshToken = null;
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('access_token');
    await prefs.remove('refresh_token');
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // GESTION DES ERREURS
  // ═══════════════════════════════════════════════════════════════════════════
  
  String _handleError(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return 'La connexion a expiré. Vérifiez votre connexion internet.';
        
      case DioExceptionType.connectionError:
        return 'Impossible de se connecter au serveur.';
        
      case DioExceptionType.badResponse:
        final statusCode = error.response?.statusCode;
        final data = error.response?.data;
        
        if (data != null && data['error'] != null) {
          return data['error']['message'] ?? 'Erreur serveur';
        }
        
        switch (statusCode) {
          case 400:
            return 'Requête invalide';
          case 401:
            return 'Session expirée. Veuillez vous reconnecter.';
          case 403:
            return 'Accès refusé';
          case 404:
            return 'Ressource non trouvée';
          case 500:
            return 'Erreur serveur';
          default:
            return 'Erreur $statusCode';
        }
        
      default:
        return 'Une erreur est survenue';
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODÈLES DE RÉPONSE
// ═══════════════════════════════════════════════════════════════════════════════

class ApiResponse<T> {
  final bool success;
  final T? data;
  final String? errorMessage;
  
  ApiResponse._({
    required this.success,
    this.data,
    this.errorMessage,
  });
  
  factory ApiResponse.success(T data) => ApiResponse._(
    success: true,
    data: data,
  );
  
  factory ApiResponse.error(String message) => ApiResponse._(
    success: false,
    errorMessage: message,
  );
}

class AuthResult {
  final UserInfo user;
  final OrganizationInfo organization;
  
  AuthResult({
    required this.user,
    required this.organization,
  });
}

class UserInfo {
  final String id;
  final String email;
  final String name;
  final String role;
  final String organizationId;
  
  UserInfo({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    required this.organizationId,
  });
  
  factory UserInfo.fromJson(Map<String, dynamic> json) => UserInfo(
    id: json['id'],
    email: json['email'],
    name: json['name'],
    role: json['role'],
    organizationId: json['organizationId'],
  );
}

class OrganizationInfo {
  final String id;
  final String name;
  final String? logoUrl;
  
  OrganizationInfo({
    required this.id,
    required this.name,
    this.logoUrl,
  });
  
  factory OrganizationInfo.fromJson(Map<String, dynamic> json) => OrganizationInfo(
    id: json['id'],
    name: json['name'],
    logoUrl: json['logoUrl'],
  );
}

class DeliveryInfo {
  final String id;
  final String status;
  final DateTime scheduledDate;
  final int? sequenceNumber;
  final double orderAmount;
  final double totalToCollect;
  final OrderInfo order;
  
  DeliveryInfo({
    required this.id,
    required this.status,
    required this.scheduledDate,
    this.sequenceNumber,
    required this.orderAmount,
    required this.totalToCollect,
    required this.order,
  });
  
  factory DeliveryInfo.fromJson(Map<String, dynamic> json) => DeliveryInfo(
    id: json['id'],
    status: json['status'],
    scheduledDate: DateTime.parse(json['scheduledDate']),
    sequenceNumber: json['sequenceNumber'],
    orderAmount: (json['orderAmount'] as num).toDouble(),
    totalToCollect: (json['totalToCollect'] as num).toDouble(),
    order: OrderInfo.fromJson(json['order']),
  );
}

class DeliveryDetail {
  final String id;
  final String status;
  final DateTime scheduledDate;
  final double orderAmount;
  final double existingDebt;
  final double totalToCollect;
  final OrderInfo order;
  final CustomerInfo customer;
  
  DeliveryDetail({
    required this.id,
    required this.status,
    required this.scheduledDate,
    required this.orderAmount,
    required this.existingDebt,
    required this.totalToCollect,
    required this.order,
    required this.customer,
  });
  
  factory DeliveryDetail.fromJson(Map<String, dynamic> json) => DeliveryDetail(
    id: json['id'],
    status: json['status'],
    scheduledDate: DateTime.parse(json['scheduledDate']),
    orderAmount: (json['orderAmount'] as num).toDouble(),
    existingDebt: (json['existingDebt'] as num).toDouble(),
    totalToCollect: (json['totalToCollect'] as num).toDouble(),
    order: OrderInfo.fromJson(json['order']),
    customer: CustomerInfo.fromJson(json['order']['customer']),
  );
}

class OrderInfo {
  final String id;
  final String orderNumber;
  final String status;
  final double total;
  final List<OrderItemInfo> items;
  
  OrderInfo({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.total,
    required this.items,
  });
  
  factory OrderInfo.fromJson(Map<String, dynamic> json) => OrderInfo(
    id: json['id'],
    orderNumber: json['orderNumber'],
    status: json['status'],
    total: (json['total'] as num).toDouble(),
    items: (json['items'] as List)
        .map((i) => OrderItemInfo.fromJson(i))
        .toList(),
  );
}

class OrderItemInfo {
  final String id;
  final String productName;
  final double quantity;
  final double unitPrice;
  final double totalPrice;
  
  OrderItemInfo({
    required this.id,
    required this.productName,
    required this.quantity,
    required this.unitPrice,
    required this.totalPrice,
  });
  
  factory OrderItemInfo.fromJson(Map<String, dynamic> json) => OrderItemInfo(
    id: json['id'],
    productName: json['productName'] ?? json['product_name_snapshot'],
    quantity: (json['quantity'] as num).toDouble(),
    unitPrice: (json['unitPrice'] ?? json['unit_price_snapshot'] as num).toDouble(),
    totalPrice: (json['totalPrice'] ?? json['total_price'] as num).toDouble(),
  );
}

class CustomerInfo {
  final String id;
  final String name;
  final String phone;
  final String address;
  final double currentDebt;
  final double creditLimit;
  
  CustomerInfo({
    required this.id,
    required this.name,
    required this.phone,
    required this.address,
    required this.currentDebt,
    required this.creditLimit,
  });
  
  factory CustomerInfo.fromJson(Map<String, dynamic> json) => CustomerInfo(
    id: json['id'],
    name: json['name'],
    phone: json['phone'],
    address: json['address'],
    currentDebt: (json['currentDebt'] as num).toDouble(),
    creditLimit: (json['creditLimit'] as num).toDouble(),
  );
}

class CompleteDeliveryResult {
  final DeliveryInfo delivery;
  final TransactionDetail transaction;
  final CustomerSummary customer;
  
  CompleteDeliveryResult({
    required this.delivery,
    required this.transaction,
    required this.customer,
  });
  
  factory CompleteDeliveryResult.fromJson(Map<String, dynamic> json) => CompleteDeliveryResult(
    delivery: DeliveryInfo.fromJson(json['delivery']),
    transaction: TransactionDetail.fromJson(json['transaction']),
    customer: CustomerSummary.fromJson(json['customer']),
  );
}

class TransactionDetail {
  final double orderAmount;
  final double debtBefore;
  final double amountPaid;
  final double appliedToOrder;
  final double appliedToDebt;
  final double newDebtCreated;
  final double debtAfter;
  
  TransactionDetail({
    required this.orderAmount,
    required this.debtBefore,
    required this.amountPaid,
    required this.appliedToOrder,
    required this.appliedToDebt,
    required this.newDebtCreated,
    required this.debtAfter,
  });
  
  factory TransactionDetail.fromJson(Map<String, dynamic> json) => TransactionDetail(
    orderAmount: (json['orderAmount'] as num).toDouble(),
    debtBefore: (json['debtBefore'] as num).toDouble(),
    amountPaid: (json['amountPaid'] as num).toDouble(),
    appliedToOrder: (json['appliedToOrder'] as num).toDouble(),
    appliedToDebt: (json['appliedToDebt'] as num).toDouble(),
    newDebtCreated: (json['newDebtCreated'] as num).toDouble(),
    debtAfter: (json['debtAfter'] as num).toDouble(),
  );
}

class CustomerSummary {
  final String id;
  final String name;
  final double currentDebt;
  final double creditLimit;
  
  CustomerSummary({
    required this.id,
    required this.name,
    required this.currentDebt,
    required this.creditLimit,
  });
  
  factory CustomerSummary.fromJson(Map<String, dynamic> json) => CustomerSummary(
    id: json['id'],
    name: json['name'],
    currentDebt: (json['currentDebt'] as num).toDouble(),
    creditLimit: (json['creditLimit'] as num).toDouble(),
  );
}

class PaymentResult {
  final CustomerSummary customer;
  final Map<String, dynamic> payment;
  
  PaymentResult({
    required this.customer,
    required this.payment,
  });
  
  factory PaymentResult.fromJson(Map<String, dynamic> json) => PaymentResult(
    customer: CustomerSummary.fromJson(json['customer']),
    payment: json['payment'],
  );
}

class DailyCashInfo {
  final String id;
  final DateTime date;
  final double expectedCollection;
  final double actualCollection;
  final double newDebtCreated;
  final int deliveriesTotal;
  final int deliveriesCompleted;
  final int deliveriesFailed;
  final bool isClosed;
  
  DailyCashInfo({
    required this.id,
    required this.date,
    required this.expectedCollection,
    required this.actualCollection,
    required this.newDebtCreated,
    required this.deliveriesTotal,
    required this.deliveriesCompleted,
    required this.deliveriesFailed,
    required this.isClosed,
  });
  
  factory DailyCashInfo.fromJson(Map<String, dynamic> json) => DailyCashInfo(
    id: json['id'],
    date: DateTime.parse(json['date']),
    expectedCollection: (json['expectedCollection'] as num).toDouble(),
    actualCollection: (json['actualCollection'] as num).toDouble(),
    newDebtCreated: (json['newDebtCreated'] as num).toDouble(),
    deliveriesTotal: json['deliveriesTotal'] ?? 0,
    deliveriesCompleted: json['deliveriesCompleted'] ?? 0,
    deliveriesFailed: json['deliveriesFailed'] ?? 0,
    isClosed: json['isClosed'] ?? false,
  );
}
