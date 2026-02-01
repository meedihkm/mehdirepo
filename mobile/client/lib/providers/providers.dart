// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - PROVIDERS APP CLIENT
// Gestion d'état avec Riverpod
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../services/cart_service.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICES
// ═══════════════════════════════════════════════════════════════════════════════

final sharedPreferencesProvider = Provider<SharedPreferences>((ref) {
  throw UnimplementedError('Doit être initialisé au démarrage');
});

final secureStorageProvider = Provider<FlutterSecureStorage>((ref) {
  return const FlutterSecureStorage();
});

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService(
    ref.watch(secureStorageProvider),
    ref.watch(sharedPreferencesProvider),
  );
});

final apiServiceProvider = Provider<ApiService>((ref) {
  return ApiService(ref.watch(authServiceProvider));
});

final cartServiceProvider = Provider<CartService>((ref) {
  return CartService(ref.watch(sharedPreferencesProvider));
});

// ═══════════════════════════════════════════════════════════════════════════════
// ÉTAT AUTH
// ═══════════════════════════════════════════════════════════════════════════════

final authStateProvider = StreamProvider<AuthState>((ref) {
  final authService = ref.watch(authServiceProvider);
  
  // Créer un stream à partir du ChangeNotifier
  return Stream.periodic(const Duration(milliseconds: 100))
    .map((_) => AuthState(
      isAuthenticated: authService.isAuthenticated,
      user: authService.currentUser,
    ))
    .distinct();
});

class AuthState {
  final bool isAuthenticated;
  final CustomerUser? user;

  const AuthState({
    required this.isAuthenticated,
    this.user,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH NOTIFIER
// ═══════════════════════════════════════════════════════════════════════════════

final authNotifierProvider = StateNotifierProvider<AuthNotifier, AsyncValue<void>>((ref) {
  return AuthNotifier(ref);
});

class AuthNotifier extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;

  AuthNotifier(this._ref) : super(const AsyncValue.data(null));

  Future<bool> requestOtp(String phone) async {
    state = const AsyncValue.loading();
    
    try {
      final api = ref.read(apiServiceProvider);
      final response = await api.requestOtp(phone);

      if (response.success) {
        state = const AsyncValue.data(null);
        return true;
      } else {
        throw Exception(response.errorMessage);
      }
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
      return false;
    }
  }

  Future<bool> verifyOtp(String phone, String otp) async {
    state = const AsyncValue.loading();
    
    try {
      final api = _ref.read(apiServiceProvider);
      final authService = _ref.read(authServiceProvider);
      
      final response = await api.verifyOtp(phone, otp);

      if (response.success && response.data != null) {
        await authService.saveSession(response.data!);
        state = const AsyncValue.data(null);
        return true;
      } else {
        throw Exception(response.errorMessage);
      }
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
      return false;
    }
  }

  Future<void> logout() async {
    final authService = _ref.read(authServiceProvider);
    await authService.logout();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATÉGORIES
// ═══════════════════════════════════════════════════════════════════════════════

final categoriesProvider = FutureProvider<List<Category>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.getCategories();

  if (response.success && response.data != null) {
    return response.data!;
  }

  throw Exception(response.errorMessage ?? 'Erreur de chargement');
});

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUITS
// ═══════════════════════════════════════════════════════════════════════════════

final productsProvider = FutureProvider.family<List<Product>, ProductFilter>((ref, filter) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.getProducts(
    categoryId: filter.categoryId,
    search: filter.search,
    featured: filter.featured,
  );

  if (response.success && response.data != null) {
    return response.data!;
  }

  throw Exception(response.errorMessage ?? 'Erreur de chargement');
});

class ProductFilter {
  final String? categoryId;
  final String? search;
  final bool? featured;

  const ProductFilter({
    this.categoryId,
    this.search,
    this.featured,
  });

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ProductFilter &&
          runtimeType == other.runtimeType &&
          categoryId == other.categoryId &&
          search == other.search &&
          featured == other.featured;

  @override
  int get hashCode => categoryId.hashCode ^ search.hashCode ^ featured.hashCode;
}

final selectedCategoryProvider = StateProvider<String?>((ref) => null);

final searchQueryProvider = StateProvider<String>((ref) => '');

final filteredProductsProvider = Provider<AsyncValue<List<Product>>>((ref) {
  final categoryId = ref.watch(selectedCategoryProvider);
  final search = ref.watch(searchQueryProvider);

  return ref.watch(productsProvider(ProductFilter(
    categoryId: categoryId,
    search: search.isEmpty ? null : search,
  )));
});

// ═══════════════════════════════════════════════════════════════════════════════
// PANIER
// ═══════════════════════════════════════════════════════════════════════════════

final cartProvider = StateNotifierProvider<CartNotifier, CartState>((ref) {
  return CartNotifier(ref);
});

class CartState {
  final List<CartItem> items;
  final double subtotal;

  const CartState({
    required this.items,
    required this.subtotal,
  });

  factory CartState.empty() => const CartState(items: [], subtotal: 0);

  int get itemCount => items.length;
  int get totalQuantity => items.fold(0, (sum, item) => sum + item.quantity.toInt());
  bool get isEmpty => items.isEmpty;
}

class CartNotifier extends StateNotifier<CartState> {
  final Ref _ref;

  CartNotifier(this._ref) : super(CartState.empty()) {
    _loadCart();
  }

  void _loadCart() {
    final cartService = _ref.read(cartServiceProvider);
    state = CartState(
      items: cartService.items,
      subtotal: cartService.subtotal,
    );
  }

