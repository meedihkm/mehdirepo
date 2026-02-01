// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - LIVREUR - ÉCRAN PROFIL
// Profil du livreur, stats performance, changement mot de passe
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════

final profileProvider = FutureProvider<DelivererProfile>((ref) async {
  // TODO: Appel API GET /api/auth/profile
  await Future.delayed(const Duration(milliseconds: 300));
  return DelivererProfile(
    id: '1',
    name: 'Ahmed Benali',
    email: 'ahmed@awid.dz',
    phone: '0555 123 456',
    role: 'deliverer',
    joinedAt: DateTime(2023, 6, 15),
    stats: DelivererStats(
      todayDeliveries: 5,
      todayCompleted: 4,
      todayFailed: 0,
      todayCollected: 12500,
      weekDeliveries: 32,
      weekCompleted: 30,
      monthDeliveries: 142,
      monthCompleted: 138,
      successRate: 97.2,
    ),
  );
});

class DelivererProfile {
  final String id, name, email, phone, role;
  final DateTime joinedAt;
  final DelivererStats stats;

  DelivererProfile({
    required this.id, required this.name, required this.email,
    required this.phone, required this.role, required this.joinedAt,
    required this.stats,
  });
}

class DelivererStats {
  final int todayDeliveries, todayCompleted, todayFailed;
  final double todayCollected;
  final int weekDeliveries, weekCompleted, monthDeliveries, monthCompleted;
  final double successRate;

  DelivererStats({
    required this.todayDeliveries, required this.todayCompleted, required this.todayFailed,
    required this.todayCollected, required this.weekDeliveries, required this.weekCompleted,
    required this.monthDeliveries, required this.monthCompleted, required this.successRate,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ÉCRAN
// ═══════════════════════════════════════════════════════════════════════════════

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  static final _fmt = NumberFormat.currency(locale: 'fr_FR', symbol: 'DA', decimalDigits: 0);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(profileProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mon Profil'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () => context.push('/settings'),
          ),
        ],
      ),
      body: profileAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(child: Text('Erreur: $err')),
        data: (profile) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(profileProvider),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Avatar + infos
              _buildProfileCard(context, profile),
              const SizedBox(height: 16),

              // Stats du jour
              _buildTodayStats(context, profile.stats),
              const SizedBox(height: 16),

              // Performance
              _buildPerformanceCard(context, profile.stats),
              const SizedBox(height: 16),

