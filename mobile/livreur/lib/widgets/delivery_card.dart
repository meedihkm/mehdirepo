// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - CARTE DE LIVRAISON
// Widget pour afficher une livraison dans une liste
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import '../models/delivery.dart';
import '../theme/app_colors.dart';

class DeliveryCard extends StatelessWidget {
  final Delivery delivery;
  final VoidCallback? onTap;
  final VoidCallback? onCall;
  final VoidCallback? onNavigate;

  const DeliveryCard({
    Key? key,
    required this.delivery,
    this.onTap,
    this.onCall,
    this.onNavigate,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    delivery.customer?.name ?? 'Client',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  _buildStatusChip(),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                delivery.customer?.address ?? 'Adresse non disponible',
                style: TextStyle(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(Icons.phone, size: 16, color: AppColors.textSecondary),
                  const SizedBox(width: 4),
                  Text(delivery.customer?.phone ?? 'N/A'),
                  const Spacer(),
                  Text(
                    '${delivery.totalToCollect.toStringAsFixed(2)} DA',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
              if (onCall != null || onNavigate != null) ...[
                const Divider(height: 24),
                Row(
                  children: [
                    if (onCall != null)
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: onCall,
                          icon: const Icon(Icons.phone),
                          label: const Text('Appeler'),
                        ),
                      ),
                    if (onCall != null && onNavigate != null)
                      const SizedBox(width: 8),
                    if (onNavigate != null)
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: onNavigate,
                          icon: const Icon(Icons.navigation),
                          label: const Text('Naviguer'),
                        ),
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusChip() {
    Color color;
    String label;
    
    switch (delivery.status) {
      case DeliveryStatus.delivered:
        color = AppColors.delivered;
        label = 'Livré';
        break;
      case DeliveryStatus.inTransit:
        color = AppColors.inProgress;
        label = 'En cours';
        break;
      case DeliveryStatus.failed:
        color = AppColors.failed;
        label = 'Échoué';
        break;
      case DeliveryStatus.pending:
      default:
        color = AppColors.pending;
        label = 'En attente';
    }
    
    return Chip(
      label: Text(label, style: const TextStyle(fontSize: 12)),
      backgroundColor: color.withOpacity(0.1),
      side: BorderSide(color: color),
    );
  }
}
