// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - ROUTER APP LIVREUR
// Navigation avec GoRouter et Riverpod
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/auth_provider.dart';
import '../screens/auth/login_screen.dart';
import '../screens/route/route_screen.dart';
import '../screens/delivery/delivery_detail_screen.dart';
import '../screens/delivery/complete_delivery_screen.dart';
import '../screens/cash/daily_cash_screen.dart';
import '../screens/profile/profile_screen.dart';
import '../screens/settings/settings_screen.dart';
import '../screens/shell/main_shell.dart';
import '../models/delivery.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// CLÉS DE NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════

final _rootNavigatorKey = GlobalKey<NavigatorState>();
final _shellNavigatorKey = GlobalKey<NavigatorState>();

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER DU ROUTER
// ═══════════════════════════════════════════════════════════════════════════════

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authNotifierProvider);

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/',
    debugLogDiagnostics: true,
    
    // Redirect basé sur l'état d'authentification
    redirect: (context, state) {
      final isAuthenticated = authState.maybeWhen(
        authenticated: (_) => true,
        orElse: () => false,
      );

      final isLoggingIn = state.matchedLocation == '/login';

      // Si pas authentifié et pas sur login, rediriger vers login
      if (!isAuthenticated && !isLoggingIn) {
        return '/login';
      }

      // Si authentifié et sur login, rediriger vers home
      if (isAuthenticated && isLoggingIn) {
        return '/';
      }

      return null;
    },

    routes: [
      // Login
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),

      // Shell avec navigation bottom
      ShellRoute(
        navigatorKey: _shellNavigatorKey,
        builder: (context, state, child) => MainShell(child: child),
        routes: [
          // Tournée du jour (home)
          GoRoute(
            path: '/',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: RouteScreen(),
            ),
            routes: [
              // Détail livraison
              GoRoute(
                path: 'delivery/:id',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) {
                  final deliveryId = state.pathParameters['id']!;
                  return DeliveryDetailScreen(deliveryId: deliveryId);
                },
                routes: [
                  // Compléter livraison
                  GoRoute(
                    path: 'complete',
                    parentNavigatorKey: _rootNavigatorKey,
                    builder: (context, state) {
                      final delivery = state.extra as Delivery;
                      return CompleteDeliveryScreen(delivery: delivery);
                    },
                  ),
                ],
              ),
            ],
          ),

          // Caisse du jour
          GoRoute(
            path: '/cash',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: DailyCashScreen(),
            ),
          ),

          // Profil
          GoRoute(
            path: '/profile',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: ProfileScreen(),
            ),
            routes: [
              // Paramètres
              GoRoute(
                path: 'settings',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) => const SettingsScreen(),
              ),
            ],
          ),
        ],
      ),
    ],

    // Page d'erreur
    errorBuilder: (context, state) => Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 64, color: Colors.red),
            const SizedBox(height: 16),
            Text(
              'Page non trouvée',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(state.uri.toString()),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => context.go('/'),
              child: const Text('Retour à l\'accueil'),
            ),
          ],
        ),
      ),
    ),
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXTENSIONS DE NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════

extension GoRouterExtension on GoRouter {
  void clearStackAndGo(String location) {
    while (canPop()) {
      pop();
    }
    go(location);
  }
}

// Placeholder screens supprimés — vrais écrans dans:
// screens/delivery/delivery_detail_screen.dart
// screens/profile/profile_screen.dart
// screens/settings/settings_screen.dart

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SHELL (Bottom Navigation)
// ═══════════════════════════════════════════════════════════════════════════════

class MainShell extends StatelessWidget {
  final Widget child;

  const MainShell({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _calculateSelectedIndex(context),
        onDestinationSelected: (index) => _onItemTapped(context, index),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.route_outlined),
            selectedIcon: Icon(Icons.route),
            label: 'Tournée',
          ),
          NavigationDestination(
            icon: Icon(Icons.account_balance_wallet_outlined),
            selectedIcon: Icon(Icons.account_balance_wallet),
            label: 'Caisse',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Profil',
          ),
        ],
      ),
    );
  }

  int _calculateSelectedIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    if (location.startsWith('/cash')) return 1;
    if (location.startsWith('/profile')) return 2;
    return 0;
  }

  void _onItemTapped(BuildContext context, int index) {
    switch (index) {
      case 0:
        context.go('/');
        break;
      case 1:
        context.go('/cash');
        break;
      case 2:
        context.go('/profile');
        break;
    }
  }
}
