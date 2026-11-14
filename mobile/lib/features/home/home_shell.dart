import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';

/// Bottom navigation for hosts (and planning-circle members).
class HomeShell extends ConsumerWidget {
  const HomeShell({super.key, required this.shell});
  final StatefulNavigationShell shell;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: shell.currentIndex,
        onDestinationSelected: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex),
        destinations: [
          NavigationDestination(icon: const Icon(Icons.home_outlined), selectedIcon: const Icon(Icons.home), label: s.t('home')),
          NavigationDestination(icon: const Icon(Icons.grid_view_outlined), selectedIcon: const Icon(Icons.grid_view), label: s.t('tools')),
          NavigationDestination(icon: const Icon(Icons.chat_bubble_outline), selectedIcon: const Icon(Icons.chat_bubble), label: s.t('messages')),
          NavigationDestination(icon: const Icon(Icons.notifications_none), selectedIcon: const Icon(Icons.notifications), label: s.t('alerts')),
          NavigationDestination(icon: const Icon(Icons.person_outline), selectedIcon: const Icon(Icons.person), label: s.t('account')),
        ],
      ),
    );
  }
}

/// App bar title with the event switcher and "plan another occasion".
class EventSwitcher extends ConsumerWidget {
  const EventSwitcher({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final events = ref.watch(eventsProvider).value ?? [];
    final current = ref.watch(currentEventProvider).value;
    final s = ref.watch(stringsProvider);
    return PopupMenuButton<String>(
      tooltip: s.bn ? 'অনুষ্ঠান বদলান' : 'Switch event',
      onSelected: (id) {
        if (id == '__new') {
          context.push('/new-occasion');
        } else {
          ref.read(selectedEventIdProvider.notifier).select(id);
        }
      },
      itemBuilder: (_) => [
        for (final e in events) PopupMenuItem(value: e.id, child: Text(e.title)),
        PopupMenuItem(value: '__new', child: Text(s.bn ? '+ নতুন অনুষ্ঠান' : '+ Plan another occasion')),
      ],
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Flexible(child: Text(current?.title ?? s.t('appName'), overflow: TextOverflow.ellipsis)),
        const Icon(Icons.expand_more),
      ]),
    );
  }
}
