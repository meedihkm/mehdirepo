// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - COULEURS DE L'APPLICATION
// Palette de couleurs centralisée
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';

class AppColors {
  // Couleurs principales
  static const Color primary = Color(0xFF1E88E5);
  static const Color primaryDark = Color(0xFF1565C0);
  static const Color primaryLight = Color(0xFF64B5F6);
  
  // Couleurs de fond
  static const Color background = Color(0xFFF5F5F5);
  static const Color surface = Colors.white;
  static const Color scaffoldBackground = Color(0xFFF5F5F5);
  
  // Couleurs de texte
  static const Color textPrimary = Color(0xFF212121);
  static const Color textSecondary = Color(0xFF757575);
  static const Color textHint = Color(0xFFBDBDBD);
  
  // Couleurs d'état
  static const Color success = Color(0xFF4CAF50);
  static const Color warning = Color(0xFFFFA726);
  static const Color error = Color(0xFFE53935);
  static const Color info = Color(0xFF29B6F6);
  
  // Couleurs spécifiques livraison
  static const Color delivered = Color(0xFF4CAF50);
  static const Color inProgress = Color(0xFFFFA726);
  static const Color pending = Color(0xFF9E9E9E);
  static const Color failed = Color(0xFFE53935);
}
