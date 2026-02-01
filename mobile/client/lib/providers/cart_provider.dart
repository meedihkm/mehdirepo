// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - CART PROVIDER
// Gestion du panier d'achat
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/models.dart';
import 'providers.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// CART STATE
// ═══════════════════════════════════════════════════════════════════════════════

class Cart {
  final List<CartItem> items;

  const Cart({this.items = const []});

  factory Cart.empty() => const Cart(items: []);

  int get itemCount => items.length;
  
  int get totalQuantity => items.fold(0, (sum, item) => sum + item.quantity.toInt());
  
  double get total => items.fold(0, (sum, item) => sum + (item.price * item.quantity));
  
  bool get isEmpty => items.isEmpty;
  bool get isNotEmpty => items.isNotEmpty;

  Cart copyWith({
    List<CartItem>? items,
  }) {
    return Cart(
      items: items ?? this.items,
    );
  }
}

class OrderItemInput {
  final String productId;
  final double quantity;

  OrderItemInput({required this.productId, required this.quantity});
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFIER
// ═══════════════════════════════════════════════════════════════════════════════

final cartProvider = StateNotifierProvider<CartNotifier, Cart>((ref) {
  return CartNotifier(ref);
});

class CartNotifier extends StateNotifier<Cart> {
  final Ref _ref;

  CartNotifier(this._ref) : super(Cart.empty());

  void addItem(Product product, {double quantity = 1}) {
    final existingIndex = state.items.indexWhere(
      (item) => item.productId == product.id,
    );

    if (existingIndex >= 0) {
      // Mettre à jour la quantité existante
      final updatedItems = [...state.items];
      final existing = updatedItems[existingIndex];
      updatedItems[existingIndex] = existing.copyWith(
        quantity: existing.quantity + quantity,
      );
      state = state.copyWith(items: updatedItems);
    } else {
      // Ajouter un nouvel article
      final newItem = CartItem(
        productId: product.id,
        productName: product.name,
        price: product.price,
        quantity: quantity,
        unit: product.unit,
        imageUrl: product.imageUrl,
      );
      state = state.copyWith(items: [...state.items, newItem]);
    }
  }

  void removeItem(String productId) {
    state = state.copyWith(
      items: state.items.where((item) => item.productId != productId).toList(),
    );
  }

  void updateQuantity(String productId, double quantity) {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }

    final updatedItems = state.items.map((item) {
      if (item.productId == productId) {
        return item.copyWith(quantity: quantity);
      }
      return item;
    }).toList();

    state = state.copyWith(items: updatedItems);
  }

  void clear() {
    state = Cart.empty();
  }

  List<OrderItemRequest> toOrderItems() {
    return state.items.map((item) => OrderItemRequest(
      productId: item.productId,
      quantity: item.quantity,
    )).toList();
  }
}