              // Actions
              _buildActionsCard(context, ref),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProfileCard(BuildContext context, DelivererProfile profile) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            CircleAvatar(
              radius: 40,
              backgroundColor: Theme.of(context).primaryColor,
              child: Text(
                profile.name.split(' ').map((w) => w[0]).take(2).join(''),
                style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Colors.white),
              ),
            ),
            const SizedBox(height: 12),
            Text(profile.name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text('Livreur', style: TextStyle(color: Colors.grey[600])),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _ContactChip(icon: Icons.email, text: profile.email),
                const SizedBox(width: 8),
                _ContactChip(icon: Icons.phone, text: profile.phone),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Membre depuis ${DateFormat('MMMM yyyy', 'fr_FR').format(profile.joinedAt)}',
              style: TextStyle(color: Colors.grey[500], fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTodayStats(BuildContext context, DelivererStats stats) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.today, size: 18),
                const SizedBox(width: 8),
                const Text("Aujourd'hui", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(child: _StatBox(
                  label: 'Livraisons',
                  value: '${stats.todayCompleted}/${stats.todayDeliveries}',
                  icon: Icons.local_shipping,
                  color: Colors.blue,
                )),
                const SizedBox(width: 12),
                Expanded(child: _StatBox(
                  label: 'Échouées',
                  value: '${stats.todayFailed}',
                  icon: Icons.cancel,
                  color: stats.todayFailed > 0 ? Colors.red : Colors.green,
                )),
                const SizedBox(width: 12),
                Expanded(child: _StatBox(
                  label: 'Encaissé',
                  value: _fmt.format(stats.todayCollected),
                  icon: Icons.payments,
                  color: Colors.green,
                  isSmallText: true,
                )),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPerformanceCard(BuildContext context, DelivererStats stats) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Performance', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),

            // Taux de réussite
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Taux de réussite', style: TextStyle(fontSize: 13)),
                      const SizedBox(height: 4),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: stats.successRate / 100,
                          minHeight: 8,
                          backgroundColor: Colors.grey.shade200,
                          valueColor: AlwaysStoppedAnimation(
                            stats.successRate >= 95 ? Colors.green
                                : stats.successRate >= 85 ? Colors.orange
                                : Colors.red,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Text('${stats.successRate}%',
                    style: TextStyle(
                      fontSize: 24, fontWeight: FontWeight.bold,
                      color: stats.successRate >= 95 ? Colors.green : Colors.orange,
                    )),
              ],
            ),
            const SizedBox(height: 20),

            // Cette semaine / ce mois
            Row(
              children: [
                Expanded(child: _PeriodStat(
                  label: 'Cette semaine',
                  completed: stats.weekCompleted,
                  total: stats.weekDeliveries,
                )),
                Container(width: 1, height: 40, color: Colors.grey.shade300),
                Expanded(child: _PeriodStat(
                  label: 'Ce mois',
                  completed: stats.monthCompleted,
                  total: stats.monthDeliveries,
                )),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionsCard(BuildContext context, WidgetRef ref) {
    return Card(
      child: Column(
        children: [
          ListTile(
            leading: const Icon(Icons.lock),
            title: const Text('Changer le mot de passe'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _showChangePasswordDialog(context),
          ),
          const Divider(height: 1),
          ListTile(
            leading: const Icon(Icons.cloud_sync),
            title: const Text('Forcer la synchronisation'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Synchronisation lancée...')),
              );
            },
          ),
          const Divider(height: 1),
          ListTile(
            leading: const Icon(Icons.logout, color: Colors.red),
            title: const Text('Déconnexion', style: TextStyle(color: Colors.red)),
            onTap: () => _showLogoutDialog(context, ref),
          ),
        ],
      ),
    );
  }

  void _showChangePasswordDialog(BuildContext context) {
    final currentController = TextEditingController();
    final newController = TextEditingController();
    final confirmController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Changer le mot de passe'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: currentController, obscureText: true,
                decoration: const InputDecoration(labelText: 'Mot de passe actuel')),
            const SizedBox(height: 8),
            TextField(controller: newController, obscureText: true,
                decoration: const InputDecoration(labelText: 'Nouveau mot de passe')),
            const SizedBox(height: 8),
            TextField(controller: confirmController, obscureText: true,
                decoration: const InputDecoration(labelText: 'Confirmer')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annuler')),
          ElevatedButton(
            onPressed: () {
              // TODO: Appel API PUT /api/auth/password
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Mot de passe modifié')),
              );
            },
            child: const Text('Modifier'),
          ),
        ],
      ),
    );
  }

  void _showLogoutDialog(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Déconnexion'),
        content: const Text('Voulez-vous vraiment vous déconnecter ?\n\nLes données non synchronisées seront conservées.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annuler')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () {
              Navigator.pop(ctx);
              // TODO: Logout + clear tokens
              context.go('/login');
            },
            child: const Text('Déconnexion'),
          ),
        ],
      ),
    );
  }
}

// ─── WIDGETS HELPERS ─────────────────────────────────────────────────────────

class _ContactChip extends StatelessWidget {
  final IconData icon;
  final String text;
  const _ContactChip({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.grey.shade100,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: Colors.grey[600]),
          const SizedBox(width: 4),
          Text(text, style: TextStyle(fontSize: 11, color: Colors.grey[700])),
        ],
      ),
    );
  }
}

class _StatBox extends StatelessWidget {
  final String label, value;
  final IconData icon;
  final Color color;
  final bool isSmallText;
  const _StatBox({required this.label, required this.value, required this.icon, required this.color, this.isSmallText = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(height: 6),
          Text(value, style: TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: isSmallText ? 12 : 16,
            color: color,
          )),
          Text(label, style: TextStyle(fontSize: 10, color: Colors.grey[600])),
        ],
      ),
    );
  }
}

class _PeriodStat extends StatelessWidget {
  final String label;
  final int completed, total;
  const _PeriodStat({required this.label, required this.completed, required this.total});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
        const SizedBox(height: 4),
        RichText(text: TextSpan(
          children: [
            TextSpan(text: '$completed', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.black)),
            TextSpan(text: ' / $total', style: TextStyle(fontSize: 14, color: Colors.grey[500])),
          ],
        )),
      ],
    );
  }
}
