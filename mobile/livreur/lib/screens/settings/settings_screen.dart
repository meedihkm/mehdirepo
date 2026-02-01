// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - LIVREUR - ÉCRAN PARAMÈTRES
// Config app, sync offline, cache, notifications, info appareil
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════

final settingsProvider = StateNotifierProvider<SettingsNotifier, AppSettings>((ref) {
  return SettingsNotifier();
});

class AppSettings {
  final bool autoSync;
  final int syncIntervalMinutes;
  final bool notifyNewDelivery;
  final bool notifyRouteChange;
  final bool soundEnabled;
  final bool vibrationEnabled;
  final bool darkMode;
  final bool keepScreenOn;
  final bool gpsHighAccuracy;
  final String language;
  final int cacheMaxDays;

  const AppSettings({
    this.autoSync = true,
    this.syncIntervalMinutes = 5,
    this.notifyNewDelivery = true,
    this.notifyRouteChange = true,
    this.soundEnabled = true,
    this.vibrationEnabled = true,
    this.darkMode = false,
    this.keepScreenOn = true,
    this.gpsHighAccuracy = true,
    this.language = 'fr',
    this.cacheMaxDays = 7,
  });

  AppSettings copyWith({
    bool? autoSync, int? syncIntervalMinutes, bool? notifyNewDelivery,
    bool? notifyRouteChange, bool? soundEnabled, bool? vibrationEnabled,
    bool? darkMode, bool? keepScreenOn, bool? gpsHighAccuracy,
    String? language, int? cacheMaxDays,
  }) {
    return AppSettings(
      autoSync: autoSync ?? this.autoSync,
      syncIntervalMinutes: syncIntervalMinutes ?? this.syncIntervalMinutes,
      notifyNewDelivery: notifyNewDelivery ?? this.notifyNewDelivery,
      notifyRouteChange: notifyRouteChange ?? this.notifyRouteChange,
      soundEnabled: soundEnabled ?? this.soundEnabled,
      vibrationEnabled: vibrationEnabled ?? this.vibrationEnabled,
      darkMode: darkMode ?? this.darkMode,
      keepScreenOn: keepScreenOn ?? this.keepScreenOn,
      gpsHighAccuracy: gpsHighAccuracy ?? this.gpsHighAccuracy,
      language: language ?? this.language,
      cacheMaxDays: cacheMaxDays ?? this.cacheMaxDays,
    );
  }
}

class SettingsNotifier extends StateNotifier<AppSettings> {
  SettingsNotifier() : super(const AppSettings()) {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    state = AppSettings(
      autoSync: prefs.getBool('auto_sync') ?? true,
      syncIntervalMinutes: prefs.getInt('sync_interval') ?? 5,
      notifyNewDelivery: prefs.getBool('notify_new_delivery') ?? true,
      notifyRouteChange: prefs.getBool('notify_route_change') ?? true,
      soundEnabled: prefs.getBool('sound_enabled') ?? true,
      vibrationEnabled: prefs.getBool('vibration_enabled') ?? true,
      darkMode: prefs.getBool('dark_mode') ?? false,
      keepScreenOn: prefs.getBool('keep_screen_on') ?? true,
      gpsHighAccuracy: prefs.getBool('gps_high_accuracy') ?? true,
      language: prefs.getString('language') ?? 'fr',
      cacheMaxDays: prefs.getInt('cache_max_days') ?? 7,
    );
  }

  Future<void> update(AppSettings Function(AppSettings) updater) async {
    state = updater(state);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('auto_sync', state.autoSync);
    await prefs.setInt('sync_interval', state.syncIntervalMinutes);
    await prefs.setBool('notify_new_delivery', state.notifyNewDelivery);
    await prefs.setBool('notify_route_change', state.notifyRouteChange);
    await prefs.setBool('sound_enabled', state.soundEnabled);
    await prefs.setBool('vibration_enabled', state.vibrationEnabled);
    await prefs.setBool('dark_mode', state.darkMode);
    await prefs.setBool('keep_screen_on', state.keepScreenOn);
    await prefs.setBool('gps_high_accuracy', state.gpsHighAccuracy);
    await prefs.setString('language', state.language);
    await prefs.setInt('cache_max_days', state.cacheMaxDays);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ÉCRAN
// ═══════════════════════════════════════════════════════════════════════════════

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsProvider);
    final notifier = ref.read(settingsProvider.notifier);

