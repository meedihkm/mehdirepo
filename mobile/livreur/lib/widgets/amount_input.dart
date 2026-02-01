// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - CHAMP DE SAISIE MONTANT
// Pour la saisie des montants collectés
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class AmountInput extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final String? prefix;
  final bool autofocus;
  final Function(String)? onChanged;
  final Function(String)? onSubmitted;

  const AmountInput({
    Key? key,
    required this.controller,
    required this.label,
    this.prefix = 'DA',
    this.autofocus = false,
    this.onChanged,
    this.onSubmitted,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      autofocus: autofocus,
      style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
      decoration: InputDecoration(
        labelText: label,
        prefixText: prefix != null ? '$prefix ' : null,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      ),
      onChanged: onChanged,
      onSubmitted: onSubmitted,
    );
  }
}
