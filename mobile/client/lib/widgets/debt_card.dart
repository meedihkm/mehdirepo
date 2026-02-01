// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - WIDGET CARTE DE DETTE
// Affiche la situation financière du client
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../theme/app_colors.dart';

class DebtCard extends StatelessWidget {
  final double currentDebt;
  final double creditLimit;
  final VoidCallback? onTap;

  const DebtCard({
    super.key,
    required this.currentDebt,
    required this.creditLimit,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final formatter = NumberFormat('#,###', 'fr_FR');
    final percentage = creditLimit > 0 ? (currentDebt / creditLimit * 100).clamp(0, 100) : 0;
    final isWarning = percentage >= 80;
    final isCritical = percentage >= 100;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isCritical
                ? Colors.red.withOpacity(0.3)
                : isWarning
                    ? Colors.orange.withOpacity(0.3)
                    : Colors.grey.withOpacity(0.1),
            width: isCritical || isWarning ? 2 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 10,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Icon(
                      isCritical
                          ? Icons.warning
                          : isWarning
                              ? Icons.info
                              : Icons.account_balance_wallet,
                      color: isCritical
                          ? Colors.red
                          : isWarning
                              ? Colors.orange
                              : AppColors.primary,
                      size: 24,
                    ),
                    const SizedBox(width: 8),
                    const Text(
                      'Ma situation',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                Icon(
                  Icons.arrow_forward_ios,
                  size: 16,
                  color: Colors.grey[400],
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Solde dû',
                        style: TextStyle(
                          color: Colors.grey[600],
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${formatter.format(currentDebt)} DZD',
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: currentDebt > 0
                              ? (isCritical ? Colors.red : Colors.black87)
                              : Colors.green,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  width: 1,
                  height: 40,
                  color: Colors.grey[200],
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Limite crédit',
                        style: TextStyle(
                          color: Colors.grey[600],
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${formatter.format(creditLimit)} DZD',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (creditLimit > 0) ...[
              const SizedBox(height: 16),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: percentage / 100,
                  backgroundColor: Colors.grey[200],
                  valueColor: AlwaysStoppedAnimation<Color>(
                    isCritical
                        ? Colors.red
                        : isWarning
                            ? Colors.orange
                            : AppColors.primary,
                  ),
                  minHeight: 8,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '${percentage.toStringAsFixed(0)}% utilisé',
                style: TextStyle(
                  color: isCritical
                      ? Colors.red
                      : isWarning
                          ? Colors.orange
                          : Colors.grey[600],
                  fontSize: 12,
                  fontWeight: isWarning || isCritical ? FontWeight.w600 : FontWeight.normal,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
