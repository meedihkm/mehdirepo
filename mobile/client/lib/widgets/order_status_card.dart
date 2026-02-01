// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - WIDGET CARTE STATUT COMMANDE
// Affiche une commande en cours avec son statut
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/models.dart';
import '../theme/app_colors.dart';

class OrderStatusCard extends StatelessWidget {
  final Order order;
  final VoidCallback? onTap;

  const OrderStatusCard({
    super.key,
    required this.order,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final formatter = NumberFormat('#,###', 'fr_FR');

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '#${order.orderNumber}',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${order.items.length} articles • ${formatter.format(order.total)} DZD',
                        style: TextStyle(
                          color: Colors.grey[600],
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                  _buildStatusChip(order.status),
                ],
              ),
              const SizedBox(height: 16),
              _buildProgressIndicator(order.status),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusChip(OrderStatus status) {
    final config = _getStatusConfig(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: config.color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(config.icon, size: 14, color: config.color),
          const SizedBox(width: 4),
          Text(
            config.label,
            style: TextStyle(
              color: config.color,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProgressIndicator(OrderStatus status) {
    final progress = _getProgressValue(status);
    final config = _getStatusConfig(status);
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: progress,
            backgroundColor: Colors.grey[200],
            valueColor: AlwaysStoppedAnimation<Color>(config.color),
            minHeight: 6,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          config.description,
          style: TextStyle(
            color: Colors.grey[600],
            fontSize: 12,
          ),
        ),
      ],
    );
  }

  double _getProgressValue(OrderStatus status) {
    switch (status) {
      case OrderStatus.pending:
        return 0.1;
      case OrderStatus.confirmed:
        return 0.25;
      case OrderStatus.preparing:
        return 0.5;
      case OrderStatus.ready:
        return 0.75;
      case OrderStatus.assigned:
      case OrderStatus.inDelivery:
        return 0.9;
      case OrderStatus.delivered:
        return 1.0;
      default:
        return 0.0;
    }
  }

  _StatusConfig _getStatusConfig(OrderStatus status) {
    switch (status) {
      case OrderStatus.pending:
        return _StatusConfig(
          label: 'En attente',
          color: Colors.orange,
          icon: Icons.hourglass_empty,
          description: 'Votre commande est en attente de confirmation',
        );
      case OrderStatus.confirmed:
        return _StatusConfig(
          label: 'Confirmée',
          color: Colors.blue,
          icon: Icons.check_circle,
          description: 'Votre commande a été confirmée',
        );
      case OrderStatus.preparing:
        return _StatusConfig(
          label: 'En préparation',
          color: Colors.purple,
          icon: Icons.restaurant,
          description: 'Vos articles sont en cours de préparation',
        );
      case OrderStatus.ready:
        return _StatusConfig(
          label: 'Prête',
          color: Colors.teal,
          icon: Icons.inventory_2,
          description: 'Votre commande est prête à être livrée',
        );
      case OrderStatus.assigned:
      case OrderStatus.inDelivery:
        return _StatusConfig(
          label: 'En livraison',
          color: Colors.indigo,
          icon: Icons.local_shipping,
          description: 'Votre commande est en route vers vous',
        );
      case OrderStatus.delivered:
        return _StatusConfig(
          label: 'Livrée',
          color: Colors.green,
          icon: Icons.check_circle,
          description: 'Votre commande a été livrée',
        );
      default:
        return _StatusConfig(
          label: 'Inconnu',
          color: Colors.grey,
          icon: Icons.help,
          description: 'Statut inconnu',
        );
    }
  }
}

class _StatusConfig {
  final String label;
  final Color color;
  final IconData icon;
  final String description;

  _StatusConfig({
    required this.label,
    required this.color,
    required this.icon,
    required this.description,
  });
}
