import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config.dart';
import '../../core/format.dart';
import '../../core/providers.dart';
import '../../core/ui/spacing.dart';
import '../../core/widgets/common.dart';
import '../../models/models.dart';
import '../account/account_screen.dart';
import '../messages/messages_screens.dart';
import '../tools/more_tools.dart';

final myBusinessesProvider = FutureProvider.autoDispose<List<Json>>(
  (ref) async => List<Json>.from(
    await ref.read(apiProvider).get<List<dynamic>>('vendors/mine'),
  ),
);
final businessIndexProvider = NotifierProvider<_BusinessIndex, int>(
  _BusinessIndex.new,
);

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
    final pages = [
      const _InquiriesTab(),
      const BookingsScreen(),
      const ConversationsScreen(),
      const _BusinessTab(),
      const AccountScreen(),
    ];
    return Scaffold(
      body: SafeArea(bottom: false, child: pages[tab]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: tab,
        onDestinationSelected: (i) => setState(() => tab = i),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.inbox_outlined),
            label: s.t('inquiries'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.event_note_outlined),
            label: s.t('bookings'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.chat_bubble_outline),
            label: s.t('messages'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.storefront_outlined),
            label: s.t('textBusiness'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.person_outline),
            label: s.t('account'),
          ),
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

final _inquiriesProvider = FutureProvider.autoDispose.family<Json, String>(
  (ref, vendorId) => ref
      .read(apiProvider)
      .get<Json>('vendors/$vendorId/inquiries', query: {'limit': 50}),
);

