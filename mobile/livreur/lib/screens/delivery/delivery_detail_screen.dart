// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - LIVREUR - ÉCRAN DÉTAIL LIVRAISON
// Vue détaillée d'une livraison avec actions, timeline, et mode offline
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

final deliveryDetailProvider = FutureProvider.family<DeliveryDetail, String>((ref, id) async {
  // TODO: Charger depuis DB locale d'abord, puis API si en ligne
  await Future.delayed(const Duration(milliseconds: 300));
  return DeliveryDetail(
    id: id,
    orderNumber: 'CMD-2024-00$id',
    status: 'assigned',
    customerName: 'Boulangerie El-Baraka',
    customerPhone: '0555 123 456',
    customerAddress: '12 Rue des Oliviers, Bab Ezzouar, Alger',
    latitude: 36.7225,
    longitude: 3.1764,
    totalAmount: 4500,
    paidAmount: 2000,
    remainingAmount: 2500,
    items: [
      DeliveryItem(name: 'Pain Maison', quantity: 50, unit: 'pièce'),
      DeliveryItem(name: 'Baguette Tradition', quantity: 30, unit: 'pièce'),
      DeliveryItem(name: 'Croissant', quantity: 20, unit: 'pièce'),
    ],
    notes: 'Livraison avant 8h. Porte arrière du magasin.',
    requestedTime: '07:00 - 08:00',
    sequenceNumber: 3,
    totalDeliveries: 8,
    createdAt: DateTime.now().subtract(const Duration(hours: 2)),
    statusHistory: [
      StatusEntry(status: 'pending', at: DateTime.now().subtract(const Duration(hours: 2)), label: 'Commande créée'),
      StatusEntry(status: 'confirmed', at: DateTime.now().subtract(const Duration(hours: 1, minutes: 30)), label: 'Confirmée'),
      StatusEntry(status: 'assigned', at: DateTime.now().subtract(const Duration(minutes: 45)), label: 'Assignée'),
    ],
    isOfflineData: false,
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// MODELS
// ═══════════════════════════════════════════════════════════════════════════════

class DeliveryDetail {
  final String id, orderNumber, status, customerName, customerPhone, customerAddress;
  final double? latitude, longitude;
  final double totalAmount, paidAmount, remainingAmount;
  final List<DeliveryItem> items;
  final String? notes, requestedTime;
  final int sequenceNumber, totalDeliveries;
  final DateTime createdAt;
  final List<StatusEntry> statusHistory;
  final bool isOfflineData;

  DeliveryDetail({
    required this.id, required this.orderNumber, required this.status,
    required this.customerName, required this.customerPhone, required this.customerAddress,
    this.latitude, this.longitude, required this.totalAmount, required this.paidAmount,
    required this.remainingAmount, required this.items, this.notes, this.requestedTime,
    required this.sequenceNumber, required this.totalDeliveries, required this.createdAt,
    required this.statusHistory, this.isOfflineData = false,
  });
}

class DeliveryItem {
  final String name, unit;
  final int quantity;
  DeliveryItem({required this.name, required this.quantity, required this.unit});
}

class StatusEntry {
  final String status, label;
  final DateTime at;
  StatusEntry({required this.status, required this.at, required this.label});
}

// ═══════════════════════════════════════════════════════════════════════════════
// ÉCRAN
// ═══════════════════════════════════════════════════════════════════════════════

class DeliveryDetailScreen extends ConsumerWidget {
  final String deliveryId;
  const DeliveryDetailScreen({super.key, required this.deliveryId});

  static final _fmt = NumberFormat.currency(locale: 'fr_FR', symbol: 'DA', decimalDigits: 0);

  static const _statusColors = {
    'assigned': Colors.blue,
    'in_progress': Colors.orange,
    'arriving': Colors.deepPurple,
    'completed': Colors.green,
    'failed': Colors.red,
  };

  static const _statusLabels = {
    'assigned': 'Assignée',
    'in_progress': 'En cours',
    'arriving': 'Arrivée',
    'completed': 'Livrée',
    'failed': 'Échouée',
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailAsync = ref.watch(deliveryDetailProvider(deliveryId));

    return Scaffold(
      body: detailAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(child: Text('Erreur: $err')),
        data: (delivery) => _buildContent(context, ref, delivery),
      ),
    );
  }

  Widget _buildContent(BuildContext context, WidgetRef ref, DeliveryDetail d) {
    final statusColor = _statusColors[d.status] ?? Colors.grey;

    return CustomScrollView(
      slivers: [
        // App Bar
        SliverAppBar(
          pinned: true,
          expandedHeight: 120,
          backgroundColor: statusColor,
          flexibleSpace: FlexibleSpaceBar(
            title: Text(d.orderNumber, style: const TextStyle(fontSize: 16)),
            background: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [statusColor.shade700, statusColor.shade400],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
            ),
          ),
          actions: [
            if (d.isOfflineData)
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Chip(
                  avatar: const Icon(Icons.cloud_off, size: 14, color: Colors.white),
                  label: const Text('Offline', style: TextStyle(color: Colors.white, fontSize: 11)),
                  backgroundColor: Colors.grey.shade700,
                ),
              ),
          ],
        ),

        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                // Statut + séquence
                Row(
                  children: [
                    Chip(
                      label: Text(_statusLabels[d.status] ?? d.status,
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                      backgroundColor: statusColor,
                    ),
                    const Spacer(),
                    Text('Livraison ${d.sequenceNumber}/${d.totalDeliveries}',
                        style: TextStyle(color: Colors.grey[600])),
                  ],
                ),
                const SizedBox(height: 16),

                // Client
                _buildCard(
                  icon: Icons.store,
                  title: d.customerName,
                  children: [
                    _InfoTile(
                      icon: Icons.location_on,
                      text: d.customerAddress,
                      onTap: () => _openMaps(d.latitude, d.longitude, d.customerAddress),
                    ),
                    _InfoTile(
                      icon: Icons.phone,
                      text: d.customerPhone,
                      onTap: () => _callCustomer(d.customerPhone),
                    ),
                    if (d.requestedTime != null)
                      _InfoTile(icon: Icons.schedule, text: 'Créneau: ${d.requestedTime}'),
                    if (d.notes != null && d.notes!.isNotEmpty)
                      _InfoTile(icon: Icons.notes, text: d.notes!),
                  ],
                ),
                const SizedBox(height: 12),

                // Articles
                _buildCard(
                  icon: Icons.inventory_2,
                  title: 'Articles (${d.items.length})',
                  children: d.items.map((item) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        Container(
                          width: 32, height: 32,
                          decoration: BoxDecoration(
                            color: Colors.amber.shade50,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Center(child: Text('${item.quantity}',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13))),
                        ),
                        const SizedBox(width: 10),
                        Expanded(child: Text(item.name)),
                        Text(item.unit, style: TextStyle(color: Colors.grey[500], fontSize: 12)),
                      ],
                    ),
                  )).toList(),
                ),
                const SizedBox(height: 12),

                // Montants
                _buildCard(
                  icon: Icons.payments,
                  title: 'Paiement',
                  children: [
                    _AmountRow(label: 'Total commande', amount: d.totalAmount),
                    _AmountRow(label: 'Déjà payé', amount: d.paidAmount, color: Colors.green),
                    if (d.remainingAmount > 0)
                      _AmountRow(label: 'À encaisser', amount: d.remainingAmount, color: Colors.red, isBold: true),
                  ],
                ),
                const SizedBox(height: 12),

                // Timeline
                _buildCard(
                  icon: Icons.timeline,
                  title: 'Historique',
                  children: d.statusHistory.map((entry) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        Container(
                          width: 8, height: 8,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: _statusColors[entry.status] ?? Colors.grey,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(child: Text(entry.label)),
                        Text(
                          DateFormat('HH:mm').format(entry.at),
                          style: TextStyle(color: Colors.grey[500], fontSize: 12),
                        ),
                      ],
                    ),
                  )).toList(),
                ),
                const SizedBox(height: 24),

                // Boutons actions
                if (d.status == 'assigned' || d.status == 'in_progress') ...[
                  if (d.status == 'assigned')
                    SizedBox(
                      width: double.infinity, height: 50,
                      child: ElevatedButton.icon(
                        icon: const Icon(Icons.play_arrow),
                        label: const Text('Démarrer la livraison'),
                        style: ElevatedButton.styleFrom(backgroundColor: Colors.blue),
                        onPressed: () {
                          // TODO: Mettre à jour statut (online ou queue offline)
                        },
                      ),
                    ),
                  if (d.status == 'in_progress') ...[
                    SizedBox(
                      width: double.infinity, height: 50,
                      child: ElevatedButton.icon(
                        icon: const Icon(Icons.check_circle),
                        label: const Text('Livraison complétée'),
                        style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
                        onPressed: () => context.push('/delivery/$deliveryId/complete'),
                      ),
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity, height: 50,
                      child: OutlinedButton.icon(
                        icon: const Icon(Icons.cancel, color: Colors.red),
                        label: const Text('Échec de livraison', style: TextStyle(color: Colors.red)),
                        onPressed: () => _showFailDialog(context),
                      ),
                    ),
                  ],
                ],

                const SizedBox(height: 40),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCard({required IconData icon, required String title, required List<Widget> children}) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Icon(icon, size: 18, color: Colors.grey[700]),
              const SizedBox(width: 8),
              Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
            ]),
            const SizedBox(height: 10),
            ...children,
          ],
        ),
      ),
    );
  }

  void _openMaps(double? lat, double? lng, String address) async {
    final url = lat != null && lng != null
        ? 'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng'
        : 'https://www.google.com/maps/search/${Uri.encodeComponent(address)}';
    if (await canLaunchUrl(Uri.parse(url))) {
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    }
  }

  void _callCustomer(String phone) async {
    final url = 'tel:${phone.replaceAll(' ', '')}';
    if (await canLaunchUrl(Uri.parse(url))) {
      await launchUrl(Uri.parse(url));
    }
  }

  void _showFailDialog(BuildContext context) {
    String? reason;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Échec de livraison'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Pourquoi la livraison a échoué ?'),
            const SizedBox(height: 12),
            ...['Client absent', 'Adresse introuvable', 'Client refuse', 'Autre'].map(
              (r) => RadioListTile<String>(
                title: Text(r),
                value: r,
                groupValue: reason,
                onChanged: (v) => reason = v,
                dense: true,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annuler')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () {
              Navigator.pop(ctx);
              // TODO: Enqueue failure (online ou offline queue)
            },
            child: const Text('Confirmer l\'échec'),
          ),
        ],
      ),
    );
  }
}

// ─── WIDGETS HELPERS ─────────────────────────────────────────────────────────

class _InfoTile extends StatelessWidget {
  final IconData icon;
  final String text;
  final VoidCallback? onTap;
  const _InfoTile({required this.icon, required this.text, this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 16, color: onTap != null ? Colors.blue : Colors.grey[500]),
            const SizedBox(width: 8),
            Expanded(child: Text(text, style: TextStyle(
              color: onTap != null ? Colors.blue : null,
              decoration: onTap != null ? TextDecoration.underline : null,
            ))),
          ],
        ),
      ),
    );
  }
}

class _AmountRow extends StatelessWidget {
  final String label;
  final double amount;
  final Color? color;
  final bool isBold;
  const _AmountRow({required this.label, required this.amount, this.color, this.isBold = false});

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.currency(locale: 'fr_FR', symbol: 'DA', decimalDigits: 0);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: color ?? Colors.grey[700])),
          Text(fmt.format(amount), style: TextStyle(
            fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
            color: color,
            fontSize: isBold ? 16 : 14,
          )),
        ],
      ),
    );
  }
}
