import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import 'core/app_update.dart';
import 'core/providers.dart';
import 'core/push.dart';
import 'core/theme.dart';
import 'features/messages/messages_screens.dart';
import 'router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  runApp(ProviderScope(overrides: [sharedPrefsProvider.overrideWithValue(prefs)], child: const AyojonApp()));
}

class AyojonApp extends ConsumerWidget {
  const AyojonApp({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final locale = ref.watch(localeProvider);
    // Register for push once signed in; notification taps open the matching screen.
    ref.listen(currentUserProvider, (_, user) {
      if (user == null) return;
      final push = ref.read(pushProvider);
      push.onOpen = (link) {
        final context = router.routerDelegate.navigatorKey.currentContext;
        if (context != null) openLink(context, link);
      };
      push.start();
    });
    return MaterialApp.router(
      title: 'Ayojon',
      debugShowCheckedModeBanner: false,
      theme: ayojonTheme(),
      locale: Locale(locale),
      supportedLocales: const [Locale('bn'), Locale('en')],
      localizationsDelegates: const [GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalCupertinoLocalizations.delegate],
      routerConfig: router,
      builder: (context, child) => _UpdateGate(child: child ?? const SizedBox()),
    );
  }
}

/// Blocks use only when the API says this version is no longer supported.
class _UpdateGate extends ConsumerWidget {
  const _UpdateGate({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final config = ref.watch(appUpdateProvider).value;
    final s = ref.watch(stringsProvider);
    if (config?['updateRequired'] == true || config?['maintenance'] != null) {
      return Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              const Icon(Icons.system_update, size: 48),
              const SizedBox(height: 12),
              Text((config?['maintenance'] as String?) ?? s.t('updateRequired'), textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 16),
              if (config?['storeUrl'] != null)
                FilledButton(onPressed: () => launchUrl(Uri.parse(config!['storeUrl'] as String), mode: LaunchMode.externalApplication), child: Text(s.t('update'))),
            ]),
          ),
        ),
      );
    }
    return child;
  }
}
