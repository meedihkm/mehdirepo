// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - APP CLIENT - ÉCRAN CHECKOUT
// Validation et envoi de la commande
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════

final checkoutLoadingProvider = StateProvider<bool>((ref) => false);
final deliveryDateProvider = StateProvider<DateTime?>((ref) => null);
final checkoutNotesProvider = StateProvider<String>((ref) => '');

// ═══════════════════════════════════════════════════════════════════════════════
// ÉCRAN CHECKOUT
// ═══════════════════════════════════════════════════════════════════════════════

class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key});

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  final _notesController = TextEditingController();
  final _currencyFormat = NumberFormat.currency(locale: 'fr_FR', symbol: 'DA', decimalDigits: 0);

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _selectDeliveryDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: now.add(const Duration(days: 1)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 30)),
      locale: const Locale('fr', 'FR'),
    );
    if (picked != null) {
      ref.read(deliveryDateProvider.notifier).state = picked;
    }
  }

  Future<void> _submitOrder() async {
    ref.read(checkoutLoadingProvider.notifier).state = true;

    try {
      // TODO: Appel API POST /customer-api/orders
      await Future.delayed(const Duration(seconds: 2)); // Simulation

      if (mounted) {
        // Vider le panier
        // ref.read(cartProvider.notifier).clear();

        // Afficher confirmation
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (ctx) => AlertDialog(
            icon: const Icon(Icons.check_circle, color: Colors.green, size: 64),
            title: const Text('Commande envoyée !'),
            content: const Text(
              'Votre commande a été enregistrée avec succès. '
              'Vous recevrez une notification de confirmation.',
            ),
            actions: [
              ElevatedButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  context.go('/orders');
                },
                child: const Text('Voir mes commandes'),
              ),
            ],
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      ref.read(checkoutLoadingProvider.notifier).state = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(checkoutLoadingProvider);
    final deliveryDate = ref.watch(deliveryDateProvider);

    // TODO: Lire le vrai panier depuis cartProvider
    final cartItems = [
      _CheckoutItem(name: 'Pain Maison', quantity: 20, unitPrice: 50),
      _CheckoutItem(name: 'Baguette', quantity: 30, unitPrice: 30),
      _CheckoutItem(name: 'Croissant', quantity: 10, unitPrice: 40),
    ];

    final subtotal = cartItems.fold<double>(0, (sum, item) => sum + item.total);
    const deliveryFee = 200.0;
    final total = subtotal + deliveryFee;

    return Scaffold(
      appBar: AppBar(title: const Text('Confirmer la commande')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Récapitulatif articles
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Articles', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      TextButton(
                        onPressed: () => context.pop(),
                        child: const Text('Modifier'),
                      ),
                    ],
                  ),
                  const Divider(),
                  ...cartItems.map((item) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      children: [
                        Container(
                          width: 28, height: 28,
                          decoration: BoxDecoration(
                            color: Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Center(
                            child: Text('${item.quantity}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(child: Text(item.name)),
                        Text(_currencyFormat.format(item.total), style: const TextStyle(fontWeight: FontWeight.w500)),
                      ],
                    ),
                  )),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Date de livraison
          Card(
            child: ListTile(
              leading: const Icon(Icons.calendar_today),
              title: const Text('Date de livraison souhaitée'),
              subtitle: Text(
                deliveryDate != null
                    ? DateFormat('EEEE dd MMMM yyyy', 'fr_FR').format(deliveryDate)
                    : 'Non spécifiée (dès que possible)',
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: _selectDeliveryDate,
            ),
          ),
          const SizedBox(height: 12),

          // Notes
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Notes (optionnel)', style: TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _notesController,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      hintText: 'Instructions spéciales, horaires de livraison...',
                      border: OutlineInputBorder(),
                    ),
                    onChanged: (v) => ref.read(checkoutNotesProvider.notifier).state = v,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Totaux
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  _PriceRow(label: 'Sous-total', value: _currencyFormat.format(subtotal)),
                  _PriceRow(label: 'Frais de livraison', value: _currencyFormat.format(deliveryFee)),
                  const Divider(height: 20),
                  _PriceRow(
                    label: 'Total',
                    value: _currencyFormat.format(total),
                    isBold: true,
                    fontSize: 20,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),

          // Info crédit
          Card(
            color: Colors.blue.shade50,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Icon(Icons.info_outline, color: Colors.blue.shade700, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Le montant sera ajouté à votre compte. Règlement lors de la livraison ou par virement.',
                      style: TextStyle(fontSize: 12, color: Colors.blue.shade700),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Bouton confirmer
          SizedBox(
            height: 54,
            child: ElevatedButton(
              onPressed: isLoading ? null : _submitOrder,
              style: ElevatedButton.styleFrom(
                backgroundColor: Theme.of(context).primaryColor,
                foregroundColor: Colors.white,
              ),
              child: isLoading
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.check),
                        const SizedBox(width: 8),
                        Text('Confirmer la commande — ${_currencyFormat.format(total)}'),
                      ],
                    ),
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

class _CheckoutItem {
  final String name;
  final int quantity;
  final double unitPrice;
  _CheckoutItem({required this.name, required this.quantity, required this.unitPrice});
  double get total => quantity * unitPrice;
}

class _PriceRow extends StatelessWidget {
  final String label, value;
  final bool isBold;
  final double? fontSize;

  const _PriceRow({required this.label, required this.value, this.isBold = false, this.fontSize});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(
            fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
            color: isBold ? null : Colors.grey[700],
            fontSize: fontSize,
          )),
          Text(value, style: TextStyle(
            fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
            fontSize: fontSize,
          )),
        ],
      ),
    );
  }
}
