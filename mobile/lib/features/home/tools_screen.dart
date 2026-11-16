import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';
import '../../core/widgets/common.dart';
import 'home_shell.dart';

const toolIcons = <String, IconData>{
  'checklist': Icons.checklist,
  'budget': Icons.account_balance_wallet_outlined,
  'timeline': Icons.calendar_month_outlined,
  'datePlanner': Icons.event_available_outlined,
  'costSplit': Icons.balance_outlined,
  'gifts': Icons.redeem_outlined,
  'inspiration': Icons.palette_outlined,
  'guests': Icons.people_outline,
  'sides': Icons.favorite_border,
  'households': Icons.home_outlined,
  'invitations': Icons.mail_outline,
  'seating': Icons.event_seat_outlined,
  'logistics': Icons.flight_outlined,
  'checkIn': Icons.qr_code_scanner,
  'vendors': Icons.storefront_outlined,
  'shortlist': Icons.bookmark_border,
  'bookings': Icons.event_note_outlined,
  'quotes': Icons.request_quote_outlined,
  'contracts': Icons.draw_outlined,
  'finance': Icons.receipt_long_outlined,
  'runSheet': Icons.timer_outlined,
  'vendorPortal': Icons.local_shipping_outlined,
  'catering': Icons.restaurant_outlined,
  'photoWall': Icons.photo_camera_outlined,
  'livestream': Icons.live_tv_outlined,
  'website': Icons.language,
  'collaboration': Icons.group_add_outlined,
  'automations': Icons.bolt_outlined,
  'insights': Icons.insights_outlined,
};

/// The selected event's tools, grouped. Only tools of its occasion appear;
/// more can be switched on from "Add more tools".
class ToolsScreen extends ConsumerWidget {
  const ToolsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final event = ref.watch(currentEventProvider);
    final catalog = ref.watch(catalogProvider);
    return Scaffold(
      appBar: AppBar(title: const EventSwitcher()),
      body: AsyncView(
        value: catalog,
        onRetry: () => ref.invalidate(catalogProvider),
        builder: (cat) => AsyncView(
          value: event,
          builder: (e) {
            if (e == null) return const SizedBox();
            return ListView(padding: const EdgeInsets.all(16), children: [
              for (final group in cat.groups) ...() {
                final items = cat.features.where((f) => f.group == group.key && e.has(f.key)).toList();
                if (items.isEmpty) return <Widget>[];
                return [
                  Padding(padding: const EdgeInsets.fromLTRB(4, 12, 4, 6), child: Text(s.bn ? group.labelBn : group.label, style: Theme.of(context).textTheme.titleSmall)),
                  GridView.count(
                    crossAxisCount: 3,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 8,
                    crossAxisSpacing: 8,
                    children: [
                      for (final f in items)
                        Card(
                          child: InkWell(
                            borderRadius: BorderRadius.circular(16),
                            onTap: () => context.push('/tool/${f.key}'),
                            child: Padding(
                              padding: const EdgeInsets.all(8),
                              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                                Icon(toolIcons[f.key] ?? Icons.auto_awesome_outlined, color: Theme.of(context).colorScheme.primary),
                                const SizedBox(height: 6),
                                Text(s.bn ? f.labelBn : f.label, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.labelMedium),
                              ]),
                            ),
                          ),
                        ),
                    ],
                  ),
                ];
              }(),
              const SizedBox(height: 12),
              if (!e.readOnly)
                OutlinedButton.icon(onPressed: () => context.push('/tool-settings'), icon: const Icon(Icons.tune), label: Text(s.bn ? 'আরও টুল যোগ করুন' : 'Add more tools')),
            ]);
          },
        ),
      ),
    );
  }
}

/// Switch tools on or off for this event (same rules as the website).
class ToolSettingsScreen extends ConsumerWidget {
  const ToolSettingsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final event = ref.watch(currentEventProvider).value;
    final catalog = ref.watch(catalogProvider).value;
    final types = ref.watch(eventTypesProvider).value ?? [];
    if (event == null || catalog == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final defaults = types.where((t) => t.type == event.eventType).firstOrNull?.features ?? const [];
    final enabled = List<String>.from((event.raw['enabledFeatures'] ?? const []) as List);
    final disabled = List<String>.from((event.raw['disabledFeatures'] ?? const []) as List);
    Future<void> toggle(String key, bool on) async {
      final e = {...enabled}, d = {...disabled};
      if (on) {
        d.remove(key);
        if (!defaults.contains(key)) e.add(key);
      } else {
        e.remove(key);
        if (defaults.contains(key)) d.add(key);
      }
      await attempt(context, () async {
        await ref.read(apiProvider).patch('events/${event.id}', {'enabledFeatures': e.toList(), 'disabledFeatures': d.toList()});
        refreshEvent(ref);
      });
    }

    return Scaffold(
      appBar: AppBar(title: Text(s.bn ? 'এই অনুষ্ঠানের টুল' : 'Tools for this event')),
      body: ListView(children: [
        for (final f in catalog.features.where((f) => !f.core))
          SwitchListTile(
            value: event.has(f.key),
            title: Text(s.bn ? f.labelBn : f.label),
            subtitle: Text(f.description + (defaults.contains(f.key) ? (s.bn ? ' · প্রস্তাবিত' : ' · suggested') : '')),
            onChanged: (on) => toggle(f.key, on),
          ),
      ]),
    );
  }
}