class _InquiriesTab extends ConsumerWidget {
  const _InquiriesTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final business = _current(ref);
    return Scaffold(
      appBar: AppBar(title: Text(s.t('inquiries'))),
      body: business == null
          ? AsyncView(
              value: ref.watch(myBusinessesProvider),
              builder: (_) => EmptyState(s.t('textAddYourBusinessOnThe')),
            )
          : RefreshIndicator(
              onRefresh: () async =>
                  ref.invalidate(_inquiriesProvider(business['id'] as String)),
              child: AsyncView(
                value: ref.watch(_inquiriesProvider(business['id'] as String)),
                builder: (data) {
                  final items = List<Json>.from(data['items'] as List);
                  if (items.isEmpty) {
                    return ListView(children: [EmptyState(s.t('empty'))]);
                  }
                  return ListView(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.page,
                      AppSpacing.page,
                      AppSpacing.page,
                      AppSpacing.xl,
                    ),
                    children: [
                      for (final i in items)
                        Card(
                          child: Padding(
                            padding: const EdgeInsets.all(AppSpacing.page),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Wrap(
                                  spacing: AppSpacing.sm,
                                  crossAxisAlignment: WrapCrossAlignment.center,
                                  children: [
                                    Text(
                                      i['name'] as String,
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleSmall,
                                    ),
                                    Chip(
                                      label: Text(
                                        s.codeLabel(i['status'] as String),
                                      ),
                                    ),
                                  ],
                                ),
                                Text(
                                  [
                                    if (i['eventDate'] != null)
                                      dateLabel(
                                        DateTime.parse(i['eventDate'] as String)
                                            .toLocal(),
                                        locale: s.locale,
                                      ),
                                    if (i['guestCount'] != null)
                                      s.format('guestCount', {
                                        'count': numberLabel(
                                          i['guestCount'] as num,
                                          locale: s.locale,
                                        ),
                                      }),
                                    if (i['budgetMinor'] != null)
                                      taka(
                                        i['budgetMinor'] as int,
                                        locale: s.locale,
                                      ),
                                  ].join(' · '),
                                ),
                                const SizedBox(height: AppSpacing.sm),
                                Text(i['message'] as String),
                                Wrap(
                                  spacing: AppSpacing.sm,
                                  children: [
                                    if (i['conversationId'] != null)
                                      TextButton.icon(
                                        onPressed: () => context.push(
                                          '/chat/${i['conversationId']}',
                                        ),
                                        icon: const Icon(Icons.reply),
                                        label: Text(s.t('textReply')),
                                      ),
                                    if (i['phone'] != null)
                                      TextButton.icon(
                                        onPressed: () => launchUrl(
                                          Uri.parse('tel:${i['phone']}'),
                                        ),
                                        icon: const Icon(Icons.call_outlined),
                                        label: Text(
                                          numberLabelPhone(
                                            i['phone'] as String,
                                            locale: s.locale,
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  );
                },
              ),
            ),
    );
  }
}

final _reportProvider = FutureProvider.autoDispose.family<Json, String>(
  (ref, vendorId) =>
      ref.read(apiProvider).get<Json>('vendors/$vendorId/report'),
);

class _BusinessTab extends ConsumerWidget {
  const _BusinessTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final businesses = ref.watch(myBusinessesProvider).value ?? [];
    final business = _current(ref);
    if (business == null) {
      return Scaffold(appBar: AppBar(), body: EmptyState(s.t('empty')));
    }
    final report = ref.watch(_reportProvider(business['id'] as String));
    return Scaffold(
      appBar: AppBar(
        title: businesses.length > 1
            ? DropdownButton<int>(
                isExpanded: true,
                value: ref
                    .watch(businessIndexProvider)
                    .clamp(0, businesses.length - 1),
                underline: const SizedBox(),
                items: [
                  for (var i = 0; i < businesses.length; i++)
                    DropdownMenuItem(
                      value: i,
                      child: Text(
                        businesses[i]['businessName'] as String,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                ],
                onChanged: (i) =>
                    ref.read(businessIndexProvider.notifier).set(i ?? 0),
              )
            : Text(business['businessName'] as String),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.page,
          AppSpacing.page,
          AppSpacing.page,
          AppSpacing.xl,
        ),
        children: [
          Card(
            child: AsyncView(
              value: report,
              builder: (r) => Padding(
                padding: const EdgeInsets.all(AppSpacing.page),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      s.format('reportMonth', {
                        'month': monthLabel(
                          DateTime.parse('${r['month']}-01'),
                          locale: s.locale,
                        ),
                      }),
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      s.format('reportInquiries', {
                        'count': numberLabel(
                          r['inquiries'] as num,
                          locale: s.locale,
                        ),
                        'rate': r['responseRate'] == null
                            ? '—'
                            : s.percentage(
                                numberLabel(
                                  r['responseRate'] as num,
                                  locale: s.locale,
                                ),
                              ),
                      }),
                    ),
                    Text(
                      s.format('reportBookings', {
                        'count': numberLabel(
                          r['bookings'] as num,
                          locale: s.locale,
                        ),
                        'value': taka(
                          r['bookedValueMinor'] as int,
                          locale: s.locale,
                        ),
                      }),
                    ),
                    if (r['averageResponseMinutes'] != null)
                      Text(
                        s.format('reportAverage', {
                          'count': numberLabel(
                            r['averageResponseMinutes'] as num,
                            locale: s.locale,
                          ),
                        }),
                      ),
                  ],
                ),
              ),
            ),
          ),
          ListTile(
            leading: const Icon(Icons.add_a_photo_outlined),
            title: Text(s.t('textAddPortfolioPhotos')),
            onTap: () async {
              final files = await ImagePicker().pickMultiImage(
                maxWidth: 2400,
                imageQuality: 85,
              );
              if (files.isEmpty || !context.mounted) return;
              await attempt(context, () async {
                final api = ref.read(apiProvider);
                final ids = <String>[];
                for (final f in files) {
                  ids.add(
                    (await api.upload(
                          await f.readAsBytes(),
                          'image/jpeg',
                          'VENDOR_PORTFOLIO',
                          fileName: 'photo.jpg',
                        ))['id']
                        as String,
                  );
                }
                await api.patch('vendors/${business['id']}', {
                  'gallery': [
                    ...List<String>.from(
                      (business['gallery'] ?? const []) as List,
                    ),
                    ...ids,
                  ],
                });
                ref.invalidate(myBusinessesProvider);
              }, success: s.t('textPhotosAdded'));
            },
          ),
          ListTile(
            leading: const Icon(Icons.workspace_premium_outlined),
            title: Text(
              s.format('planLabel', {
                'plan': s.codeLabel(
                  (business['planCode'] as String?) ?? 'FREE',
                ),
              }),
            ),
            subtitle: Text(s.t('planWebOnly')),
          ),
          ListTile(
            leading: const Icon(Icons.open_in_new),
            title: Text(s.t('textProfileServicesAndCalendar')),
            subtitle: Text(s.t('webOnly')),
            onTap: () => launchUrl(
              Uri.parse('${AppConfig.webUrl}/studio'),
              mode: LaunchMode.externalApplication,
            ),
          ),
          ListTile(
            leading: const Icon(Icons.notifications_none),
            title: Text(s.t('alerts')),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const NotificationsScreen()),
            ),
          ),
        ],
      ),
    );
  }
}
