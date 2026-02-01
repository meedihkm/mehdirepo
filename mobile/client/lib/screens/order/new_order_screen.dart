// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - APPLICATION CLIENT
// Écran de création de commande
// lib/screens/order/new_order_screen.dart
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../models/models.dart';
import '../../providers/product_provider.dart';
import '../../providers/cart_provider.dart';
import '../../providers/order_provider.dart';
import '../../theme/app_colors.dart';

class NewOrderScreen extends ConsumerStatefulWidget {
  const NewOrderScreen({super.key});

  @override
  ConsumerState<NewOrderScreen> createState() => _NewOrderScreenState();
}

class _NewOrderScreenState extends ConsumerState<NewOrderScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  String? _selectedCategoryId;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 0, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final categories = ref.watch(categoriesProvider);
    final cart = ref.watch(cartProvider);
    final formatter = NumberFormat('#,###', 'fr_FR');

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Nouvelle commande'),
        actions: [
          if (cart.items.isNotEmpty)
            TextButton.icon(
              onPressed: () => ref.read(cartProvider.notifier).clear(),
              icon: const Icon(Icons.delete_outline, color: Colors.red),
              label: const Text('Vider', style: TextStyle(color: Colors.red)),
            ),
        ],
      ),
      body: categories.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Erreur: $e')),
        data: (cats) {
          // Mettre à jour le TabController si nécessaire
          if (_tabController.length != cats.length) {
            _tabController = TabController(length: cats.length, vsync: this);
            if (_selectedCategoryId == null && cats.isNotEmpty) {
              _selectedCategoryId = cats.first.id;
            }
          }

          return Column(
            children: [
              // ═══════════════════════════════════════════════════════════════
              // ONGLETS CATÉGORIES
              // ═══════════════════════════════════════════════════════════════
              if (cats.isNotEmpty)
                Container(
                  color: Colors.white,
                  child: TabBar(
                    controller: _tabController,
                    isScrollable: true,
                    labelColor: AppColors.primary,
                    unselectedLabelColor: Colors.grey[600],
                    indicatorColor: AppColors.primary,
                    tabs: cats.map((cat) => Tab(
                      text: cat.name,
                      icon: cat.icon != null
                          ? Icon(_getIconData(cat.icon!), size: 20)
                          : null,
                    )).toList(),
                    onTap: (index) {
                      setState(() {
                        _selectedCategoryId = cats[index].id;
                      });
                    },
                  ),
                ),

              // ═══════════════════════════════════════════════════════════════
              // LISTE DES PRODUITS
              // ═══════════════════════════════════════════════════════════════
              Expanded(
                child: cats.isEmpty
                    ? _buildEmptyCategories()
                    : TabBarView(
                        controller: _tabController,
                        children: cats.map((cat) => _ProductList(
                          categoryId: cat.id,
                          cart: cart,
                        )).toList(),
                      ),
              ),

              // ═══════════════════════════════════════════════════════════════
              // PANIER / RÉCAPITULATIF
              // ═══════════════════════════════════════════════════════════════
              if (cart.items.isNotEmpty)
                _buildCartSummary(cart, formatter),
            ],
          );
        },
      ),
    );
  }

  Widget _buildEmptyCategories() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.category_outlined, size: 64, color: Colors.grey[300]),
          const SizedBox(height: 16),
          Text(
            'Aucun produit disponible',
            style: TextStyle(color: Colors.grey[600], fontSize: 16),
          ),
        ],
      ),
    );
  }

  Widget _buildCartSummary(Cart cart, NumberFormat formatter) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: Column(
          children: [
            // Résumé
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${cart.items.length} article(s)',
                      style: TextStyle(color: Colors.grey[600], fontSize: 13),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${formatter.format(cart.total)} DZD',
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                Row(
                  children: [
                    // Voir le panier
                    OutlinedButton.icon(
                      onPressed: () => _showCartDetails(),
                      icon: const Icon(Icons.shopping_cart_outlined),
                      label: const Text('Voir'),
                    ),
                    const SizedBox(width: 12),
                    // Confirmer
                    ElevatedButton.icon(
                      onPressed: _isSubmitting ? null : () => _submitOrder(),
                      icon: _isSubmitting
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.check),
                      label: Text(_isSubmitting ? 'Envoi...' : 'Commander'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showCartDetails() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        maxChildSize: 0.9,
        minChildSize: 0.5,
        expand: false,
        builder: (context, scrollController) => _CartDetailsSheet(
          scrollController: scrollController,
          onConfirm: () {
            Navigator.pop(context);
            _submitOrder();
          },
        ),
      ),
    );
  }

  Future<void> _submitOrder() async {
    final cart = ref.read(cartProvider);
    if (cart.items.isEmpty) return;

    setState(() => _isSubmitting = true);

    try {
      final order = await ref.read(orderProvider.notifier).createOrder(
        items: cart.items.map((item) => OrderItemInput(
          productId: item.product.id,
          quantity: item.quantity,
        )).toList(),
      );

      // Vider le panier
      ref.read(cartProvider.notifier).clear();

      if (mounted) {
        // Afficher confirmation
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Commande #${order.orderNumber} envoyée !'),
            backgroundColor: Colors.green,
            action: SnackBarAction(
              label: 'Voir',
              textColor: Colors.white,
              onPressed: () => context.push('/orders/${order.id}'),
            ),
          ),
        );

        // Retourner à l'accueil
        context.go('/');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  IconData _getIconData(String iconName) {
    // Mapping des noms d'icônes vers IconData
    const icons = {
      'bread': Icons.bakery_dining,
      'cake': Icons.cake,
      'cookie': Icons.cookie,
      'drink': Icons.local_drink,
      'food': Icons.restaurant,
      'default': Icons.category,
    };
    return icons[iconName] ?? icons['default']!;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET: Liste des produits par catégorie
// ═══════════════════════════════════════════════════════════════════════════════

class _ProductList extends ConsumerWidget {
  final String categoryId;
  final Cart cart;

  const _ProductList({
    required this.categoryId,
    required this.cart,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final products = ref.watch(productsByCategoryProvider(categoryId));
    final formatter = NumberFormat('#,###', 'fr_FR');

    return products.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Erreur: $e')),
      data: (prods) => prods.isEmpty
          ? Center(
              child: Text(
                'Aucun produit dans cette catégorie',
                style: TextStyle(color: Colors.grey[600]),
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: prods.length,
              itemBuilder: (context, index) {
                final product = prods[index];
                final cartItem = cart.items.firstWhereOrNull(
                  (item) => item.product.id == product.id,
                );
                final quantity = cartItem?.quantity ?? 0;

                return _ProductCard(
                  product: product,
                  quantity: quantity,
                  formatter: formatter,
                  onAdd: () => ref.read(cartProvider.notifier).addItem(product),
                  onRemove: () => ref.read(cartProvider.notifier).removeItem(product.id),
                  onUpdateQuantity: (qty) => ref
                      .read(cartProvider.notifier)
                      .updateQuantity(product.id, qty),
                );
              },
            ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET: Carte produit
// ═══════════════════════════════════════════════════════════════════════════════

class _ProductCard extends StatelessWidget {
  final Product product;
  final double quantity;
  final NumberFormat formatter;
  final VoidCallback onAdd;
  final VoidCallback onRemove;
  final ValueChanged<double> onUpdateQuantity;

  const _ProductCard({
    required this.product,
    required this.quantity,
    required this.formatter,
    required this.onAdd,
    required this.onRemove,
    required this.onUpdateQuantity,
  });

  @override
  Widget build(BuildContext context) {
    final isInCart = quantity > 0;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: isInCart
            ? BorderSide(color: AppColors.primary.withOpacity(0.5), width: 2)
            : BorderSide.none,
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            // Image produit
            Container(
              width: 70,
              height: 70,
              decoration: BoxDecoration(
                color: Colors.grey[100],
                borderRadius: BorderRadius.circular(8),
              ),
              child: product.imageUrl != null
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.network(
                        product.imageUrl!,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Icon(
                          Icons.image_not_supported,
                          color: Colors.grey[400],
                        ),
                      ),
                    )
                  : Icon(Icons.bakery_dining, color: Colors.grey[400], size: 32),
            ),
            const SizedBox(width: 12),

            // Infos produit
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.name,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${formatter.format(product.price)} DZD / ${product.unit}',
                    style: TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  if (!product.isAvailable)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        'Indisponible',
                        style: TextStyle(
                          color: Colors.red[700],
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                ],
              ),
            ),

            // Contrôles quantité
            if (product.isAvailable)
              isInCart
                  ? _QuantitySelector(
                      quantity: quantity,
                      onAdd: onAdd,
                      onRemove: onRemove,
                      onUpdateQuantity: onUpdateQuantity,
                    )
                  : IconButton(
                      onPressed: onAdd,
                      icon: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(
                          Icons.add,
                          color: Colors.white,
                          size: 20,
                        ),
                      ),
                    ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET: Sélecteur de quantité
// ═══════════════════════════════════════════════════════════════════════════════

class _QuantitySelector extends StatelessWidget {
  final double quantity;
  final VoidCallback onAdd;
  final VoidCallback onRemove;
  final ValueChanged<double> onUpdateQuantity;

  const _QuantitySelector({
    required this.quantity,
    required this.onAdd,
    required this.onRemove,
    required this.onUpdateQuantity,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.primary.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Bouton -
          IconButton(
            onPressed: onRemove,
            icon: Icon(
              quantity <= 1 ? Icons.delete_outline : Icons.remove,
              color: quantity <= 1 ? Colors.red : AppColors.primary,
              size: 20,
            ),
            constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
            padding: EdgeInsets.zero,
          ),

          // Quantité (cliquable pour édition manuelle)
          GestureDetector(
            onTap: () => _showQuantityDialog(context),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Text(
                quantity.toStringAsFixed(
                  quantity.truncateToDouble() == quantity ? 0 : 1,
                ),
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: AppColors.primary,
                ),
              ),
            ),
          ),

          // Bouton +
          IconButton(
            onPressed: onAdd,
            icon: Icon(Icons.add, color: AppColors.primary, size: 20),
            constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
            padding: EdgeInsets.zero,
          ),
        ],
      ),
    );
  }

  void _showQuantityDialog(BuildContext context) {
    final controller = TextEditingController(text: quantity.toString());

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Quantité'),
        content: TextField(
          controller: controller,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          autofocus: true,
          decoration: const InputDecoration(
            border: OutlineInputBorder(),
            suffixText: 'unités',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Annuler'),
          ),
          ElevatedButton(
            onPressed: () {
              final value = double.tryParse(controller.text);
              if (value != null && value > 0) {
                onUpdateQuantity(value);
              }
              Navigator.pop(ctx);
            },
            child: const Text('Confirmer'),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET: Feuille détail panier
// ═══════════════════════════════════════════════════════════════════════════════

class _CartDetailsSheet extends ConsumerWidget {
  final ScrollController scrollController;
  final VoidCallback onConfirm;

  const _CartDetailsSheet({
    required this.scrollController,
    required this.onConfirm,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(cartProvider);
    final formatter = NumberFormat('#,###', 'fr_FR');

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          // Poignée
          Container(
            margin: const EdgeInsets.symmetric(vertical: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey[300],
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Titre
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Mon panier',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  '${cart.items.length} article(s)',
                  style: TextStyle(color: Colors.grey[600]),
                ),
              ],
            ),
          ),

          const Divider(height: 24),

          // Liste des articles
          Expanded(
            child: ListView.separated(
              controller: scrollController,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: cart.items.length,
              separatorBuilder: (_, __) => const Divider(),
              itemBuilder: (context, index) {
                final item = cart.items[index];
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Container(
                    width: 50,
                    height: 50,
                    decoration: BoxDecoration(
                      color: Colors.grey[100],
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.bakery_dining, color: Colors.grey),
                  ),
                  title: Text(item.product.name),
                  subtitle: Text(
                    '${formatter.format(item.product.price)} DZD × ${item.quantity}',
                    style: TextStyle(color: Colors.grey[600]),
                  ),
                  trailing: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '${formatter.format(item.subtotal)} DZD',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      InkWell(
                        onTap: () => ref
                            .read(cartProvider.notifier)
                            .removeItem(item.product.id),
                        child: Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            'Retirer',
                            style: TextStyle(
                              color: Colors.red[700],
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),

          // Total et bouton
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.grey[50],
              border: Border(top: BorderSide(color: Colors.grey[200]!)),
            ),
            child: SafeArea(
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Total',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        '${formatter.format(cart.total)} DZD',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: onConfirm,
                      icon: const Icon(Icons.check),
                      label: const Text('Confirmer la commande'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        textStyle: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXTENSION HELPER
// ═══════════════════════════════════════════════════════════════════════════════

extension ListExtension<T> on List<T> {
  T? firstWhereOrNull(bool Function(T) test) {
    for (final element in this) {
      if (test(element)) return element;
    }
    return null;
  }
}