  void addItem(Product product, double quantity, {String? notes}) {
    final cartService = _ref.read(cartServiceProvider);
    cartService.addItem(product, quantity, notes: notes);
    _loadCart();
  }

  void updateQuantity(String productId, double quantity) {
    final cartService = _ref.read(cartServiceProvider);
    cartService.updateQuantity(productId, quantity);
    _loadCart();
  }

  void removeItem(String productId) {
    final cartService = _ref.read(cartServiceProvider);
    cartService.removeItem(productId);
    _loadCart();
  }

  void clear() {
    final cartService = _ref.read(cartServiceProvider);
    cartService.clear();
    _loadCart();
  }

  String? validateForCheckout() {
    final cartService = _ref.read(cartServiceProvider);
    final authService = _ref.read(authServiceProvider);
    final user = authService.currentUser;

    if (user == null) return 'Non authentifié';

    return cartService.validateForCheckout(
      creditLimit: user.creditLimit ?? 0,
      currentDebt: user.currentDebt ?? 0,
      creditLimitEnabled: user.creditLimit != null && user.creditLimit! > 0,
    );
  }

  List<OrderItemRequest> toOrderItems() {
    return _ref.read(cartServiceProvider).toOrderItems();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMANDES
// ═══════════════════════════════════════════════════════════════════════════════

final ordersProvider = FutureProvider<List<Order>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.getOrders();

  if (response.success && response.data != null) {
    return response.data!;
  }

  throw Exception(response.errorMessage ?? 'Erreur de chargement');
});

final orderDetailProvider = FutureProvider.family<Order, String>((ref, id) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.getOrder(id);

  if (response.success && response.data != null) {
    return response.data!;
  }

  throw Exception(response.errorMessage ?? 'Commande non trouvée');
});

final orderNotifierProvider = StateNotifierProvider<OrderNotifier, AsyncValue<void>>((ref) {
  return OrderNotifier(ref);
});

class OrderNotifier extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;

  OrderNotifier(this._ref) : super(const AsyncValue.data(null));

  Future<Order?> createOrder({
    DateTime? deliveryDate,
    String? deliveryTimeSlot,
    String? deliveryAddress,
    String? deliveryNotes,
    String? notes,
  }) async {
    state = const AsyncValue.loading();

    try {
      final api = _ref.read(apiServiceProvider);
      final cart = _ref.read(cartProvider);
      final cartNotifier = _ref.read(cartProvider.notifier);

      final request = CreateOrderRequest(
        items: cartNotifier.toOrderItems(),
        deliveryDate: deliveryDate,
        deliveryTimeSlot: deliveryTimeSlot,
        deliveryAddress: deliveryAddress,
        deliveryNotes: deliveryNotes,
        notes: notes,
      );

      final response = await api.createOrder(request);

      if (response.success && response.data != null) {
        // Vider le panier après commande réussie
        cartNotifier.clear();
        state = const AsyncValue.data(null);
        return response.data;
      } else {
        throw Exception(response.errorMessage);
      }
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
      return null;
    }
  }

  Future<bool> cancelOrder(String orderId, {String? reason}) async {
    state = const AsyncValue.loading();

    try {
      final api = _ref.read(apiServiceProvider);
      final response = await api.cancelOrder(orderId, reason: reason);

      if (response.success) {
        state = const AsyncValue.data(null);
        return true;
      } else {
        throw Exception(response.errorMessage);
      }
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
      return false;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPTE
// ═══════════════════════════════════════════════════════════════════════════════

final profileProvider = FutureProvider<CustomerUser>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.getProfile();

  if (response.success && response.data != null) {
    // Mettre à jour le cache local
    await ref.read(authServiceProvider).updateUser(response.data!);
    return response.data!;
  }

  throw Exception(response.errorMessage ?? 'Erreur de chargement');
});

final statementProvider = FutureProvider.family<Statement, DateTimeRange>((ref, range) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.getStatement(
    startDate: range.start,
    endDate: range.end,
  );

  if (response.success && response.data != null) {
    return response.data!;
  }

  throw Exception(response.errorMessage ?? 'Erreur de chargement');
});

class DateTimeRange {
  final DateTime start;
  final DateTime end;

  const DateTimeRange({required this.start, required this.end});
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

final notificationsProvider = FutureProvider<List<AppNotification>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.getNotifications();

  if (response.success && response.data != null) {
    return response.data!;
  }

  throw Exception(response.errorMessage ?? 'Erreur de chargement');
});

final unreadNotificationsCountProvider = Provider<int>((ref) {
  final notifications = ref.watch(notificationsProvider);
  return notifications.when(
    data: (list) => list.where((n) => !(n.isRead ?? false)).length,
    loading: () => 0,
    error: (_, __) => 0,
  );
});

final notificationNotifierProvider = StateNotifierProvider<NotificationNotifier, AsyncValue<void>>((ref) {
  return NotificationNotifier(ref);
});

class NotificationNotifier extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;

  NotificationNotifier(this._ref) : super(const AsyncValue.data(null));

  Future<bool> markAsRead(String id) async {
    try {
      final api = _ref.read(apiServiceProvider);
      final response = await api.markNotificationRead(id);
      return response.success;
    } catch (e) {
      return false;
    }
  }

  Future<bool> markAllAsRead() async {
    try {
      final api = _ref.read(apiServiceProvider);
      final response = await api.markAllNotificationsRead();
      return response.success;
    } catch (e) {
      return false;
    }
  }
}
