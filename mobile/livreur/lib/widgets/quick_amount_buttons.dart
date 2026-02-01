// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - BOUTONS MONTANTS RAPIDES
// Boutons pour sélectionner rapidement un montant prédéfini
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class QuickAmountButtons extends StatelessWidget {
  final Function(double) onAmountSelected;
  final double? currentAmount;

  const QuickAmountButtons({
    Key? key,
    required this.onAmountSelected,
    this.currentAmount,
  }) : super(key: key);

  static const List<double> amounts = [50, 100, 200, 500, 1000];

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: amounts.map((amount) {
        final isSelected = currentAmount == amount;
        return ActionChip(
          label: Text('${amount.toInt()} DA'),
          backgroundColor: isSelected ? AppColors.primary : null,
          labelStyle: TextStyle(
            color: isSelected ? Colors.white : null,
          ),
          onPressed: () => onAmountSelected(amount),
        );
      }).toList(),
    );
  }
}
