// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - APP CLIENT - ÉCRAN PANIER
// Gestion du panier et passage de commande
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart';

import '../../providers/providers.dart';
import '../../providers/cart_provider.dart';
import '../../providers/customer_provider.dart';
import '../../providers/order_provider.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDERS ADDITIONNELS
// ═══════════════════════════════════════════════════════════════════════════════

final orderNotesProvider = StateProvider<String>((ref) => '');

final requestedDateProvider = StateProvider<DateTime?>((ref) => null);

final isSubmittingProvider = StateProvider<bool>((ref) => false);

// ═══════════════════════════════════════════════════════════════════════════════
// ÉCRAN PANIER
// ═══════════════════════════════════════════════════════════════════════════════

class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(cartProvider);
    final customerAsync = ref.watch(currentCustomerProvider);
    final isSubmitting = ref.watch(isSubmittingProvider);
    final formatCurrency = NumberFormat('#,###', 'fr_FR');

    final cartItems = cart.items;
    final cartTotal = cart.total;
    final itemCount = cart.totalQuantity;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mon Panier'),
        actions: [
          if (itemCount > 0)
            TextButton.icon(
              onPressed: () => _showClearConfirmation(context, ref),
              icon: const Icon(Icons.delete_outline, color: Colors.white),
              label: const Text('Vider', style: TextStyle(color: Colors.white)),
            ),
        ],
      ),
      body: cart.isEmpty
          ? const _EmptyCart()
          : Column(
              children: [
                // Alerte limite de crédit
                customerAsync.when(
                  data: (customer) {
                    final creditLimit = customer.creditLimit;
                    final currentDebt = customer.currentDebt ?? 0;
                    
                    if (creditLimit != null && creditLimit > 0) {
                      final availableCredit = creditLimit - currentDebt;
                      if ((currentDebt + cartTotal) > creditLimit) {
                        return Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(12),
                          color: Colors.red.shade50,
                          child: Row(
                            children: [
                              Icon(Icons.warning, color: Colors.red.shade700),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Cette commande dépasse votre limite de crédit disponible (${formatCurrency.format(availableCredit)} DA)',
                                  style: TextStyle(color: Colors.red.shade700),
                                ),
                              ),
                            ],
                          ),
                        );
                      }
                    }
                    return const SizedBox.shrink();
                  },
                  loading: () => const SizedBox.shrink(),
                  error: (_, __) => const SizedBox.shrink(),
                ),

                // Liste des articles
                Expanded(
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: cartItems.length,
                    separatorBuilder: (_, __) => const Divider(),
                    itemBuilder: (context, index) {
                      final item = cartItems[index];
                      return _CartItemTile(
                        item: item,
                        onQuantityChanged: (qty) {
                          ref.read(cartProvider.notifier).updateQuantity(item.productId, qty.toDouble());
                        },
                        onRemove: () {
                          ref.read(cartProvider.notifier).removeItem(item.productId);
                        },
                      );
                    },
                  ),
                ),

                // Options de commande
                const _OrderOptions(),

                // Récapitulatif et bouton
                _OrderSummary(
                  subtotal: cartTotal,
                  customerAsync: customerAsync,
                  isSubmitting: isSubmitting,
                  onSubmit: () => _submitOrder(context, ref),
                ),
              ],
            ),
    );
  }

  void _showClearConfirmation(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Vider le panier ?'),
        content: const Text('Tous les articles seront supprimés.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Annuler'),
          ),
          TextButton(
            onPressed: () {
              ref.read(cartProvider.notifier).clear();
              Navigator.pop(context);
            },
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Vider'),
          ),
        ],
      ),
    );
  }

  Future<void> _submitOrder(BuildContext context, WidgetRef ref) async {
    ref.read(isSubmittingProvider.notifier).state = true;

    try {
      // Récupérer les données
      final notes = ref.read(orderNotesProvider);
      final requestedDate = ref.read(requestedDateProvider);
      final orderNotifier = ref.read(orderProvider.notifier);

      // Créer la commande via l'API
      final newOrder = await orderNotifier.createOrder(
        deliveryDate: requestedDate,
        deliveryNotes: notes.isNotEmpty ? notes : null,
        notes: notes.isNotEmpty ? notes : null,
      );

      if (newOrder != null) {
        // Vider le panier
        ref.read(cartProvider.notifier).clear();
        ref.read(orderNotesProvider.notifier).state = '';
        ref.read(requestedDateProvider.notifier).state = null;

        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Commande #${newOrder.orderNumber} créée avec succès !'),
              backgroundColor: Colors.green,
            ),
          );
          context.go('/orders');
        }
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      ref.read(isSubmittingProvider.notifier).state = false;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PANIER VIDE
// ═══════════════════════════════════════════════════════════════════════════════

