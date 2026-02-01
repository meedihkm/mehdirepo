// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - APP CLIENT - ÉCRAN PARAMÈTRES
// Configuration de l'application client
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:package_info_plus/package_info_plus.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════

final settingsProvider = StateNotifierProvider<SettingsNotifier, AppSettings>((ref) {
  return SettingsNotifier();
});

final packageInfoProvider = FutureProvider<PackageInfo>((ref) async {
  return await PackageInfo.fromPlatform();
});

// ═══════════════════════════════════════════════════════════════════════════════
// MODELS
// ═══════════════════════════════════════════════════════════════════════════════

class AppSettings {
  final bool notificationsEnabled;
  final bool orderNotifications;
  final bool deliveryNotifications;
  final bool promotionNotifications;
  final String language;
  final bool darkMode;

  AppSettings({
    this.notificationsEnabled = true,
    this.orderNotifications = true,
    this.deliveryNotifications = true,
    this.promotionNotifications = false,
    this.language = 'fr',
    this.darkMode = false,
  });

  AppSettings copyWith({
    bool? notificationsEnabled,
    bool? orderNotifications,
    bool? deliveryNotifications,
    bool? promotionNotifications,
    String? language,
    bool? darkMode,
  }) {
    return AppSettings(
      notificationsEnabled: notificationsEnabled ?? this.notificationsEnabled,
      orderNotifications: orderNotifications ?? this.orderNotifications,
      deliveryNotifications: deliveryNotifications ?? this.deliveryNotifications,
      promotionNotifications: promotionNotifications ?? this.promotionNotifications,
      language: language ?? this.language,
      darkMode: darkMode ?? this.darkMode,
    );
  }
}

class SettingsNotifier extends StateNotifier<AppSettings> {
  SettingsNotifier() : super(AppSettings()) {
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    state = AppSettings(
      notificationsEnabled: prefs.getBool('notificationsEnabled') ?? true,
      orderNotifications: prefs.getBool('orderNotifications') ?? true,
      deliveryNotifications: prefs.getBool('deliveryNotifications') ?? true,
      promotionNotifications: prefs.getBool('promotionNotifications') ?? false,
      language: prefs.getString('language') ?? 'fr',
      darkMode: prefs.getBool('darkMode') ?? false,
    );
  }

