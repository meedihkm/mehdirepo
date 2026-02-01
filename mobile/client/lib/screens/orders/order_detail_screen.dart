// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - APP CLIENT - ÉCRAN DÉTAIL COMMANDE
// Affichage détaillé d'une commande avec suivi
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════

final orderDetailProvider = FutureProvider.family<OrderDetailModel, String>((ref, orderId) async {
  // TODO: Appel API GET /customer-api/orders/:id
  await Future.delayed(const Duration(milliseconds: 500));
  return OrderDetailModel(
    id: orderId,
    orderNumber: 'CMD-2024-00$orderId',
    status: 'delivering',
    createdAt: DateTime.now().subtract(const Duration(hours: 3)),
    totalAmount: 2500,
    paidAmount: 2000,
    deliveryFee: 200,
    discount: 0,
    subtotal: 2300,
    requestedDeliveryDate: DateTime.now(),
    items: [
      OrderItemModel(name: 'Pain Maison', quantity: 20, unitPrice: 50, lineTotal: 1000),
      OrderItemModel(name: 'Baguette', quantity: 30, unitPrice: 30, lineTotal: 900),
      OrderItemModel(name: 'Croissant', quantity: 10, unitPrice: 40, lineTotal: 400),
    ],
    statusHistory: [
      StatusChange(status: 'pending', changedAt: DateTime.now().subtract(const Duration(hours: 3)), label: 'En attente'),
      StatusChange(status: 'confirmed', changedAt: DateTime.now().subtract(const Duration(hours: 2)), label: 'Confirmée'),
      StatusChange(status: 'preparing', changedAt: DateTime.now().subtract(const Duration(hours: 1, minutes: 30)), label: 'En préparation'),
      StatusChange(status: 'ready', changedAt: DateTime.now().subtract(const Duration(minutes: 45)), label: 'Prête'),
      StatusChange(status: 'inDelivery', changedAt: DateTime.now().subtract(const Duration(minutes: 15)), label: 'En livraison'),
    ],
    deliverer: DelivererInfo(name: 'Ahmed B.', phone: '0555 123 456'),
    notes: null,
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// MODELS
// ═══════════════════════════════════════════════════════════════════════════════

class OrderDetailModel {
  final String id, orderNumber, status;
  final DateTime createdAt;
  final double totalAmount, paidAmount, deliveryFee, discount, subtotal;
  final DateTime? requestedDeliveryDate;
  final List<OrderItemModel> items;
  final List<StatusChange> statusHistory;
  final DelivererInfo? deliverer;
  final String? notes;

  OrderDetailModel({
    required this.id, required this.orderNumber, required this.status,
    required this.createdAt, required this.totalAmount, required this.paidAmount,
    required this.deliveryFee, required this.discount, required this.subtotal,
    this.requestedDeliveryDate, required this.items, required this.statusHistory,
    this.deliverer, this.notes,
  });

  double get remainingAmount => totalAmount - paidAmount;
}

class OrderItemModel {
  final String name;
  final int quantity;
  final double unitPrice, lineTotal;
  OrderItemModel({required this.name, required this.quantity, required this.unitPrice, required this.lineTotal});
}

class StatusChange {
  final String status, label;
  final DateTime changedAt;
  StatusChange({required this.status, required this.changedAt, required this.label});
}

class DelivererInfo {
  final String name, phone;
  DelivererInfo({required this.name, required this.phone});
}

// ═══════════════════════════════════════════════════════════════════════════════
// ÉCRAN
// ═══════════════════════════════════════════════════════════════════════════════

class OrderDetailScreen extends ConsumerWidget {
  final String orderId;
  const OrderDetailScreen({super.key, required this.orderId});

  static final _fmt = NumberFormat.currency(locale: 'fr_FR', symbol: 'DA', decimalDigits: 0);
  static final _dateFmt = DateFormat('dd/MM/yyyy HH:mm', 'fr_FR');

  static const _statusConfig = {
    'pending':    {'label': 'En attente',      'color': Colors.orange, 'icon': Icons.hourglass_empty},
    'confirmed':  {'label': 'Confirmée',       'color': Colors.blue,   'icon': Icons.check},
    'preparing':  {'label': 'En préparation',  'color': Colors.purple, 'icon': Icons.restaurant},
    'ready':      {'label': 'Prête',           'color': Colors.teal,   'icon': Icons.inventory},
    'inDelivery': {'label': 'En livraison',    'color': Colors.indigo, 'icon': Icons.local_shipping},
    'delivered':  {'label': 'Livrée',          'color': Colors.green,  'icon': Icons.check_circle},
    'cancelled':  {'label': 'Annulée',         'color': Colors.red,    'icon': Icons.cancel},
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orderAsync = ref.watch(orderDetailProvider(orderId));

    return Scaffold(
      appBar: AppBar(title: const Text('Détail commande')),
      body: orderAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(child: Text('Erreur: $err')),
        data: (order) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(orderDetailProvider(orderId)),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Header
              _buildHeader(context, order),
              const SizedBox(height: 16),

              // Timeline statut
              _buildStatusTimeline(context, order),
              const SizedBox(height: 16),

              // Livreur
              if (order.deliverer != null && ['inDelivery', 'ready'].contains(order.status))
                _buildDelivererCard(context, order.deliverer!),

              // Articles
              _buildItemsCard(context, order),
              const SizedBox(height: 16),

              // Totaux
              _buildTotalsCard(context, order),
              const SizedBox(height: 16),

              // Actions
              if (order.status == 'pending' || order.status == 'confirmed')
                _buildActionsCard(context, order, ref),

              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, OrderDetailModel order) {
    final config = _statusConfig[order.status] ?? _statusConfig['pending']!;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(order.orderNumber, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                Chip(
                  avatar: Icon(config['icon'] as IconData, size: 16, color: Colors.white),
                  label: Text(config['label'] as String, style: const TextStyle(color: Colors.white, fontSize: 12)),
                  backgroundColor: config['color'] as Color,
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text('Passée le ${_dateFmt.format(order.createdAt)}', style: TextStyle(color: Colors.grey[600])),
            if (order.requestedDeliveryDate != null) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  Icon(Icons.calendar_today, size: 14, color: Colors.grey[500]),
                  const SizedBox(width: 4),
                  Text('Livraison souhaitée: ${DateFormat('dd/MM/yyyy').format(order.requestedDeliveryDate!)}',
                      style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStatusTimeline(BuildContext context, OrderDetailModel order) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Suivi', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            ...order.statusHistory.asMap().entries.map((entry) {
              final i = entry.key;
              final step = entry.value;
              final isLast = i == order.statusHistory.length - 1;
              final config = _statusConfig[step.status] ?? _statusConfig['pending']!;

              return IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Timeline dot + line
                    SizedBox(
                      width: 30,
                      child: Column(
                        children: [
                          Container(
                            width: 12, height: 12,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: isLast ? (config['color'] as Color) : Colors.grey[400],
                            ),
                          ),
                          if (!isLast) Expanded(child: Container(width: 2, color: Colors.grey[300])),
                        ],
                      ),
                    ),
                    // Content
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(step.label, style: TextStyle(
                              fontWeight: isLast ? FontWeight.bold : FontWeight.normal,
                              color: isLast ? (config['color'] as Color) : Colors.grey[700],
                            )),
                            Text(
                              _dateFmt.format(step.changedAt),
                              style: TextStyle(fontSize: 12, color: Colors.grey[500]),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }

  Widget _buildDelivererCard(BuildContext context, DelivererInfo deliverer) {
    return Card(
      color: Colors.blue.shade50,
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: Colors.blue,
          child: const Icon(Icons.local_shipping, color: Colors.white, size: 20),
        ),
        title: Text(deliverer.name, style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Text(deliverer.phone),
        trailing: IconButton(
          icon: const Icon(Icons.phone, color: Colors.blue),
          onPressed: () {
            // TODO: Appeler le livreur
          },
        ),
      ),
    );
  }

  Widget _buildItemsCard(BuildContext context, OrderDetailModel order) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Articles (${order.items.length})', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            ...order.items.map((item) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  Container(
                    width: 36, height: 36,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Center(child: Text('${item.quantity}', style: const TextStyle(fontWeight: FontWeight.bold))),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(item.name, style: const TextStyle(fontWeight: FontWeight.w500)),
                        Text('${_fmt.format(item.unitPrice)} /unité', style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                      ],
                    ),
                  ),
                  Text(_fmt.format(item.lineTotal), style: const TextStyle(fontWeight: FontWeight.bold)),
                ],
              ),
            )),
          ],
        ),
      ),
    );
  }

  Widget _buildTotalsCard(BuildContext context, OrderDetailModel order) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            _TotalRow(label: 'Sous-total', value: _fmt.format(order.subtotal)),
            if (order.discount > 0)
              _TotalRow(label: 'Remise', value: '-${_fmt.format(order.discount)}', color: Colors.orange),
            if (order.deliveryFee > 0)
              _TotalRow(label: 'Livraison', value: _fmt.format(order.deliveryFee)),
            const Divider(),
            _TotalRow(label: 'Total', value: _fmt.format(order.totalAmount), isBold: true, fontSize: 18),
            _TotalRow(label: 'Payé', value: _fmt.format(order.paidAmount), color: Colors.green),
            if (order.remainingAmount > 0)
              _TotalRow(label: 'Reste à payer', value: _fmt.format(order.remainingAmount), color: Colors.red, isBold: true),
          ],
        ),
      ),
    );
  }

  Widget _buildActionsCard(BuildContext context, OrderDetailModel order, WidgetRef ref) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                icon: const Icon(Icons.replay),
                label: const Text('Recommander'),
                onPressed: () {
                  // TODO: Dupliquer la commande dans le panier
                },
              ),
            ),
            const SizedBox(height: 8),
            if (order.status == 'pending')
              SizedBox(
                width: double.infinity,
                child: TextButton.icon(
                  icon: const Icon(Icons.cancel_outlined, color: Colors.red),
                  label: const Text('Annuler la commande', style: TextStyle(color: Colors.red)),
                  onPressed: () => _showCancelDialog(context, order, ref),
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _showCancelDialog(BuildContext context, OrderDetailModel order, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Annuler la commande ?'),
        content: const Text('Cette action est irréversible.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Non')),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              // TODO: Appel API POST /customer-api/orders/:id/cancel
              ref.invalidate(orderDetailProvider(orderId));
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Commande annulée')),
              );
            },
            child: const Text('Oui, annuler', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }
}

class _TotalRow extends StatelessWidget {
  final String label, value;
  final bool isBold;
  final Color? color;
  final double? fontSize;

  const _TotalRow({required this.label, required this.value, this.isBold = false, this.color, this.fontSize});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(
            fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
            color: color ?? Colors.grey[700],
            fontSize: fontSize,
          )),
          Text(value, style: TextStyle(
            fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
            color: color,
            fontSize: fontSize,
          )),
        ],
      ),
    );
  }
}