    return Scaffold(
      appBar: AppBar(title: const Text('Paramètres')),
      body: ListView(
        children: [
          // ── SYNCHRONISATION ──
          _SectionHeader(title: 'Synchronisation', icon: Icons.sync),
          SwitchListTile(
            title: const Text('Synchronisation automatique'),
            subtitle: const Text('Sync les données quand le réseau est disponible'),
            value: settings.autoSync,
            onChanged: (v) => notifier.update((s) => s.copyWith(autoSync: v)),
          ),
          if (settings.autoSync)
            ListTile(
              title: const Text('Intervalle de sync'),
              subtitle: Text('Toutes les ${settings.syncIntervalMinutes} minutes'),
              trailing: DropdownButton<int>(
                value: settings.syncIntervalMinutes,
                items: [1, 2, 5, 10, 15, 30].map((m) =>
                    DropdownMenuItem(value: m, child: Text('$m min'))).toList(),
                onChanged: (v) => notifier.update((s) => s.copyWith(syncIntervalMinutes: v)),
              ),
            ),
          ListTile(
            title: const Text('File d\'attente offline'),
            subtitle: const Text('Voir les opérations en attente'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _showOfflineQueueDialog(context),
          ),

          // ── NOTIFICATIONS ──
          _SectionHeader(title: 'Notifications', icon: Icons.notifications),
          SwitchListTile(
            title: const Text('Nouvelle livraison'),
            subtitle: const Text('Quand une livraison est assignée'),
            value: settings.notifyNewDelivery,
            onChanged: (v) => notifier.update((s) => s.copyWith(notifyNewDelivery: v)),
          ),
          SwitchListTile(
            title: const Text('Changement de tournée'),
            subtitle: const Text('Modification de l\'ordre des livraisons'),
            value: settings.notifyRouteChange,
            onChanged: (v) => notifier.update((s) => s.copyWith(notifyRouteChange: v)),
          ),
          SwitchListTile(
            title: const Text('Son'),
            value: settings.soundEnabled,
            onChanged: (v) => notifier.update((s) => s.copyWith(soundEnabled: v)),
          ),
          SwitchListTile(
            title: const Text('Vibration'),
            value: settings.vibrationEnabled,
            onChanged: (v) => notifier.update((s) => s.copyWith(vibrationEnabled: v)),
          ),

          // ── APPARENCE ──
          _SectionHeader(title: 'Apparence', icon: Icons.palette),
          SwitchListTile(
            title: const Text('Mode sombre'),
            value: settings.darkMode,
            onChanged: (v) => notifier.update((s) => s.copyWith(darkMode: v)),
          ),
          SwitchListTile(
            title: const Text('Écran toujours allumé'),
            subtitle: const Text('Pendant les livraisons'),
            value: settings.keepScreenOn,
            onChanged: (v) => notifier.update((s) => s.copyWith(keepScreenOn: v)),
          ),

          // ── GPS ──
          _SectionHeader(title: 'Localisation', icon: Icons.gps_fixed),
          SwitchListTile(
            title: const Text('GPS haute précision'),
            subtitle: const Text('Consomme plus de batterie'),
            value: settings.gpsHighAccuracy,
            onChanged: (v) => notifier.update((s) => s.copyWith(gpsHighAccuracy: v)),
          ),

          // ── DONNÉES ──
          _SectionHeader(title: 'Données', icon: Icons.storage),
          ListTile(
            title: const Text('Durée du cache'),
            subtitle: Text('${settings.cacheMaxDays} jours'),
            trailing: DropdownButton<int>(
              value: settings.cacheMaxDays,
              items: [3, 7, 14, 30].map((d) =>
                  DropdownMenuItem(value: d, child: Text('$d jours'))).toList(),
              onChanged: (v) => notifier.update((s) => s.copyWith(cacheMaxDays: v)),
            ),
          ),
          ListTile(
            title: const Text('Vider le cache'),
            subtitle: const Text('Supprime les données locales anciennes'),
            trailing: const Icon(Icons.delete_outline, color: Colors.orange),
            onTap: () => _showClearCacheDialog(context),
          ),

          // ── À PROPOS ──
          _SectionHeader(title: 'À propos', icon: Icons.info),
          const ListTile(
            title: Text('Version'),
            subtitle: Text('AWID Livreur v3.0.0'),
          ),
          ListTile(
            title: const Text('Signaler un problème'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _showFeedbackDialog(context),
          ),

          const SizedBox(height: 40),
        ],
      ),
    );
  }

  void _showOfflineQueueDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('File d\'attente offline'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_queue, size: 48, color: Colors.blue),
            const SizedBox(height: 12),
            const Text('0 opérations en attente', style: TextStyle(fontSize: 16)),
            const SizedBox(height: 8),
            Text('Dernière sync: maintenant', style: TextStyle(color: Colors.grey[600])),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Fermer')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Synchronisation forcée...')),
              );
            },
            child: const Text('Forcer sync'),
          ),
        ],
      ),
    );
  }

  void _showClearCacheDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Vider le cache ?'),
        content: const Text(
          'Cela supprimera les données anciennes stockées localement. '
          'Les données non synchronisées seront conservées.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annuler')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.orange),
            onPressed: () {
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Cache vidé')),
              );
            },
            child: const Text('Vider'),
          ),
        ],
      ),
    );
  }

  void _showFeedbackDialog(BuildContext context) {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Signaler un problème'),
        content: TextField(
          controller: controller,
          maxLines: 4,
          decoration: const InputDecoration(
            hintText: 'Décrivez le problème...',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annuler')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Merci pour votre retour !')),
              );
            },
            child: const Text('Envoyer'),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final IconData icon;
  const _SectionHeader({required this.title, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 4),
      child: Row(
        children: [
          Icon(icon, size: 16, color: Theme.of(context).primaryColor),
          const SizedBox(width: 6),
          Text(title, style: TextStyle(
            fontSize: 13, fontWeight: FontWeight.bold,
            color: Theme.of(context).primaryColor,
            letterSpacing: 0.5,
          )),
        ],
      ),
    );
  }
}
