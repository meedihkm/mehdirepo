// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - APP CLIENT - ÉCRAN COMPTE
// Informations compte client et relevé
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart';

import '../../providers/providers.dart';
import '../../providers/customer_provider.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// ÉCRAN COMPTE
// ═══════════════════════════════════════════════════════════════════════════════

class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final customerAsync = ref.watch(currentCustomerProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mon Compte'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            onPressed: () {
              // TODO: Navigate to settings
            },
          ),
        ],
      ),
      body: customerAsync.when(
        data: (customer) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(currentCustomerProvider);
          },
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Carte profil
                _ProfileCard(customer: customer),
                const SizedBox(height: 16),

                // Carte crédit
                _CreditCard(customer: customer),
                const SizedBox(height: 24),

                // Statistiques
                _buildSectionTitle('Statistiques'),
                const SizedBox(height: 12),
                _StatsCard(customer: customer),
                const SizedBox(height: 24),

                // Actions
                _buildSectionTitle('Actions'),
                const SizedBox(height: 12),
                _ActionButtons(),

                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
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
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.bold,
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARTE PROFIL
// ═══════════════════════════════════════════════════════════════════════════════

class _ProfileCard extends StatelessWidget {
  final dynamic customer;

  const _ProfileCard({required this.customer});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 32,
                  backgroundColor: Theme.of(context).primaryColor,
                  child: Text(
                    customer.name.substring(0, 1).toUpperCase(),
                    style: const TextStyle(
                      fontSize: 24,
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        customer.name,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        customer.organizationName ?? 'Client',
                        style: TextStyle(
                          color: Colors.grey[600],
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const Divider(height: 24),
            _InfoRow(icon: Icons.phone, label: 'Téléphone', value: customer.phone),
            if (customer.email != null)
              _InfoRow(icon: Icons.email, label: 'Email', value: customer.email!),
            if (customer.organizationName != null)
              _InfoRow(icon: Icons.business, label: 'Entreprise', value: customer.organizationName!),
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(icon, size: 20, color: Colors.grey[600]),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: TextStyle(color: Colors.grey[600], fontSize: 14),
            ),
          ),
          Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARTE CRÉDIT
// ═══════════════════════════════════════════════════════════════════════════════

class _CreditCard extends StatelessWidget {
  final dynamic customer;

  const _CreditCard({required this.customer});

  @override
  Widget build(BuildContext context) {
    final formatCurrency = NumberFormat('#,###', 'fr_FR');
    final currentDebt = customer.currentDebt ?? 0.0;
    final creditLimit = customer.creditLimit;
    final hasCreditLimit = creditLimit != null && creditLimit > 0;
    final availableCredit = hasCreditLimit ? creditLimit - currentDebt : double.infinity;
    final creditUsagePercent = hasCreditLimit && creditLimit > 0
        ? (currentDebt / creditLimit) * 100
        : 0.0;

    return Card(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          gradient: LinearGradient(
            colors: [
              Colors.blue.shade700,
              Colors.blue.shade900,
            ],
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Solde actuel',
                  style: TextStyle(color: Colors.white70, fontSize: 14),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    customer.customerId.substring(0, customer.customerId.length > 10 ? 10 : customer.customerId.length),
                    style: const TextStyle(color: Colors.white, fontSize: 12),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              '${formatCurrency.format(currentDebt)} DA',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 32,
                fontWeight: FontWeight.bold,
              ),
            ),
            if (hasCreditLimit) ...[
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Limite: ${formatCurrency.format(creditLimit)} DA',
                    style: const TextStyle(color: Colors.white70, fontSize: 12),
                  ),
                  Text(
                    '${creditUsagePercent.toStringAsFixed(0)}% utilisé',
                    style: const TextStyle(color: Colors.white70, fontSize: 12),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              LinearProgressIndicator(
                value: creditUsagePercent / 100,
                backgroundColor: Colors.white30,
                valueColor: AlwaysStoppedAnimation<Color>(
                  creditUsagePercent > 80 ? Colors.red : Colors.white,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Disponible: ${formatCurrency.format(availableCredit)} DA',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARTE STATISTIQUES
// ═══════════════════════════════════════════════════════════════════════════════

class _StatsCard extends StatelessWidget {
  final dynamic customer;

  const _StatsCard({required this.customer});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Expanded(
              child: _StatItem(
                icon: Icons.shopping_bag,
                label: 'Commandes',
                value: '0', // Sera mis à jour avec les vraies données
                color: Theme.of(context).primaryColor,
              ),
            ),
            Container(
              width: 1,
              height: 40,
              color: Colors.grey[300],
            ),
            Expanded(
              child: _StatItem(
                icon: Icons.calendar_today,
                label: 'Client depuis',
                value: '2024', // Sera mis à jour avec les vraies données
                color: Colors.green,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _StatItem({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, color: color, size: 28),
        const SizedBox(height: 8),
        Text(
          value,
          style: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: Colors.grey[600],
          ),
        ),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOUTONS D'ACTION
// ═══════════════════════════════════════════════════════════════════════════════

class _ActionButtons extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      children: [
        _ActionButton(
          icon: Icons.receipt_long,
          label: 'Relevé de compte',
          onTap: () {
            // TODO: Navigate to statement screen
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Fonctionnalité à venir...')),
            );
          },
        ),
        const SizedBox(height: 12),
        _ActionButton(
          icon: Icons.download,
          label: 'Télécharger le relevé PDF',
          onTap: () {
            // TODO: Download PDF
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Téléchargement en cours...')),
            );
          },
        ),
        const SizedBox(height: 12),
        _ActionButton(
          icon: Icons.support_agent,
          label: 'Contacter le support',
          onTap: () {
            // TODO: Contact support
          },
        ),
        const SizedBox(height: 12),
        _ActionButton(
          icon: Icons.logout,
          label: 'Déconnexion',
          color: Colors.red,
          onTap: () {
            showDialog(
              context: context,
              builder: (context) => AlertDialog(
                title: const Text('Déconnexion'),
                content: const Text('Voulez-vous vraiment vous déconnecter ?'),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Annuler'),
                  ),
                  TextButton(
                    onPressed: () async {
                      await ref.read(authServiceProvider).logout();
                      if (context.mounted) {
                        Navigator.pop(context);
                        context.go('/login');
                      }
                    },
                    style: TextButton.styleFrom(foregroundColor: Colors.red),
                    child: const Text('Déconnexion'),
                  ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? color;

  const _ActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final buttonColor = color ?? Theme.of(context).primaryColor;

    return Material(
      color: buttonColor.withOpacity(0.1),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Icon(icon, color: buttonColor),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    color: buttonColor,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              Icon(Icons.chevron_right, color: buttonColor),
            ],
          ),
        ),
      ),
    );
  }
}
