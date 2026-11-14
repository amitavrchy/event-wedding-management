import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config.dart';
import '../../core/format.dart';
import '../../core/providers.dart';
import '../../core/widgets/common.dart';
import '../../models/models.dart';
import '../account/account_screen.dart';
import '../messages/messages_screens.dart';
import '../tools/more_tools.dart';

final myBusinessesProvider = FutureProvider.autoDispose<List<Json>>((ref) async => List<Json>.from(await ref.read(apiProvider).get<List<dynamic>>('vendors/mine')));
final businessIndexProvider = NotifierProvider<_BusinessIndex, int>(_BusinessIndex.new);

class _BusinessIndex extends Notifier<int> {
  @override
  int build() => 0;
  void set(int value) => state = value;
}

/// Vendor app: inquiries, bookings, messages and the monthly report. Plans
/// are bought on the website (no in-app purchase).
class VendorHome extends ConsumerStatefulWidget {
  const VendorHome({super.key});
  @override
  ConsumerState<VendorHome> createState() => _VendorHomeState();
}

class _VendorHomeState extends ConsumerState<VendorHome> {
  int tab = 0;
  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final pages = [const _InquiriesTab(), const BookingsScreen(), const ConversationsScreen(), const _BusinessTab(), const AccountScreen()];
    return Scaffold(
      body: pages[tab],
      bottomNavigationBar: NavigationBar(
        selectedIndex: tab,
        onDestinationSelected: (i) => setState(() => tab = i),
        destinations: [
          NavigationDestination(icon: const Icon(Icons.inbox_outlined), label: s.t('inquiries')),
          NavigationDestination(icon: const Icon(Icons.event_note_outlined), label: s.t('bookings')),
          NavigationDestination(icon: const Icon(Icons.chat_bubble_outline), label: s.t('messages')),
          NavigationDestination(icon: const Icon(Icons.storefront_outlined), label: s.bn ? 'ব্যবসা' : 'Business'),
          NavigationDestination(icon: const Icon(Icons.person_outline), label: s.t('account')),
        ],
      ),
    );
  }
}

Json? _current(WidgetRef ref) {
  final list = ref.watch(myBusinessesProvider).value ?? [];
  if (list.isEmpty) return null;
  return list[ref.watch(businessIndexProvider).clamp(0, list.length - 1)];
}

final _inquiriesProvider = FutureProvider.autoDispose.family<Json, String>((ref, vendorId) => ref.read(apiProvider).get<Json>('vendors/$vendorId/inquiries', query: {'limit': 50}));

class _InquiriesTab extends ConsumerWidget {
  const _InquiriesTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final business = _current(ref);
    return Scaffold(
      appBar: AppBar(title: Text(s.t('inquiries'))),
      body: business == null
          ? AsyncView(value: ref.watch(myBusinessesProvider), builder: (_) => EmptyState(s.bn ? 'ওয়েবসাইট থেকে ব্যবসা যোগ করুন' : 'Add your business on the website'))
          : RefreshIndicator(
              onRefresh: () async => ref.invalidate(_inquiriesProvider(business['id'] as String)),
              child: AsyncView(
                value: ref.watch(_inquiriesProvider(business['id'] as String)),
                builder: (data) {
                  final items = List<Json>.from(data['items'] as List);
                  if (items.isEmpty) return ListView(children: [EmptyState(s.t('empty'))]);
                  return ListView(padding: const EdgeInsets.all(12), children: [
                    for (final i in items)
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Row(children: [Expanded(child: Text(i['name'] as String, style: Theme.of(context).textTheme.titleSmall)), Chip(label: Text((i['status'] as String).toLowerCase()))]),
                            Text([
                              if (i['eventDate'] != null) dateLabel(DateTime.parse(i['eventDate'] as String).toLocal(), locale: s.locale),
                              if (i['guestCount'] != null) '${i['guestCount']} ${s.t('guests')}',
                              if (i['budgetMinor'] != null) taka(i['budgetMinor'] as int),
                            ].join(' · ')),
                            const SizedBox(height: 6),
                            Text(i['message'] as String),
                            Wrap(spacing: 8, children: [
                              if (i['conversationId'] != null) TextButton.icon(onPressed: () => context.push('/chat/${i['conversationId']}'), icon: const Icon(Icons.reply), label: Text(s.bn ? 'উত্তর দিন' : 'Reply')),
                              if (i['phone'] != null) TextButton.icon(onPressed: () => launchUrl(Uri.parse('tel:${i['phone']}')), icon: const Icon(Icons.call_outlined), label: Text('${i['phone']}')),
                            ]),
                          ]),
                        ),
                      ),
                  ]);
                },
              ),
            ),
    );
  }
}

