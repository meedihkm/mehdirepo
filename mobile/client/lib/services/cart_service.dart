// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - SERVICE PANIER
// Gestion du panier avec persistance locale
// ═══════════════════════════════════════════════════════════════════════════════

import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/models.dart';

class CartService {
  static const String _cartKey = 'cart_items';
  
  final SharedPreferences _prefs;
  final List<CartItem> _items = [];
  
  CartService(this._prefs) {
    _loadFromStorage();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GETTERS
  // ───────────────────────────────────────────────────────────────────────────

  List<CartItem> get items => List.unmodifiable(_items);

  int get itemCount => _items.length;

  int get totalQuantity => _items.fold(0, (sum, item) => sum + item.quantity.toInt());

  double get subtotal => _items.fold(
        0,
        (sum, item) => sum + (item.price * item.quantity),
      );

  bool get isEmpty => _items.isEmpty;

  bool get isNotEmpty => _items.isNotEmpty;

  // ───────────────────────────────────────────────────────────────────────────
  // OPÉRATIONS
  // ───────────────────────────────────────────────────────────────────────────

  void addItem(Product product, double quantity, {String? notes}) {
    final existingIndex = _items.indexWhere((item) => item.productId == product.id);

    if (existingIndex >= 0) {
      // Mettre à jour la quantité si le produit existe déjà
      final existing = _items[existingIndex];
      _items[existingIndex] = existing.copyWith(
        quantity: existing.quantity + quantity,
        notes: notes ?? existing.notes,
      );
    } else {
      // Ajouter un nouvel article
      _items.add(CartItem(
        productId: product.id,
        productName: product.name,
        price: product.customPrice ?? product.price,
        quantity: quantity,
        unit: product.unit,
        imageUrl: product.imageUrl,
        notes: notes,
      ));
    }

    _saveToStorage();
  }

  void updateQuantity(String productId, double quantity) {
    final index = _items.indexWhere((item) => item.productId == productId);
    if (index < 0) return;

    if (quantity <= 0) {
      removeItem(productId);
    } else {
      _items[index] = _items[index].copyWith(quantity: quantity);
      _saveToStorage();
    }
  }

  void updateNotes(String productId, String? notes) {
    final index = _items.indexWhere((item) => item.productId == productId);
    if (index < 0) return;

    _items[index] = _items[index].copyWith(notes: notes);
    _saveToStorage();
  }

  void removeItem(String productId) {
    _items.removeWhere((item) => item.productId == productId);
    _saveToStorage();
  }

  void clear() {
    _items.clear();
    _saveToStorage();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PERSISTENCE
  // ───────────────────────────────────────────────────────────────────────────

  void _loadFromStorage() {
    final jsonString = _prefs.getString(_cartKey);
    if (jsonString != null) {
      try {
        final List<dynamic> jsonList = jsonDecode(jsonString);
        _items.clear();
        _items.addAll(jsonList.map((e) => CartItem.fromJson(e)));
      } catch (e) {
        // Ignorer les erreurs de parsing
      }
    }
  }

  Future<void> _saveToStorage() async {
    final jsonList = _items.map((e) => e.toJson()).toList();
    await _prefs.setString(_cartKey, jsonEncode(jsonList));
  }

  // ───────────────────────────────────────────────────────────────────────────
  // CONVERSION
  // ───────────────────────────────────────────────────────────────────────────

  List<OrderItemRequest> toOrderItems() {
    return _items
        .map((item) => OrderItemRequest(
              productId: item.productId,
              quantity: item.quantity,
              notes: item.notes,
            ))
        .toList();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // VALIDATION
  // ───────────────────────────────────────────────────────────────────────────

  String? validateForCheckout({
    required double creditLimit,
    required double currentDebt,
    required bool creditLimitEnabled,
  }) {
    if (_items.isEmpty) {
      return 'Votre panier est vide';
    }

    // Vérifier le plafond de crédit
    if (creditLimitEnabled) {
      final newTotal = currentDebt + subtotal;
      if (newTotal > creditLimit) {
        final available = creditLimit - currentDebt;
        return 'Dépassement du plafond de crédit. Disponible: ${available.toStringAsFixed(2)} DA';
      }
    }

    return null;
  }
}
