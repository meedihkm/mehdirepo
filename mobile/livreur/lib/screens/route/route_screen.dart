// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - ÉCRAN TOURNÉE DU JOUR (Livreur)
// lib/screens/route/route_screen.dart
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:intl/intl.dart';

import '../../models/delivery.dart';
import '../../providers/delivery_provider.dart';
import '../../providers/sync_provider.dart';
import '../../widgets/common_widgets.dart';
import '../../widgets/sync_indicator.dart';
import '../../theme/app_colors.dart';

class RouteScreen extends ConsumerStatefulWidget {
  const RouteScreen({super.key});

  @override
  ConsumerState<RouteScreen> createState() => _RouteScreenState();
}

class _RouteScreenState extends ConsumerState<RouteScreen> {
  @override
  void initState() {
    super.initState();
    // Charger la tournée au démarrage
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.invalidate(myRouteProvider);
    });
  }

  @override
  Widget build(BuildContext context) {
    final deliveriesAsync = ref.watch(myRouteProvider);
    final isOnlineAsync = ref.watch(isOnlineProvider);
    final pendingCount = ref.watch(pendingSyncCountProvider);
    final isOnline = isOnlineAsync.value ?? false;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Ma Tournée'),
            Text(
              DateFormat('EEEE d MMMM', 'fr_FR').format(DateTime.now()),
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.normal),
            ),
          ],
        ),
        actions: [
          // Indicateur de sync
          SyncIndicator(
            isOnline: isOnline,
            pendingCount: pendingCount,
          ),
          // Rafraîchir
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(myRouteProvider),
          ),
        ],
      ),
      body: deliveriesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stack) => _buildError(error.toString()),
        data: (deliveries) => _buildContent(deliveries),
      ),
    );
  }

  Widget _buildContent(List<Delivery> deliveries) {
    if (deliveries.isEmpty) {
      return _buildEmptyState();
    }

    // Séparer les livraisons complétées et en attente
    final pending = deliveries.where((d) => !d.status.isCompleted).toList();
    final completed = deliveries.where((d) => d.status.isCompleted).toList();

    // Stats
    final totalToCollect = pending.fold<double>(0, (sum, d) => sum + d.totalToCollect);
    final totalCollected = deliveries.fold<double>(0, (sum, d) => sum + d.amountCollected);

    return Column(
      children: [
        // En-tête avec stats
        _buildStatsHeader(
          total: deliveries.length,
          completed: completed.length,
          pending: pending.length,
          toCollect: totalToCollect,
          collected: totalCollected,
        ),

        // Actions rapides
        _buildQuickActions(pending),

        // Liste des livraisons
        Expanded(
          child: RefreshIndicator(
            onRefresh: () async => ref.invalidate(myRouteProvider),
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                // En attente
                if (pending.isNotEmpty) ...[
                  _buildSectionHeader('En attente (${pending.length})', Icons.pending_actions),
                  ...pending.map((d) => DeliveryCard(
                    delivery: d,
                    onTap: () => _openDelivery(d),
                    onNavigate: () => _navigateTo(d),
                    onCall: () => _callCustomer(d),
                  )),
                ],

                // Complétées
                if (completed.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  _buildSectionHeader('Complétées (${completed.length})', Icons.check_circle_outline),
                  ...completed.map((d) => DeliveryCard(
                    delivery: d,
                    onTap: () => _openDelivery(d),
                    isCompleted: true,
                  )),
                ],

                const SizedBox(height: 100), // Espace pour FAB
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildStatsHeader({
    required int total,
    required int completed,
    required int pending,
    required double toCollect,
    required double collected,
  }) {
    final formatter = NumberFormat('#,###', 'fr_FR');

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
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
      child: Column(
        children: [
          // Progression
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '🚚 $completed / $total livraisons',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: total > 0 ? completed / total : 0,
                        backgroundColor: Colors.white24,
                        valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
                        minHeight: 8,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // Montants
          Row(
            children: [
              Expanded(
                child: _buildStatItem(
                  icon: Icons.attach_money,
                  label: 'À collecter',
                  value: '${formatter.format(toCollect)} DZD',
                ),
              ),
              Container(
                width: 1,
                height: 40,
                color: Colors.white24,
              ),
              Expanded(
                child: _buildStatItem(
                  icon: Icons.account_balance_wallet,
                  label: 'Collecté',
                  value: '${formatter.format(collected)} DZD',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem({
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Row(
        children: [
          Icon(icon, color: Colors.white70, size: 24),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(color: Colors.white70, fontSize: 12),
                ),
                Text(
                  value,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActions(List<Delivery> pending) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          // Voir sur la carte
          Expanded(
            child: OutlinedButton.icon(
              onPressed: pending.isNotEmpty ? () => _openMap(pending) : null,
              icon: const Icon(Icons.map_outlined),
              label: const Text('Carte'),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
          const SizedBox(width: 12),
          // Optimiser l'itinéraire
          Expanded(
            child: OutlinedButton.icon(
              onPressed: pending.length > 1 ? () => _optimizeRoute(pending) : null,
              icon: const Icon(Icons.route_outlined),
              label: const Text('Optimiser'),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title, IconData icon) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          Icon(icon, size: 20, color: AppColors.textSecondary),
          const SizedBox(width: 8),
          Text(
            title,
            style: TextStyle(
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w600,
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.local_shipping_outlined, size: 80, color: Colors.grey[300]),
          const SizedBox(height: 16),
          Text(
            'Aucune livraison aujourd\'hui',
            style: TextStyle(
              fontSize: 18,
              color: Colors.grey[600],
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Profitez de votre journée ! 🎉',
            style: TextStyle(color: Colors.grey[500]),
          ),
        ],
      ),
    );
  }

  Widget _buildError(String message) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.error_outline, size: 60, color: Colors.red[300]),
          const SizedBox(height: 16),
          Text(
            'Erreur de chargement',
            style: TextStyle(
              fontSize: 18,
              color: Colors.grey[600],
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey[500]),
            ),
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: () => ref.invalidate(myRouteProvider),
            icon: const Icon(Icons.refresh),
            label: const Text('Réessayer'),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  void _openDelivery(Delivery delivery) {
    context.push('/delivery/${delivery.id}');
  }

  Future<void> _navigateTo(Delivery delivery) async {
    if (delivery.customerCoordinates != null) {
      final lat = delivery.customerCoordinates!.lat;
      final lng = delivery.customerCoordinates!.lng;
      
      // Essayer Google Maps d'abord
      final googleMapsUrl = 'google.navigation:q=$lat,$lng&mode=d';
      final googleMapsUri = Uri.parse(googleMapsUrl);
      
      if (await canLaunchUrl(googleMapsUri)) {
        await launchUrl(googleMapsUri);
        return;
      }
      
      // Sinon essayer Waze
      final wazeUrl = 'waze://?ll=$lat,$lng&navigate=yes';
      final wazeUri = Uri.parse(wazeUrl);
      
      if (await canLaunchUrl(wazeUri)) {
        await launchUrl(wazeUri);
        return;
      }
      
      // Fallback: Google Maps web
      final webUrl = 'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=driving';
      await launchUrl(Uri.parse(webUrl), mode: LaunchMode.externalApplication);
    } else {
      // Pas de coordonnées, ouvrir avec l'adresse
      final address = Uri.encodeComponent(delivery.customerAddress);
      final url = 'https://www.google.com/maps/search/?api=1&query=$address';
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _callCustomer(Delivery delivery) async {
    final phoneUrl = 'tel:${delivery.customerPhone}';
    if (await canLaunchUrl(Uri.parse(phoneUrl))) {
      await launchUrl(Uri.parse(phoneUrl));
    }
  }

  void _openMap(List<Delivery> deliveries) {
    // Ouvrir une vue carte avec toutes les livraisons
    context.push('/map', extra: deliveries);
  }

  Future<void> _optimizeRoute(List<Delivery> deliveries) async {
    // Demander confirmation
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Optimiser l\'itinéraire ?'),
        content: const Text(
          'L\'ordre des livraisons sera réorganisé pour minimiser '
          'la distance totale à parcourir.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Annuler'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Optimiser'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      final pendingIds = deliveries
          .where((d) => d.status == DeliveryStatus.pending)
          .map((d) => d.id)
          .toList();

      if (pendingIds.length < 2) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Pas assez de livraisons à optimiser')),
          );
        }
        return;
      }

      // Afficher un indicateur de chargement
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) => const Center(
          child: CircularProgressIndicator(),
        ),
      );

      try {
        await ref.read(deliveryNotifierProvider.notifier).optimizeRoute(pendingIds);
        
        // Rafraîchir la liste
        ref.invalidate(myRouteProvider);

        if (mounted) {
          Navigator.pop(context); // Fermer le chargement
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Route optimisée')),
          );
        }
      } catch (e) {
        if (mounted) {
          Navigator.pop(context); // Fermer le chargement
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Erreur: $e')),
          );
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET: Carte de livraison
// lib/widgets/delivery_card.dart
// ═══════════════════════════════════════════════════════════════════════════════

class DeliveryCard extends StatelessWidget {
  final Delivery delivery;
  final VoidCallback onTap;
  final VoidCallback? onNavigate;
  final VoidCallback? onCall;
  final bool isCompleted;

  const DeliveryCard({
    super.key,
    required this.delivery,
    required this.onTap,
    this.onNavigate,
    this.onCall,
    this.isCompleted = false,
  });

  @override
  Widget build(BuildContext context) {
    final formatter = NumberFormat('#,###', 'fr_FR');
    final hasDebt = delivery.existingDebt > 0;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: isCompleted ? 0 : 2,
      color: isCompleted ? Colors.grey[100] : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: _getStatusColor().withOpacity(0.3),
          width: 1,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // En-tête: numéro + statut
              Row(
                children: [
                  // Numéro de séquence
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: _getStatusColor().withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Center(
                      child: Text(
                        '${delivery.sequenceNumber}',
                        style: TextStyle(
                          color: _getStatusColor(),
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  // Nom client
                  Expanded(
                    child: Text(
                      delivery.customerName,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: isCompleted ? Colors.grey : Colors.black87,
                      ),
                    ),
                  ),
                  // Statut
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: _getStatusColor().withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '${delivery.status.icon} ${delivery.status.label}',
                      style: TextStyle(
                        fontSize: 12,
                        color: _getStatusColor(),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 12),

              // Adresse
              Row(
                children: [
                  Icon(Icons.location_on_outlined, size: 16, color: Colors.grey[600]),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      delivery.customerAddress,
                      style: TextStyle(
                        color: Colors.grey[600],
                        fontSize: 13,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 8),

              // Commande
              Row(
                children: [
                  Icon(Icons.receipt_outlined, size: 16, color: Colors.grey[600]),
                  const SizedBox(width: 4),
                  Text(
                    '#${delivery.orderNumber}',
                    style: TextStyle(
                      color: Colors.grey[600],
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '• ${delivery.items.length} articles',
                    style: TextStyle(
                      color: Colors.grey[600],
                      fontSize: 13,
                    ),
                  ),
                ],
              ),

              const Divider(height: 24),

              // Montants
              Row(
                children: [
                  // Commande
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Commande',
                          style: TextStyle(color: Colors.grey[500], fontSize: 11),
                        ),
                        Text(
                          '${formatter.format(delivery.orderAmount)} DZD',
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Dette
                  if (hasDebt) ...[
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                'Dette',
                                style: TextStyle(color: Colors.grey[500], fontSize: 11),
                              ),
                              const SizedBox(width: 4),
                              Icon(Icons.warning_amber, size: 12, color: Colors.orange[700]),
                            ],
                          ),
                          Text(
                            '${formatter.format(delivery.existingDebt)} DZD',
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                              color: Colors.orange[700],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  // Total
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          'Total',
                          style: TextStyle(color: Colors.grey[500], fontSize: 11),
                        ),
                        Text(
                          '${formatter.format(delivery.totalToCollect)} DZD',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                            color: AppColors.primary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),

              // Actions (si pas complétée)
              if (!isCompleted && (onNavigate != null || onCall != null)) ...[
                const SizedBox(height: 12),
                Row(
                  children: [
                    if (onNavigate != null)
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: onNavigate,
                          icon: const Icon(Icons.navigation, size: 18),
                          label: const Text('Naviguer'),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                          ),
                        ),
                      ),
                    if (onNavigate != null && onCall != null)
                      const SizedBox(width: 8),
                    if (onCall != null)
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: onCall,
                          icon: const Icon(Icons.phone, size: 18),
                          label: const Text('Appeler'),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                          ),
                        ),
                      ),
                  ],
                ),
              ],

              // Résultat (si complétée)
              if (isCompleted && delivery.amountCollected > 0) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.green.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.check_circle, size: 16, color: Colors.green),
                      const SizedBox(width: 8),
                      Text(
                        'Collecté: ${formatter.format(delivery.amountCollected)} DZD',
                        style: const TextStyle(
                          color: Colors.green,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Color _getStatusColor() {
    switch (delivery.status) {
      case DeliveryStatus.pending:
      case DeliveryStatus.assigned:
        return Colors.grey;
      case DeliveryStatus.pickedUp:
      case DeliveryStatus.inTransit:
        return Colors.blue;
      case DeliveryStatus.arrived:
        return Colors.orange;
      case DeliveryStatus.delivered:
        return Colors.green;
      case DeliveryStatus.failed:
      case DeliveryStatus.returned:
        return Colors.red;
    }
  }
}
