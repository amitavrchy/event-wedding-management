import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format.dart';
import '../../core/providers.dart';
import '../../core/widgets/common.dart';
import '../onboarding/occasion_screen.dart';
import 'home_shell.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final user = ref.watch(currentUserProvider);
    final events = ref.watch(eventsProvider);
    // A host with no event starts by choosing the occasion.
    if (events.hasValue && events.value!.isEmpty) return const OccasionScreen(forNewEvent: true);
    final event = ref.watch(currentEventProvider);
    return Scaffold(
      appBar: AppBar(title: const EventSwitcher()),
      body: RefreshIndicator(
        onRefresh: () async => refreshEvent(ref),
        child: AsyncView(
          value: event,
          onRetry: () => refreshEvent(ref),
          builder: (e) {
            if (e == null) return const SizedBox();
            final tasks = List<Map>.from((e.raw['tasks'] ?? const []) as List);
            final guests = List<Map>.from((e.raw['guests'] ?? const []) as List);
            final expenses = List<Map>.from((e.raw['expenses'] ?? const []) as List);
            final done = tasks.where((t) => t['done'] == true).length;
            final attending = guests.where((g) => g['rsvpStatus'] == 'ACCEPTED').fold<int>(0, (n, g) => n + ((g['partySize'] ?? 1) as int));
            final spent = expenses.fold<int>(0, (n, x) => n + ((x['amountMinor'] ?? 0) as int));
            final next = e.days.where((d) => d.startsAt.isAfter(DateTime.now())).firstOrNull;
            final open = tasks.where((t) => t['done'] != true).take(5).toList();
            return ListView(padding: const EdgeInsets.all(16), children: [
              Text('${s.bn ? 'শুভেচ্ছা' : 'Hello'}, ${user?.fullName.split(' ').first ?? ''}', style: Theme.of(context).textTheme.headlineSmall),
              if (next != null)
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.event),
                    title: Text(next.name),
                    subtitle: Text('${dateTimeLabel(next.startsAt, locale: s.locale)}${next.venueName != null ? ' · ${next.venueName}' : ''}'),
                    trailing: Text('${next.startsAt.difference(DateTime.now()).inDays} ${s.t('daysToGo')}'),
                  ),
                ),
              Row(children: [
                StatTile(value: '$attending', label: s.t('attending'), icon: Icons.people_outline),
                StatTile(value: '$done/${tasks.length}', label: s.t('tasksDone'), icon: Icons.checklist),
                StatTile(value: taka(spent, compact: true), label: s.t('spent'), icon: Icons.account_balance_wallet_outlined),
              ]),
              const SizedBox(height: 12),
              Text(s.t('nextSteps'), style: Theme.of(context).textTheme.titleMedium),
              for (final t in open)
                Card(
                  child: CheckboxListTile(
                    value: false,
                    title: Text(t['title'] as String),
                    onChanged: e.readOnly
                        ? null
                        : (_) => attempt(context, () async {
                              await ref.read(apiProvider).patch('events/${e.id}/tasks/${t['id']}', {'done': true});
                              refreshEvent(ref);
                            }),
                  ),
                ),
              if (open.isEmpty) EmptyState(s.bn ? 'সব কাজ শেষ!' : 'All caught up!'),
              TextButton(onPressed: () => context.push('/tool/checklist'), child: Text(s.bn ? 'পুরো চেকলিস্ট' : 'Full checklist')),
            ]);
          },
        ),
      ),
    );
  }
}
