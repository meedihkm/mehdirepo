// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - APP CLIENT - ÉCRAN HISTORIQUE DES COMMANDES
// Liste et détails des commandes passées
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart';

import '../../models/models.dart';
import '../../providers/providers.dart';
import '../../providers/order_provider.dart';
import 'order_detail_screen.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════

final ordersScreenProvider = FutureProvider.family<List<Order>, OrderFilter>((ref, filter) async {
  final api = ref.read(apiServiceProvider);
  final response = await api.getOrders(
    status: filter.status,
    startDate: filter.startDate,
    endDate: filter.endDate,
  );

  if (response.success && response.data != null) {
    return response.data!;
  }

  throw Exception(response.errorMessage ?? 'Erreur de chargement');
});

final selectedOrderScreenProvider = StateProvider<Order?>((ref) => null);

class OrderFilter {
  final OrderStatus? status;
  final DateTime? startDate;
  final DateTime? endDate;

  OrderFilter({this.status, this.startDate, this.endDate});
}

final orderFilterScreenProvider = StateProvider<OrderFilter>((ref) => OrderFilter());

// ═══════════════════════════════════════════════════════════════════════════════
// ÉCRAN LISTE DES COMMANDES
// ═══════════════════════════════════════════════════════════════════════════════

class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filter = ref.watch(orderFilterScreenProvider);
    final ordersAsync = ref.watch(ordersScreenProvider(filter));
    final formatCurrency = NumberFormat('#,###', 'fr_FR');

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mes Commandes'),
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: () => _showFilterSheet(context, ref),
          ),
        ],
      ),
      body: ordersAsync.when(
        data: (orders) {
          if (orders.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.receipt_long, size: 64, color: Colors.grey[400]),
                  const SizedBox(height: 16),
                  Text(
                    'Aucune commande',
                    style: TextStyle(fontSize: 18, color: Colors.grey[600]),
                  ),
                  const SizedBox(height: 8),
                  ElevatedButton(
                    onPressed: () => context.go('/catalog'),
                    child: const Text('Passer une commande'),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(ordersScreenProvider(filter));
            },
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: orders.length,
              itemBuilder: (context, index) {
                final order = orders[index];
                return _OrderCard(
                  order: order,
                  onTap: () {
                    ref.read(selectedOrderScreenProvider.notifier).state = order;
                    context.push('/orders/${order.id}');
                  },
                );
              },
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.red),
              const SizedBox(height: 16),
              Text('Erreur: $e'),
              const SizedBox(height: 8),
              ElevatedButton(
                onPressed: () => ref.invalidate(ordersScreenProvider(filter)),
                child: const Text('Réessayer'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showFilterSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      builder: (context) => const _FilterSheet(),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARTE COMMANDE
// ═══════════════════════════════════════════════════════════════════════════════

class _OrderCard extends StatelessWidget {
  final Order order;
  final VoidCallback onTap;

  const _OrderCard({
    required this.order,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final formatCurrency = NumberFormat('#,###', 'fr_FR');
    final formatDate = DateFormat('dd/MM/yyyy HH:mm', 'fr_FR');

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // En-tête
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    order.orderNumber,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                  _StatusChip(status: order.status),
                ],
              ),
              const SizedBox(height: 12),

              // Détails
              Row(
                children: [
                  Icon(Icons.calendar_today, size: 16, color: Colors.grey[600]),
                  const SizedBox(width: 4),
                  Text(
                    formatDate.format(order.createdAt),
                    style: TextStyle(color: Colors.grey[600], fontSize: 13),
                  ),
                  const SizedBox(width: 16),
                  Icon(Icons.shopping_bag, size: 16, color: Colors.grey[600]),
                  const SizedBox(width: 4),
                  Text(
                    '${order.itemCount} article${order.itemCount > 1 ? 's' : ''}',
                    style: TextStyle(color: Colors.grey[600], fontSize: 13),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Montants
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Total',
                        style: TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                      Text(
                        '${formatCurrency.format(order.totalAmount)} DA',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 18,
                        ),
                      ),
                    ],
                  ),
                  if (!order.isPaid && order.status != OrderStatus.cancelled)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.orange.shade50,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.warning_amber, size: 16, color: Colors.orange.shade700),
                          const SizedBox(width: 4),
                          Text(
                            'Reste: ${formatCurrency.format(order.remainingAmount)} DA',
                            style: TextStyle(
                              color: Colors.orange.shade700,
                              fontWeight: FontWeight.w500,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),

              // Barre de progression pour livraison
              if (order.status == OrderStatus.inDelivery) ...[
                const SizedBox(height: 12),
                const _DeliveryProgress(),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHIP STATUT
// ═══════════════════════════════════════════════════════════════════════════════

class _StatusChip extends StatelessWidget {
  final OrderStatus status;

  const _StatusChip({required this.status});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: status.color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(status.icon, size: 14, color: status.color),
          const SizedBox(width: 4),
          Text(
            status.label,
            style: TextStyle(
              color: status.color,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESSION LIVRAISON
// ═══════════════════════════════════════════════════════════════════════════════

class _DeliveryProgress extends StatelessWidget {
  const _DeliveryProgress();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.local_shipping, size: 16, color: Colors.indigo),
            const SizedBox(width: 8),
            const Text(
              'Votre commande est en route',
              style: TextStyle(
                fontWeight: FontWeight.w500,
                color: Colors.indigo,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: 0.7,
            backgroundColor: Colors.grey[200],
            valueColor: const AlwaysStoppedAnimation<Color>(Colors.indigo),
          ),
        ),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILTRE
// ═══════════════════════════════════════════════════════════════════════════════

class _FilterSheet extends ConsumerWidget {
  const _FilterSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filter = ref.watch(orderFilterScreenProvider);

    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Filtrer par statut',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _FilterChip(
                label: 'Tous',
                selected: filter.status == null,
                onSelected: () {
                  ref.read(orderFilterScreenProvider.notifier).state = OrderFilter();
                  Navigator.pop(context);
                },
              ),
              ...OrderStatus.values.map((status) => _FilterChip(
                label: _getStatusLabel(status),
                selected: filter.status == status,
                color: _getStatusColor(status),
                onSelected: () {
                  ref.read(orderFilterScreenProvider.notifier).state = 
                    OrderFilter(status: status);
                  Navigator.pop(context);
                },
              )),
            ],
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final Color? color;
  final VoidCallback onSelected;

  const _FilterChip({
    required this.label,
    required this.selected,
    this.color,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    return FilterChip(
      label: Text(label),
      selected: selected,
      selectedColor: (color ?? Theme.of(context).primaryColor).withOpacity(0.2),
      checkmarkColor: color ?? Theme.of(context).primaryColor,
      onSelected: (_) => onSelected(),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

String _getStatusLabel(OrderStatus status) {
  switch (status) {
    case OrderStatus.draft: return 'Brouillon';
    case OrderStatus.pending: return 'En attente';
    case OrderStatus.confirmed: return 'Confirmée';
    case OrderStatus.preparing: return 'En préparation';
    case OrderStatus.ready: return 'Prête';
    case OrderStatus.assigned: return 'Assignée';
    case OrderStatus.inDelivery: return 'En livraison';
    case OrderStatus.delivered: return 'Livrée';
    case OrderStatus.cancelled: return 'Annulée';
  }
}

Color _getStatusColor(OrderStatus status) {
  switch (status) {
    case OrderStatus.draft: return Colors.grey;
    case OrderStatus.pending: return Colors.orange;
    case OrderStatus.confirmed: return Colors.blue;
    case OrderStatus.preparing: return Colors.purple;
    case OrderStatus.ready: return Colors.teal;
    case OrderStatus.assigned: return Colors.indigo;
    case OrderStatus.inDelivery: return Colors.indigo;
    case OrderStatus.delivered: return Colors.green;
    case OrderStatus.cancelled: return Colors.red;
  }
}

class _SummaryRow extends StatelessWidget {
  final String label;
  final String value;
  final bool isBold;
  final Color? valueColor;

  const _SummaryRow({
    required this.label,
    required this.value,
    this.isBold = false,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
            color: valueColor,
          ),
        ),
      ],
    );
  }
}
