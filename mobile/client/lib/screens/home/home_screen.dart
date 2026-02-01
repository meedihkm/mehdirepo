// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - APPLICATION CLIENT
// Écran d'accueil avec commande rapide
// lib/screens/home/home_screen.dart
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../providers/customer_provider.dart';
import '../../providers/order_provider.dart';
import '../../models/models.dart';
import '../../theme/app_colors.dart';
import '../../widgets/debt_card.dart';
import '../../widgets/quick_order_card.dart';
import '../../widgets/order_status_card.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final customerAsync = ref.watch(currentCustomerProvider);
    final recentOrders = ref.watch(recentOrdersProvider);
    final ordersInProgress = ref.watch(ordersInProgressProvider);
    final formatter = NumberFormat('#,###', 'fr_FR');

    return Scaffold(
      backgroundColor: AppColors.background,
      body: customerAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.red),
              const SizedBox(height: 16),
              Text('Erreur: $e'),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => ref.refresh(currentCustomerProvider),
                child: const Text('Réessayer'),
              ),
            ],
          ),
        ),
        data: (customer) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(currentCustomerProvider);
            ref.invalidate(recentOrdersProvider);
            ref.invalidate(ordersInProgressProvider);
          },
          child: CustomScrollView(
            slivers: [
              // ═══════════════════════════════════════════════════════════════
              // APP BAR AVEC SALUTATION
              // ═══════════════════════════════════════════════════════════════
              SliverAppBar(
                expandedHeight: 140,
                pinned: true,
                backgroundColor: AppColors.primary,
                flexibleSpace: FlexibleSpaceBar(
                  background: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [AppColors.primary, AppColors.primaryDark],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                    ),
                    child: SafeArea(
                      child: Padding(
                        padding: const EdgeInsets.all(20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            Text(
                              _getGreeting(),
                              style: const TextStyle(
                                color: Colors.white70,
                                fontSize: 14,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              customer.name,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                actions: [
                  IconButton(
                    icon: const Icon(Icons.notifications_outlined, color: Colors.white),
                    onPressed: () => context.push('/notifications'),
                  ),
                  IconButton(
                    icon: const Icon(Icons.person_outline, color: Colors.white),
                    onPressed: () => context.push('/account'),
                  ),
                ],
              ),

              // ═══════════════════════════════════════════════════════════════
              // CONTENU
              // ═══════════════════════════════════════════════════════════════
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // ─────────────────────────────────────────────────────────
                      // CARTE DE DETTE
                      // ─────────────────────────────────────────────────────────
                      DebtCard(
                        currentDebt: customer.currentDebt ?? 0,
                        creditLimit: customer.creditLimit,
                        onTap: () => context.push('/financial-situation'),
                      ),

                      const SizedBox(height: 24),

                      // ─────────────────────────────────────────────────────────
                      // COMMANDES EN COURS
                      // ─────────────────────────────────────────────────────────
                      ordersInProgress.when(
                        loading: () => const SizedBox.shrink(),
                        error: (_, __) => const SizedBox.shrink(),
                        data: (orders) => orders.isEmpty
                            ? const SizedBox.shrink()
                            : Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  _buildSectionTitle('En cours', Icons.local_shipping),
                                  const SizedBox(height: 12),
                                  ...orders.map((order) => Padding(
                                    padding: const EdgeInsets.only(bottom: 12),
                                    child: OrderStatusCard(
                                      order: order,
                                      onTap: () => context.push('/orders/${order.id}'),
                                    ),
                                  )),
                                  const SizedBox(height: 16),
                                ],
                              ),
                      ),

                      // ─────────────────────────────────────────────────────────
                      // BOUTON NOUVELLE COMMANDE
                      // ─────────────────────────────────────────────────────────
                      _buildNewOrderButton(context),

                      const SizedBox(height: 24),

                      // ─────────────────────────────────────────────────────────
                      // COMMANDER À NOUVEAU (dernière commande)
                      // ─────────────────────────────────────────────────────────
                      recentOrders.when(
                        loading: () => const SizedBox.shrink(),
                        error: (_, __) => const SizedBox.shrink(),
                        data: (orders) => orders.isEmpty
                            ? const SizedBox.shrink()
                            : Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  _buildSectionTitle('Commander à nouveau', Icons.replay),
                                  const SizedBox(height: 12),
                                  QuickOrderCard(
                                    order: orders.first,
                                    onReorder: () => _reorder(context, ref, orders.first),
                                  ),
                                  const SizedBox(height: 24),
                                ],
                              ),
                      ),

                      // ─────────────────────────────────────────────────────────
                      // HISTORIQUE RÉCENT
                      // ─────────────────────────────────────────────────────────
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          _buildSectionTitle('Historique', Icons.history),
                          TextButton(
                            onPressed: () => context.push('/orders'),
                            child: const Text('Tout voir'),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      recentOrders.when(
                        loading: () => const Center(child: CircularProgressIndicator()),
                        error: (e, _) => Text('Erreur: $e'),
                        data: (orders) => orders.isEmpty
                            ? _buildEmptyHistory()
                            : Column(
                                children: orders.take(5).map((order) => _buildHistoryItem(
                                  context,
                                  order,
                                  formatter,
                                )).toList(),
                              ),
                      ),

                      const SizedBox(height: 80), // Espace pour FAB
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      // ═══════════════════════════════════════════════════════════════════════
      // FAB NOUVELLE COMMANDE
      // ═══════════════════════════════════════════════════════════════════════
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/new-order'),
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.add_shopping_cart),
        label: const Text('Commander'),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  }

  Widget _buildSectionTitle(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, size: 20, color: AppColors.textSecondary),
        const SizedBox(width: 8),
        Text(
          title,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }

  Widget _buildNewOrderButton(BuildContext context) {
    return InkWell(
      onTap: () => context.push('/new-order'),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [AppColors.primary, AppColors.primaryDark],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withOpacity(0.3),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(
                Icons.add_shopping_cart,
                color: Colors.white,
                size: 28,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  Text(
                    'Nouvelle commande',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Parcourir le catalogue',
                    style: TextStyle(
                      color: Colors.white70,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.arrow_forward_ios,
              color: Colors.white70,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHistoryItem(BuildContext context, Order order, NumberFormat formatter) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        onTap: () => context.push('/orders/${order.id}'),
        leading: CircleAvatar(
          backgroundColor: _getStatusColor(order.status).withOpacity(0.1),
          child: Icon(
            _getStatusIcon(order.status),
            color: _getStatusColor(order.status),
            size: 20,
          ),
        ),
        title: Text(
          order.orderNumber,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Text(
          DateFormat('dd/MM/yyyy').format(order.createdAt),
          style: TextStyle(color: Colors.grey[600], fontSize: 12),
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              '${formatter.format(order.total)} DZD',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: _getStatusColor(order.status).withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                _getStatusLabel(order.status),
                style: TextStyle(
                  color: _getStatusColor(order.status),
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyHistory() {
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: Colors.grey[100],
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Icon(Icons.receipt_long_outlined, size: 48, color: Colors.grey[400]),
          const SizedBox(height: 12),
          Text(
            'Aucune commande',
            style: TextStyle(
              color: Colors.grey[600],
              fontSize: 16,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Passez votre première commande !',
            style: TextStyle(color: Colors.grey[500], fontSize: 14),
          ),
        ],
      ),
    );
  }

  Color _getStatusColor(OrderStatus status) {
    switch (status) {
      case OrderStatus.pending:
      case OrderStatus.confirmed:
        return Colors.orange;
      case OrderStatus.preparing:
      case OrderStatus.ready:
        return Colors.blue;
      case OrderStatus.assigned:
      case OrderStatus.inDelivery:
        return Colors.purple;
      case OrderStatus.delivered:
        return Colors.green;
      case OrderStatus.cancelled:
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  IconData _getStatusIcon(OrderStatus status) {
    switch (status) {
      case OrderStatus.pending:
        return Icons.schedule;
      case OrderStatus.confirmed:
        return Icons.check_circle_outline;
      case OrderStatus.preparing:
        return Icons.restaurant;
      case OrderStatus.ready:
        return Icons.inventory_2;
      case OrderStatus.assigned:
      case OrderStatus.inDelivery:
        return Icons.local_shipping;
      case OrderStatus.delivered:
        return Icons.check_circle;
      case OrderStatus.cancelled:
        return Icons.cancel;
      default:
        return Icons.receipt;
    }
  }

  String _getStatusLabel(OrderStatus status) {
    switch (status) {
      case OrderStatus.pending:
        return 'En attente';
      case OrderStatus.confirmed:
        return 'Confirmée';
      case OrderStatus.preparing:
        return 'En préparation';
      case OrderStatus.ready:
        return 'Prête';
      case OrderStatus.assigned:
        return 'Assignée';
      case OrderStatus.inDelivery:
        return 'En livraison';
      case OrderStatus.delivered:
        return 'Livrée';
      case OrderStatus.cancelled:
        return 'Annulée';
      default:
        return 'Inconnu';
    }
  }

  Future<void> _reorder(BuildContext context, WidgetRef ref, Order order) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Commander à nouveau ?'),
        content: Text(
          'Créer une nouvelle commande avec les mêmes articles que ${order.orderNumber} ?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Annuler'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Commander'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        final newOrder = await ref.read(orderProvider.notifier).duplicateOrder(order.id);
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Commande ${newOrder.orderNumber} créée !'),
              backgroundColor: Colors.green,
            ),
          );
          context.push('/orders/${newOrder.id}');
        }
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Erreur: $e'), backgroundColor: Colors.red),
          );
        }
      }
    }
  }
}