final _reportProvider = FutureProvider.autoDispose.family<Json, String>((ref, vendorId) => ref.read(apiProvider).get<Json>('vendors/$vendorId/report'));

class _BusinessTab extends ConsumerWidget {
  const _BusinessTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final businesses = ref.watch(myBusinessesProvider).value ?? [];
    final business = _current(ref);
    if (business == null) return Scaffold(appBar: AppBar(), body: EmptyState(s.t('empty')));
    final report = ref.watch(_reportProvider(business['id'] as String));
    return Scaffold(
      appBar: AppBar(
        title: businesses.length > 1
            ? DropdownButton<int>(
                value: ref.watch(businessIndexProvider).clamp(0, businesses.length - 1),
                underline: const SizedBox(),
                items: [for (var i = 0; i < businesses.length; i++) DropdownMenuItem(value: i, child: Text(businesses[i]['businessName'] as String))],
                onChanged: (i) => ref.read(businessIndexProvider.notifier).set(i ?? 0),
              )
            : Text(business['businessName'] as String),
      ),
      body: ListView(padding: const EdgeInsets.all(12), children: [
        Card(
          child: AsyncView(
            value: report,
            builder: (r) => Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${s.t('report')} (${r['month']})', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                Text('${s.t('inquiries')}: ${r['inquiries']} · ${s.bn ? 'উত্তরের হার' : 'reply rate'} ${r['responseRate'] ?? '—'}%'),
                Text('${s.t('bookings')}: ${r['bookings']} · ${taka(r['bookedValueMinor'] as int)}'),
                if (r['averageResponseMinutes'] != null) Text('${s.bn ? 'গড় উত্তর' : 'Average reply'}: ${r['averageResponseMinutes']} min'),
              ]),
            ),
          ),
        ),
        ListTile(
          leading: const Icon(Icons.add_a_photo_outlined),
          title: Text(s.bn ? 'পোর্টফোলিওতে ছবি যোগ' : 'Add portfolio photos'),
          onTap: () async {
            final files = await ImagePicker().pickMultiImage(maxWidth: 2400, imageQuality: 85);
            if (files.isEmpty || !context.mounted) return;
            await attempt(context, () async {
              final api = ref.read(apiProvider);
              final ids = <String>[];
              for (final f in files) {
                ids.add((await api.upload(await f.readAsBytes(), 'image/jpeg', 'VENDOR_PORTFOLIO', fileName: 'photo.jpg'))['id'] as String);
              }
              await api.patch('vendors/${business['id']}', {'gallery': [...List<String>.from((business['gallery'] ?? const []) as List), ...ids]});
              ref.invalidate(myBusinessesProvider);
            }, success: s.bn ? 'ছবি যোগ হয়েছে' : 'Photos added');
          },
        ),
        ListTile(
          leading: const Icon(Icons.workspace_premium_outlined),
          title: Text('${s.t('plan')}: ${business['planCode'] ?? 'Free'}'),
          subtitle: Text(s.t('planWebOnly')),
        ),
        ListTile(
          leading: const Icon(Icons.open_in_new),
          title: Text(s.bn ? 'প্রোফাইল, সার্ভিস ও ক্যালেন্ডার' : 'Profile, services and calendar'),
          subtitle: Text(s.t('webOnly')),
          onTap: () => launchUrl(Uri.parse('${AppConfig.webUrl}/studio'), mode: LaunchMode.externalApplication),
        ),
        ListTile(leading: const Icon(Icons.notifications_none), title: Text(s.t('alerts')), onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const NotificationsScreen()))),
      ]),
    );
  }
}