  Future<void> _saveSettings() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('notificationsEnabled', state.notificationsEnabled);
    await prefs.setBool('orderNotifications', state.orderNotifications);
    await prefs.setBool('deliveryNotifications', state.deliveryNotifications);
    await prefs.setBool('promotionNotifications', state.promotionNotifications);
    await prefs.setString('language', state.language);
    await prefs.setBool('darkMode', state.darkMode);
  }

  void setNotificationsEnabled(bool value) {
    state = state.copyWith(notificationsEnabled: value);
    _saveSettings();
  }

  void setOrderNotifications(bool value) {
    state = state.copyWith(orderNotifications: value);
    _saveSettings();
  }

  void setDeliveryNotifications(bool value) {
    state = state.copyWith(deliveryNotifications: value);
    _saveSettings();
  }

  void setPromotionNotifications(bool value) {
    state = state.copyWith(promotionNotifications: value);
    _saveSettings();
  }

  void setLanguage(String value) {
    state = state.copyWith(language: value);
    _saveSettings();
  }

  void setDarkMode(bool value) {
    state = state.copyWith(darkMode: value);
    _saveSettings();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ÉCRAN PARAMÈTRES
// ═══════════════════════════════════════════════════════════════════════════════

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsProvider);
    final packageInfo = ref.watch(packageInfoProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Paramètres'),
      ),
      body: ListView(
        children: [
          // Section Notifications
          _SectionHeader(title: 'Notifications'),
          SwitchListTile(
            title: const Text('Activer les notifications'),
            subtitle: const Text('Recevoir des notifications push'),
            value: settings.notificationsEnabled,
            onChanged: (value) {
              ref.read(settingsProvider.notifier).setNotificationsEnabled(value);
            },
          ),
          if (settings.notificationsEnabled) ...[
            SwitchListTile(
              title: const Text('Notifications de commandes'),
              subtitle: const Text('Confirmation et mises à jour des commandes'),
              value: settings.orderNotifications,
              onChanged: (value) {
                ref.read(settingsProvider.notifier).setOrderNotifications(value);
              },
            ),
            SwitchListTile(
              title: const Text('Notifications de livraison'),
              subtitle: const Text('Suivi en temps réel des livraisons'),
              value: settings.deliveryNotifications,
              onChanged: (value) {
                ref.read(settingsProvider.notifier).setDeliveryNotifications(value);
              },
            ),
            SwitchListTile(
              title: const Text('Notifications promotions'),
              subtitle: const Text('Offres spéciales et réductions'),
              value: settings.promotionNotifications,
              onChanged: (value) {
                ref.read(settingsProvider.notifier).setPromotionNotifications(value);
              },
            ),
          ],
          const Divider(),

          // Section Apparence
          _SectionHeader(title: 'Apparence'),
          SwitchListTile(
            title: const Text('Mode sombre'),
            subtitle: const Text('Thème sombre pour l\'application'),
            value: settings.darkMode,
            onChanged: (value) {
              ref.read(settingsProvider.notifier).setDarkMode(value);
            },
          ),
          ListTile(
            title: const Text('Langue'),
            subtitle: Text(_getLanguageName(settings.language)),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _showLanguageDialog(context, ref, settings.language),
          ),
          const Divider(),

          // Section Données
          _SectionHeader(title: 'Données'),
          ListTile(
            leading: const Icon(Icons.cached),
            title: const Text('Vider le cache'),
            subtitle: const Text('Libérer de l\'espace de stockage'),
            onTap: () => _showClearCacheDialog(context),
          ),
          ListTile(
            leading: const Icon(Icons.sync),
            title: const Text('Synchroniser les données'),
            subtitle: const Text('Mettre à jour les données hors-ligne'),
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Synchronisation en cours...')),
              );
            },
          ),
          const Divider(),

          // Section Support
          _SectionHeader(title: 'Support'),
          ListTile(
            leading: const Icon(Icons.help_outline),
            title: const Text('Centre d\'aide'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              // TODO: Navigate to help
            },
          ),
          ListTile(
            leading: const Icon(Icons.feedback_outlined),
            title: const Text('Envoyer un feedback'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _showFeedbackDialog(context),
          ),
          ListTile(
            leading: const Icon(Icons.phone_outlined),
            title: const Text('Contacter le support'),
            subtitle: const Text('0555 123 456'),
            onTap: () {
              // TODO: Launch phone dialer
            },
          ),
          const Divider(),

          // Section À propos
          _SectionHeader(title: 'À propos'),
          ListTile(
            leading: const Icon(Icons.description_outlined),
            title: const Text('Conditions d\'utilisation'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              // TODO: Navigate to terms
            },
          ),
          ListTile(
            leading: const Icon(Icons.privacy_tip_outlined),
            title: const Text('Politique de confidentialité'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              // TODO: Navigate to privacy
            },
          ),
          packageInfo.when(
            data: (info) => ListTile(
              leading: const Icon(Icons.info_outline),
              title: const Text('Version'),
              subtitle: Text('${info.version} (${info.buildNumber})'),
            ),
            loading: () => const ListTile(
              leading: Icon(Icons.info_outline),
              title: Text('Version'),
              subtitle: Text('Chargement...'),
            ),
            error: (_, __) => const ListTile(
              leading: Icon(Icons.info_outline),
              title: Text('Version'),
              subtitle: Text('1.0.0'),
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  String _getLanguageName(String code) {
    switch (code) {
      case 'fr':
        return 'Français';
      case 'ar':
        return 'العربية';
      case 'en':
        return 'English';
      default:
        return code;
    }
  }

  void _showLanguageDialog(BuildContext context, WidgetRef ref, String currentLanguage) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Choisir la langue'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _LanguageOption(
              name: 'Français',
              code: 'fr',
              isSelected: currentLanguage == 'fr',
              onTap: () {
                ref.read(settingsProvider.notifier).setLanguage('fr');
                Navigator.pop(context);
              },
            ),
            _LanguageOption(
              name: 'العربية',
              code: 'ar',
              isSelected: currentLanguage == 'ar',
              onTap: () {
                ref.read(settingsProvider.notifier).setLanguage('ar');
                Navigator.pop(context);
              },
            ),
            _LanguageOption(
              name: 'English',
              code: 'en',
              isSelected: currentLanguage == 'en',
              onTap: () {
                ref.read(settingsProvider.notifier).setLanguage('en');
                Navigator.pop(context);
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showClearCacheDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Vider le cache'),
        content: const Text(
          'Cela supprimera les images et données temporaires. '
          'Vos informations de compte seront conservées.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Annuler'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Cache vidé avec succès')),
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
      builder: (context) => AlertDialog(
        title: const Text('Envoyer un feedback'),
        content: TextField(
          controller: controller,
          maxLines: 5,
          decoration: const InputDecoration(
            hintText: 'Dites-nous ce que vous pensez de l\'application...',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Annuler'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Merci pour votre feedback !')),
              );
            },
            child: const Text('Envoyer'),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGETS HELPER
// ═══════════════════════════════════════════════════════════════════════════════

class _SectionHeader extends StatelessWidget {
  final String title;

  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.bold,
          color: Theme.of(context).primaryColor,
        ),
      ),
    );
  }
}

class _LanguageOption extends StatelessWidget {
  final String name;
  final String code;
  final bool isSelected;
  final VoidCallback onTap;

  const _LanguageOption({
    required this.name,
    required this.code,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Text(name),
      trailing: isSelected
          ? Icon(Icons.check, color: Theme.of(context).primaryColor)
          : null,
      onTap: onTap,
    );
  }
}
