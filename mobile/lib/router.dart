import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/providers.dart';
import 'features/account/account_screen.dart';
import 'features/auth/auth_screens.dart';
import 'features/events/create_event_screen.dart';
import 'features/home/dashboard_screen.dart';
import 'features/home/home_shell.dart';
import 'features/home/tools_screen.dart';
import 'features/messages/messages_screens.dart';
import 'features/onboarding/occasion_screen.dart';
import 'features/tools/tool_screen.dart';
import 'features/vendor/vendor_home.dart';

/// Re-evaluates redirects when the session changes.
class _RouterRefresh extends ChangeNotifier {
  void ping() => notifyListeners();
}

const _public = ['/welcome', '/login', '/register', '/forgot'];

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = _RouterRefresh();
  ref.listen(authProvider, (_, _) => refresh.ping());
  ref.onDispose(refresh.dispose);
  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authProvider);
      final path = state.matchedLocation;
      if (auth is AuthUnknown) return path == '/splash' ? null : '/splash';
      if (auth is SignedOut) return _public.contains(path) ? null : '/welcome';
      final user = (auth as SignedIn).user;
      if (_public.contains(path) || path == '/splash') {
        if (user.isVendor) return '/vendor';
        final occasion = ref.read(chosenOccasionProvider);
        // An occasion chosen before signing up continues straight to event creation.
        return occasion != null ? '/create-event?type=$occasion' : '/home';
      }
      if (user.isVendor && (path == '/home' || path == '/tools')) return '/vendor';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const Scaffold(body: Center(child: CircularProgressIndicator()))),
      // First screen: what are you planning?
      GoRoute(path: '/welcome', builder: (_, _) => const OccasionScreen()),
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, state) => RegisterScreen(role: state.uri.queryParameters['role'] == 'VENDOR' ? 'VENDOR' : 'HOST')),
      GoRoute(path: '/forgot', builder: (_, _) => const ForgotScreen()),
      GoRoute(path: '/new-occasion', builder: (_, _) => const OccasionScreen(forNewEvent: true)),
      GoRoute(path: '/create-event', builder: (_, state) => CreateEventScreen(type: state.uri.queryParameters['type'] ?? 'GENERAL')),
      GoRoute(path: '/tool/:key', builder: (_, state) => ToolScreen(featureKey: state.pathParameters['key']!)),
      GoRoute(path: '/tool-settings', builder: (_, _) => const ToolSettingsScreen()),
      GoRoute(path: '/chat/:id', builder: (_, state) => ChatScreen(id: state.pathParameters['id']!)),
      GoRoute(path: '/vendor', builder: (_, _) => const VendorHome()),
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => HomeShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/home', builder: (_, _) => const DashboardScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/tools', builder: (_, _) => const ToolsScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/messages', builder: (_, _) => const ConversationsScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/alerts', builder: (_, _) => const NotificationsScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/account', builder: (_, _) => const AccountScreen())]),
        ],
      ),
    ],
  );
});
