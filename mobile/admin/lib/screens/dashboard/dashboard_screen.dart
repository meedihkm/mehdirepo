// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - APPLICATION ADMIN
// Dashboard en temps réel avec WebSocket
// lib/screens/dashboard/dashboard_screen.dart
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:fl_chart/fl_chart.dart';

import '../../providers/dashboard_provider.dart';
import '../../providers/realtime_provider.dart';
import '../../models/dashboard.dart';
import '../../theme/app_colors.dart';
import '../../widgets/stat_card.dart';
import '../../widgets/alert_card.dart';
import '../../widgets/delivery_tracker.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  @override
  void initState() {
    super.initState();
    // Se connecter au WebSocket pour les mises à jour temps réel
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(realtimeProvider.notifier).connect();
    });
  }

  @override
  Widget build(BuildContext context) {
    final dashboardAsync = ref.watch(dashboardProvider);
    final realtimeState = ref.watch(realtimeProvider);
    final formatter = NumberFormat('#,###', 'fr_FR');

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Tableau de bord'),
        actions: [
          // Indicateur temps réel
          Container(
            margin: const EdgeInsets.only(right: 8),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: realtimeState.isConnected
                  ? Colors.green.withOpacity(0.1)
                  : Colors.red.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.circle,
                  size: 8,
                  color: realtimeState.isConnected ? Colors.green : Colors.red,
                ),
                const SizedBox(width: 4),
                Text(
                  realtimeState.isConnected ? 'En direct' : 'Hors ligne',
                  style: TextStyle(
                    fontSize: 12,
                    color: realtimeState.isConnected ? Colors.green : Colors.red,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.refresh(dashboardProvider),
          ),
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () => context.push('/notifications'),
          ),
        ],
      ),
      body: dashboardAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _buildError(e.toString()),
        data: (dashboard) => RefreshIndicator(
          onRefresh: () => ref.refresh(dashboardProvider.future),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ═══════════════════════════════════════════════════════════
                  // KPIs PRINCIPAUX
                  // ═══════════════════════════════════════════════════════════
                  _buildKpiSection(dashboard, formatter),

                  const SizedBox(height: 24),

                  // ═══════════════════════════════════════════════════════════
                  // ALERTES IMPORTANTES
                  // ═══════════════════════════════════════════════════════════
                  if (dashboard.alerts.isNotEmpty) ...[
                    _buildAlertsSection(dashboard.alerts),
                    const SizedBox(height: 24),
                  ],

                  // ═══════════════════════════════════════════════════════════
                  // LIVRAISONS EN COURS
                  // ═══════════════════════════════════════════════════════════
                  _buildDeliveriesSection(dashboard, formatter),

                  const SizedBox(height: 24),

                  // ═══════════════════════════════════════════════════════════
                  // GRAPHIQUE TENDANCES
                  // ═══════════════════════════════════════════════════════════
                  _buildTrendsSection(dashboard),

                  const SizedBox(height: 24),

                  // ═══════════════════════════════════════════════════════════
                  // COMMANDES RÉCENTES
                  // ═══════════════════════════════════════════════════════════
                  _buildRecentOrdersSection(dashboard, formatter),

                  const SizedBox(height: 80),
                ],
              ),
            ),
          ),
        ),
      ),
      // ═══════════════════════════════════════════════════════════════════════
      // NAVIGATION BOTTOM
      // ═══════════════════════════════════════════════════════════════════════
      bottomNavigationBar: NavigationBar(
        selectedIndex: 0,
        onDestinationSelected: (index) {
          switch (index) {
            case 0:
              break; // Déjà sur dashboard
            case 1:
              context.go('/orders');
              break;
            case 2:
              context.go('/customers');
              break;
            case 3:
              context.go('/finance');
              break;
            case 4:
              context.go('/settings');
              break;
          }
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard),
            label: 'Dashboard',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long),
            label: 'Commandes',
          ),
          NavigationDestination(
            icon: Icon(Icons.people_outline),
            selectedIcon: Icon(Icons.people),
            label: 'Clients',
          ),
          NavigationDestination(
            icon: Icon(Icons.account_balance_wallet_outlined),
            selectedIcon: Icon(Icons.account_balance_wallet),
            label: 'Finance',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings),
            label: 'Paramètres',
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION: KPIs
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildKpiSection(DashboardData dashboard, NumberFormat formatter) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Aujourd\'hui',
          style: TextStyle(
            fontSize: 13,
            color: Colors.grey[600],
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: StatCard(
                title: 'Chiffre d\'affaires',
                value: '${formatter.format(dashboard.todayRevenue)} DZD',
                icon: Icons.trending_up,
                color: Colors.green,
                trend: dashboard.revenueTrend,
                onTap: () => context.push('/finance'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: StatCard(
                title: 'Encaissé',
                value: '${formatter.format(dashboard.todayCollected)} DZD',
                icon: Icons.account_balance_wallet,
                color: Colors.blue,
                subtitle: '${dashboard.collectionRate.toStringAsFixed(0)}%',
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: StatCard(
                title: 'Commandes',
                value: '${dashboard.todayOrders}',
                icon: Icons.receipt_long,
                color: Colors.purple,
                subtitle: '${dashboard.ordersDelivered} livrées',
                onTap: () => context.push('/orders'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: StatCard(
                title: 'Dettes totales',
                value: '${formatter.format(dashboard.totalDebt)} DZD',
                icon: Icons.warning_amber,
                color: dashboard.totalDebt > 0 ? Colors.orange : Colors.grey,
                subtitle: '${dashboard.customersWithDebt} clients',
                onTap: () => context.push('/finance/debts'),
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION: Alertes
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildAlertsSection(List<DashboardAlert> alerts) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Icons.warning_amber, color: Colors.orange[700], size: 20),
            const SizedBox(width: 8),
            Text(
              'Alertes (${alerts.length})',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        ...alerts.take(3).map((alert) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: AlertCard(
                alert: alert,
                onTap: () => _handleAlertTap(alert),
                onDismiss: () => ref.read(dashboardProvider.notifier).dismissAlert(alert.id),
              ),
            )),
        if (alerts.length > 3)
          TextButton(
            onPressed: () => context.push('/alerts'),
            child: Text('Voir toutes les alertes (${alerts.length})'),
          ),
      ],
    );
  }

  void _handleAlertTap(DashboardAlert alert) {
    switch (alert.type) {
      case AlertType.creditLimitExceeded:
        context.push('/customers/${alert.entityId}');
        break;
      case AlertType.deliveryFailed:
        context.push('/deliveries/${alert.entityId}');
        break;
      case AlertType.orderPending:
        context.push('/orders/${alert.entityId}');
        break;
      default:
        break;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION: Livraisons en cours
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildDeliveriesSection(DashboardData dashboard, NumberFormat formatter) {
    final activeDeliveries = dashboard.activeDeliveries;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                const Icon(Icons.local_shipping, color: AppColors.primary, size: 20),
                const SizedBox(width: 8),
                const Text(
                  'Livraisons en cours',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            TextButton(
              onPressed: () => context.push('/deliveries'),
              child: const Text('Tout voir'),
            ),
          ],
        ),
        const SizedBox(height: 12),

        if (activeDeliveries.isEmpty)
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.grey[100],
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Column(
                children: [
                  Icon(Icons.check_circle_outline, size: 48, color: Colors.grey[400]),
                  const SizedBox(height: 8),
                  Text(
                    'Aucune livraison en cours',
                    style: TextStyle(color: Colors.grey[600]),
                  ),
                ],
              ),
            ),
          )
        else
          SizedBox(
            height: 180,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: activeDeliveries.length,
              itemBuilder: (context, index) {
                final delivery = activeDeliveries[index];
                return Padding(
                  padding: EdgeInsets.only(
                    right: index < activeDeliveries.length - 1 ? 12 : 0,
                  ),
                  child: DeliveryTracker(
                    delivery: delivery,
                    onTap: () => context.push('/deliveries/${delivery.id}'),
                  ),
                );
              },
            ),
          ),

        // Résumé livreurs
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: dashboard.deliverersSummary.map((d) => Column(
              children: [
                CircleAvatar(
                  backgroundColor: AppColors.primary.withOpacity(0.1),
                  child: Text(
                    d.name[0].toUpperCase(),
                    style: TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  d.name.split(' ').first,
                  style: const TextStyle(fontWeight: FontWeight.w500),
                ),
                Text(
                  '${d.completedToday}/${d.totalToday}',
                  style: TextStyle(color: Colors.grey[600], fontSize: 12),
                ),
              ],
            )).toList(),
          ),
        ),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION: Tendances
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildTrendsSection(DashboardData dashboard) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Tendances (7 jours)',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              DropdownButton<String>(
                value: 'revenue',
                items: const [
                  DropdownMenuItem(value: 'revenue', child: Text('CA')),
                  DropdownMenuItem(value: 'orders', child: Text('Commandes')),
                  DropdownMenuItem(value: 'collection', child: Text('Encaissement')),
                ],
                onChanged: (value) {
                  // TODO: Changer le graphique
                },
                underline: const SizedBox(),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 200,
            child: LineChart(
              LineChartData(
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  horizontalInterval: dashboard.chartMaxY / 4,
                  getDrawingHorizontalLine: (value) => FlLine(
                    color: Colors.grey[200],
                    strokeWidth: 1,
                  ),
                ),
                titlesData: FlTitlesData(
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 50,
                      getTitlesWidget: (value, meta) => Text(
                        _formatChartValue(value),
                        style: TextStyle(color: Colors.grey[600], fontSize: 10),
                      ),
                    ),
                  ),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      getTitlesWidget: (value, meta) {
                        final index = value.toInt();
                        if (index >= 0 && index < dashboard.chartData.length) {
                          return Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: Text(
                              dashboard.chartData[index].label,
                              style: TextStyle(color: Colors.grey[600], fontSize: 10),
                            ),
                          );
                        }
                        return const SizedBox();
                      },
                    ),
                  ),
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                ),
                borderData: FlBorderData(show: false),
                minX: 0,
                maxX: (dashboard.chartData.length - 1).toDouble(),
                minY: 0,
                maxY: dashboard.chartMaxY,
                lineBarsData: [
                  LineChartBarData(
                    spots: dashboard.chartData.asMap().entries.map((e) =>
                      FlSpot(e.key.toDouble(), e.value.value),
                    ).toList(),
                    isCurved: true,
                    color: AppColors.primary,
                    barWidth: 3,
                    isStrokeCapRound: true,
                    dotData: const FlDotData(show: false),
                    belowBarData: BarAreaData(
                      show: true,
                      color: AppColors.primary.withOpacity(0.1),
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

  String _formatChartValue(double value) {
    if (value >= 1000000) {
      return '${(value / 1000000).toStringAsFixed(1)}M';
    } else if (value >= 1000) {
      return '${(value / 1000).toStringAsFixed(0)}k';
    }
    return value.toStringAsFixed(0);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION: Commandes récentes
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildRecentOrdersSection(DashboardData dashboard, NumberFormat formatter) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Commandes récentes',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            TextButton(
              onPressed: () => context.push('/orders'),
              child: const Text('Tout voir'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
          ),
          child: ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: dashboard.recentOrders.length,
            separatorBuilder: (_, __) => const Divider(height: 1, indent: 16, endIndent: 16),
            itemBuilder: (context, index) {
              final order = dashboard.recentOrders[index];
              return ListTile(
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
                  '#${order.orderNumber}',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                subtitle: Text(
                  order.customerName,
                  style: TextStyle(color: Colors.grey[600], fontSize: 13),
                ),
                trailing: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '${formatter.format(order.total)} DZD',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    Text(
                      _formatTime(order.createdAt),
                      style: TextStyle(color: Colors.grey[500], fontSize: 11),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  String _formatTime(DateTime dateTime) {
    final now = DateTime.now();
    final diff = now.difference(dateTime);

    if (diff.inMinutes < 1) return 'À l\'instant';
    if (diff.inMinutes < 60) return 'Il y a ${diff.inMinutes} min';
    if (diff.inHours < 24) return 'Il y a ${diff.inHours}h';
    return DateFormat('dd/MM HH:mm').format(dateTime);
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'pending':
      case 'confirmed':
        return Colors.orange;
      case 'preparing':
      case 'ready':
        return Colors.blue;
      case 'assigned':
      case 'in_delivery':
        return Colors.purple;
      case 'delivered':
        return Colors.green;
      case 'cancelled':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  IconData _getStatusIcon(String status) {
    switch (status) {
      case 'pending':
        return Icons.schedule;
      case 'confirmed':
        return Icons.check_circle_outline;
      case 'preparing':
        return Icons.restaurant;
      case 'ready':
        return Icons.inventory_2;
      case 'assigned':
      case 'in_delivery':
        return Icons.local_shipping;
      case 'delivered':
        return Icons.check_circle;
      case 'cancelled':
        return Icons.cancel;
      default:
        return Icons.receipt;
    }
  }

  Widget _buildError(String message) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.error_outline, size: 64, color: Colors.red[300]),
          const SizedBox(height: 16),
          Text(
            'Erreur de chargement',
            style: TextStyle(fontSize: 18, color: Colors.grey[700]),
          ),
          const SizedBox(height: 8),
          Text(message, style: TextStyle(color: Colors.grey[500])),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: () => ref.refresh(dashboardProvider),
            icon: const Icon(Icons.refresh),
            label: const Text('Réessayer'),
          ),
        ],
      ),
    );
  }
}
