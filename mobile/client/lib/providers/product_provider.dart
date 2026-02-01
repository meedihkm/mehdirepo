// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - PRODUCT PROVIDER
// Gestion des produits et catégories
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/models.dart';
import 'providers.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════

/// Provider pour les catégories
final categoriesProvider = FutureProvider<List<Category>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.getCategories();

  if (response.success && response.data != null) {
    return response.data!;
  }

  throw Exception(response.errorMessage ?? 'Erreur de chargement');
});

/// Provider pour les produits par catégorie
final productsByCategoryProvider = FutureProvider.family<List<Product>, String>((ref, categoryId) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.getProducts(categoryId: categoryId);

  if (response.success && response.data != null) {
    return response.data!;
  }

  throw Exception(response.errorMessage ?? 'Erreur de chargement');
});

/// Provider pour la recherche de produits
final productSearchProvider = FutureProvider.family<List<Product>, String>((ref, query) async {
  if (query.isEmpty) return [];
  
  final api = ref.read(apiServiceProvider);
  final response = await api.getProducts(search: query);

  if (response.success && response.data != null) {
    return response.data!;
  }

  throw Exception(response.errorMessage ?? 'Erreur de recherche');
});

/// Provider pour les produits en vedette
final featuredProductsProvider = FutureProvider<List<Product>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.getProducts(featured: true);

  if (response.success && response.data != null) {
    return response.data!;
  }

  throw Exception(response.errorMessage ?? 'Erreur de chargement');
});

/// Provider pour le détail d'un produit
final productDetailProvider = FutureProvider.family<Product, String>((ref, productId) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.getProduct(productId);

  if (response.success && response.data != null) {
    return response.data!;
  }

  throw Exception(response.errorMessage ?? 'Produit non trouvé');
});