class _EmptyCart extends StatelessWidget {
  const _EmptyCart();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.shopping_cart_outlined,
              size: 80,
              color: Colors.grey[400],
            ),
            const SizedBox(height: 16),
            Text(
              'Votre panier est vide',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: Colors.grey[600],
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'Parcourez notre catalogue pour ajouter des produits',
              style: TextStyle(color: Colors.grey[500]),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () => context.go('/catalog'),
              icon: const Icon(Icons.shopping_basket),
              label: const Text('Voir le catalogue'),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ITEM DU PANIER
// ═══════════════════════════════════════════════════════════════════════════════

class _CartItemTile extends StatelessWidget {
  final dynamic item;
  final ValueChanged<int> onQuantityChanged;
  final VoidCallback onRemove;

  const _CartItemTile({
    required this.item,
    required this.onQuantityChanged,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final formatCurrency = NumberFormat('#,###', 'fr_FR');

    return Dismissible(
      key: Key(item.productId),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        color: Colors.red,
        child: const Icon(Icons.delete, color: Colors.white),
      ),
      onDismissed: (_) => onRemove(),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image produit
            Container(
              width: 60,
              height: 60,
              decoration: BoxDecoration(
                color: Colors.grey[200],
                borderRadius: BorderRadius.circular(8),
              ),
              child: item.imageUrl != null
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.network(item.imageUrl, fit: BoxFit.cover),
                    )
                  : Icon(Icons.cake, color: Colors.grey[400]),
            ),
            const SizedBox(width: 12),

            // Infos produit
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.productName,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${formatCurrency.format(item.price)} DA / ${item.unit ?? 'pièce'}',
                    style: TextStyle(
                      color: Colors.grey[600],
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 8),

                  // Contrôles quantité
                  Row(
                    children: [
                      _QuantityButton(
                        icon: item.quantity > 1 ? Icons.remove : Icons.delete_outline,
                        color: item.quantity > 1 ? Colors.grey : Colors.red,
                        onPressed: () => onQuantityChanged(item.quantity.toInt() - 1),
                      ),
                      Container(
                        constraints: const BoxConstraints(minWidth: 40),
                        alignment: Alignment.center,
                        child: Text(
                          '${item.quantity.toInt()}',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                      ),
                      _QuantityButton(
                        icon: Icons.add,
                        onPressed: () => onQuantityChanged(item.quantity.toInt() + 1),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // Total ligne
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '${formatCurrency.format(item.price * item.quantity)} DA',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Theme.of(context).primaryColor,
                  ),
                ),
                if (item.quantity > 1)
                  Text(
                    '${item.quantity.toInt()} x ${formatCurrency.format(item.price)}',
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.grey[500],
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _QuantityButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onPressed;
  final Color? color;

  const _QuantityButton({
    required this.icon,
    required this.onPressed,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.grey[200],
      borderRadius: BorderRadius.circular(4),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(4),
        child: Padding(
          padding: const EdgeInsets.all(6),
          child: Icon(icon, size: 18, color: color),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// OPTIONS DE COMMANDE
// ═══════════════════════════════════════════════════════════════════════════════

class _OrderOptions extends ConsumerWidget {
  const _OrderOptions();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notes = ref.watch(orderNotesProvider);
    final requestedDate = ref.watch(requestedDateProvider);

    return Card(
      margin: const EdgeInsets.all(16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Date de livraison souhaitée
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.calendar_today),
              title: const Text('Date de livraison souhaitée'),
              subtitle: Text(
                requestedDate != null
                    ? DateFormat('EEEE d MMMM', 'fr_FR').format(requestedDate)
                    : 'Dès que possible',
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: () async {
                final date = await showDatePicker(
                  context: context,
                  initialDate: requestedDate ?? DateTime.now().add(const Duration(days: 1)),
                  firstDate: DateTime.now(),
                  lastDate: DateTime.now().add(const Duration(days: 30)),
                  locale: const Locale('fr'),
                );
                if (date != null) {
                  ref.read(requestedDateProvider.notifier).state = date;
                }
              },
            ),

            const Divider(),

            // Notes
            TextField(
              decoration: const InputDecoration(
                labelText: 'Notes pour la commande',
                hintText: 'Instructions spéciales, remarques...',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.note_add),
              ),
              maxLines: 2,
              controller: TextEditingController(text: notes),
              onChanged: (value) {
                ref.read(orderNotesProvider.notifier).state = value;
              },
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RÉCAPITULATIF COMMANDE
// ═══════════════════════════════════════════════════════════════════════════════

class _OrderSummary extends StatelessWidget {
  final double subtotal;
  final AsyncValue<dynamic> customerAsync;
  final bool isSubmitting;
  final VoidCallback onSubmit;

  const _OrderSummary({
    required this.subtotal,
    required this.customerAsync,
    required this.isSubmitting,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    final formatCurrency = NumberFormat('#,###', 'fr_FR');
    
    // Pour simplifier, pas de frais de livraison dans cette version
    const deliveryFee = 0.0;
    final total = subtotal + deliveryFee;

    final canSubmit = customerAsync.when(
      data: (customer) {
        final creditLimit = customer.creditLimit;
        final currentDebt = customer.currentDebt ?? 0;
        if (creditLimit != null && creditLimit > 0) {
          return (currentDebt + total) <= creditLimit;
        }
        return true;
      },
      loading: () => false,
      error: (_, __) => true,
    );

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.grey.shade300,
            blurRadius: 10,
            offset: const Offset(0, -5),
          ),
        ],
      ),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Détails
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Sous-total'),
                Text('${formatCurrency.format(subtotal)} DA'),
              ],
            ),
            if (deliveryFee > 0) ...[
              const SizedBox(height: 4),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Livraison'),
                  Text('${formatCurrency.format(deliveryFee)} DA'),
                ],
              ),
            ],
            const Divider(height: 24),

            // Total
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Total',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 18,
                  ),
                ),
                Text(
                  '${formatCurrency.format(total)} DA',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 18,
                    color: Theme.of(context).primaryColor,
                  ),
                ),
              ],
            ),

            // Info crédit
            customerAsync.when(
              data: (customer) {
                final creditLimit = customer.creditLimit;
                final currentDebt = customer.currentDebt ?? 0;
                
                if (creditLimit != null && creditLimit > 0) {
                  final availableCredit = creditLimit - currentDebt;
                  final isOverLimit = (currentDebt + total) > creditLimit;
                  
                  return Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Crédit disponible',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey[600],
                          ),
                        ),
                        Text(
                          '${formatCurrency.format(availableCredit)} DA',
                          style: TextStyle(
                            fontSize: 12,
                            color: isOverLimit ? Colors.red : Colors.green,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  );
                }
                return const SizedBox.shrink();
              },
              loading: () => const SizedBox.shrink(),
              error: (_, __) => const SizedBox.shrink(),
            ),

            const SizedBox(height: 16),

            // Bouton commander
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: canSubmit && !isSubmitting ? onSubmit : null,
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  backgroundColor: Theme.of(context).primaryColor,
                  foregroundColor: Colors.white,
                ),
                child: isSubmitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text(
                        'COMMANDER',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
              ),
            ),

            if (!canSubmit)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  'Limite de crédit dépassée',
                  style: TextStyle(
                    color: Colors.red[700],
                    fontSize: 12,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
