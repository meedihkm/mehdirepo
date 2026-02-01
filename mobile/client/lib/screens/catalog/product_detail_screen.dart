// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - APP CLIENT - ÉCRAN DÉTAIL PRODUIT
// Affichage produit avec ajout au panier
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════

final productDetailProvider = FutureProvider.family<ProductDetail, String>((ref, productId) async {
  // TODO: Appel API GET /customer-api/products/:id
  await Future.delayed(const Duration(milliseconds: 500));
  return ProductDetail(
    id: productId,
    name: 'Produit $productId',
    description: 'Description détaillée du produit. Pain traditionnel algérien préparé avec des ingrédients de qualité.',
    sku: 'SKU-$productId',
    category: 'Pains',
    unit: 'pièce',
    basePrice: 50,
    discountPrice: null,
    imageUrl: null,
    isAvailable: true,
    stockStatus: 'in_stock',
    nutritionalInfo: 'Farine, eau, levure, sel',
    weight: '250g',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// MODELS
// ═══════════════════════════════════════════════════════════════════════════════

class ProductDetail {
  final String id;
  final String name;
  final String description;
  final String sku;
  final String category;
  final String unit;
  final double basePrice;
  final double? discountPrice;
  final String? imageUrl;
  final bool isAvailable;
  final String stockStatus;
  final String? nutritionalInfo;
  final String? weight;

  ProductDetail({
    required this.id, required this.name, required this.description,
    required this.sku, required this.category, required this.unit,
    required this.basePrice, this.discountPrice, this.imageUrl,
    required this.isAvailable, required this.stockStatus,
    this.nutritionalInfo, this.weight,
  });

  double get currentPrice => discountPrice ?? basePrice;
  bool get hasDiscount => discountPrice != null && discountPrice! < basePrice;
  int get discountPercent => hasDiscount
      ? ((1 - discountPrice! / basePrice) * 100).round()
      : 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ÉCRAN DÉTAIL PRODUIT
// ═══════════════════════════════════════════════════════════════════════════════

class ProductDetailScreen extends ConsumerStatefulWidget {
  final String productId;

  const ProductDetailScreen({super.key, required this.productId});

  @override
  ConsumerState<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen> {
  int _quantity = 1;
  final _currencyFormat = NumberFormat.currency(locale: 'fr_FR', symbol: 'DA', decimalDigits: 0);

  @override
  Widget build(BuildContext context) {
    final productAsync = ref.watch(productDetailProvider(widget.productId));

    return Scaffold(
      body: productAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.red),
              const SizedBox(height: 16),
              Text('Erreur: $err'),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => ref.invalidate(productDetailProvider(widget.productId)),
                child: const Text('Réessayer'),
              ),
            ],
          ),
        ),
        data: (product) => _buildProductContent(product),
      ),
    );
  }

  Widget _buildProductContent(ProductDetail product) {
    return CustomScrollView(
      slivers: [
        // App bar avec image
        SliverAppBar(
          expandedHeight: 280,
          pinned: true,
          flexibleSpace: FlexibleSpaceBar(
            background: product.imageUrl != null
                ? Image.network(product.imageUrl!, fit: BoxFit.cover)
                : Container(
                    color: Colors.grey.shade200,
                    child: Center(
                      child: Icon(Icons.bakery_dining, size: 80, color: Colors.grey.shade400),
                    ),
                  ),
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.share),
              onPressed: () {
                // TODO: Partager le produit
              },
            ),
          ],
        ),

        // Contenu
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Catégorie
                Chip(
                  label: Text(product.category),
                  backgroundColor: Theme.of(context).primaryColor.withOpacity(0.1),
                  labelStyle: TextStyle(
                    color: Theme.of(context).primaryColor,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 8),

                // Nom
                Text(
                  product.name,
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Text('Réf: ${product.sku}', style: TextStyle(color: Colors.grey[500], fontSize: 13)),
                const SizedBox(height: 16),

                // Prix
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      _currencyFormat.format(product.currentPrice),
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        color: Theme.of(context).primaryColor,
                      ),
                    ),
                    Text(' / ${product.unit}', style: TextStyle(color: Colors.grey[600], fontSize: 14)),
                    if (product.hasDiscount) ...[
                      const SizedBox(width: 12),
                      Text(
                        _currencyFormat.format(product.basePrice),
                        style: const TextStyle(
                          fontSize: 16,
                          decoration: TextDecoration.lineThrough,
                          color: Colors.grey,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.red,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          '-${product.discountPercent}%',
                          style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 20),

                // Disponibilité
                Row(
                  children: [
                    Icon(
                      product.isAvailable ? Icons.check_circle : Icons.cancel,
                      color: product.isAvailable ? Colors.green : Colors.red,
                      size: 18,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      product.isAvailable ? 'En stock' : 'Indisponible',
                      style: TextStyle(
                        color: product.isAvailable ? Colors.green : Colors.red,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),

                const Divider(height: 32),

                // Description
                const Text('Description', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Text(product.description, style: TextStyle(color: Colors.grey[700], height: 1.5)),

                if (product.weight != null || product.nutritionalInfo != null) ...[
                  const Divider(height: 32),
                  const Text('Informations', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  if (product.weight != null)
                    _InfoRow(label: 'Poids', value: product.weight!),
                  if (product.nutritionalInfo != null)
                    _InfoRow(label: 'Ingrédients', value: product.nutritionalInfo!),
                ],

                const SizedBox(height: 100), // Espace pour le bouton flottant
              ],
            ),
          ),
        ),
      ],
    );
  }

  // Bottom bar avec quantité + bouton ajout
  // Widget _buildBottomBar(ProductDetail product) {
  //   // Note: dans l'implémentation réelle, utilisez un bottomNavigationBar
  // }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;

  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(label, style: TextStyle(color: Colors.grey[600], fontWeight: FontWeight.w500)),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
