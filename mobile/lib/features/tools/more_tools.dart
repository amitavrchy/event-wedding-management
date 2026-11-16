import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config.dart';
import '../../core/format.dart';
import '../../core/providers.dart';
import '../../core/ui/spacing.dart';
import '../../core/widgets/common.dart';
import '../../models/models.dart';
import 'planning_tools.dart';

// ---------------------------------------------------------------------------
class CateringScreen extends ConsumerStatefulWidget {
  const CateringScreen({super.key});
  @override
  ConsumerState<CateringScreen> createState() => _CateringScreenState();
}

class _CateringScreenState extends ConsumerState<CateringScreen> {
  int buffer = 10;
  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final data = ref.watch(eventResource('events/:id/catering?buffer=$buffer'));
    Widget plan(String title, Map p) => Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.page),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            Text(
              numberLabel(p['recommendedPlates'] as num, locale: s.locale),
              style: Theme.of(context).textTheme.displaySmall,
            ),
            Text(
              s.platesConfirmed(
                numberLabel(p['confirmedPeople'] as num, locale: s.locale),
              ),
            ),
            const Divider(),
            for (final m in (p['meals'] as Map).entries)
              Row(
                children: [
                  Expanded(child: Text(s.codeLabel(m.key.toString()))),
                  Text(numberLabel(m.value as num, locale: s.locale)),
                ],
              ),
          ],
        ),
      ),
    );
    return Scaffold(
      appBar: AppBar(title: Text(s.t('textCateringHeadcount'))),
      body: SafeArea(
        child: AsyncView(
          value: data,
          builder: (d) {
            if (d == null) return const SizedBox();
            return ListView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.page,
                AppSpacing.page,
                AppSpacing.page,
                AppSpacing.xl + AppSpacing.page,
              ),
              children: [
                Text(s.bufferLabel(numberLabel(buffer, locale: s.locale))),
                Slider(
                  value: buffer.toDouble(),
                  min: 0,
                  max: 30,
                  divisions: 6,
                  label: s.percentage(numberLabel(buffer, locale: s.locale)),
                  onChanged: (v) => setState(() => buffer = v.round()),
                ),
                plan(s.t('textWholeEvent'), d['overall'] as Map),
                for (final day in d['days'] as List)
                  plan('${day['name']}', day as Map),
                OutlinedButton.icon(
                  onPressed: () {
                    final lines = [
                      for (final day in d['days'] as List)
                        s.cateringShare(
                          '${day['name']}',
                          numberLabel(
                            day['recommendedPlates'] as num,
                            locale: s.locale,
                          ),
                          (day['meals'] as Map).entries
                              .map(
                                (m) => s.mealCount(
                                  s.codeLabel(m.key.toString()),
                                  numberLabel(m.value as num, locale: s.locale),
                                ),
                              )
                              .join(', '),
                        ),
                    ];
                    SharePlus.instance.share(
                      ShareParams(text: lines.join('\n')),
                    );
                  },
                  icon: const Icon(Icons.share_outlined),
                  label: Text(s.t('textSendToCaterer')),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
class CostSplitScreen extends ConsumerWidget {
  const CostSplitScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final data = ref.watch(eventResource('events/:id/cost-split'));
    return Scaffold(
      appBar: AppBar(title: Text(s.t('textFamilyCostSplit'))),
      body: SafeArea(
        child: AsyncView(
          value: data,
          builder: (d) {
            if (d == null) return const SizedBox();
            final labels = d['labels'] as Map,
                settlement = d['settlement'] as Map?;
            return ListView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.page,
                AppSpacing.page,
                AppSpacing.page,
                AppSpacing.xl + AppSpacing.page,
              ),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpacing.page),
                    child: Column(
                      children: [
                        const Icon(Icons.balance, size: 36),
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          settlement == null
                              ? (s.t('textBothFamiliesAreEven'))
                              : s.settlement(
                                  s.familyLabel(
                                    settlement['from'] as String,
                                    labels[settlement['from']] as String,
                                  ),
                                  s.familyLabel(
                                    settlement['to'] as String,
                                    labels[settlement['to']] as String,
                                  ),
                                  taka(
                                    settlement['amountMinor'] as int,
                                    locale: s.locale,
                                  ),
                                ),
                          style: Theme.of(context).textTheme.titleLarge,
                          textAlign: TextAlign.center,
                        ),
                        Text(
                          s.shareSummary(
                            numberLabel(
                              (d['sharePercent'] as Map)['BRIDE'] as num,
                              locale: s.locale,
                            ),
                            numberLabel(
                              (d['sharePercent'] as Map)['GROOM'] as num,
                              locale: s.locale,
                            ),
                            taka(d['totalMinor'] as int, locale: s.locale),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                for (final side in ['BRIDE', 'GROOM'])
                  Card(
                    child: ListTile(
                      title: Text(s.familyLabel(side, labels[side] as String)),
                      subtitle: Text(
                        s.paidShare(
                          taka(
                            (d['paidMinor'] as Map)[side] as int,
                            locale: s.locale,
                          ),
                          taka(
                            (d['fairShareMinor'] as Map)[side] as int,
                            locale: s.locale,
                          ),
                        ),
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

// ---------------------------------------------------------------------------
class VendorsScreen extends ConsumerStatefulWidget {
  const VendorsScreen({super.key});
  @override
  ConsumerState<VendorsScreen> createState() => _VendorsScreenState();
}

class _VendorsScreenState extends ConsumerState<VendorsScreen> {
  String q = '';
  bool matchEvent = false;
  int page = 1;
  final List<Vendor> items = [];
  int total = 0;
  bool loading = false;

  @override
  void initState() {
    super.initState();
    load(reset: true);
  }

  Future<void> load({bool reset = false}) async {
    if (loading) return;
    setState(() => loading = true);
    if (reset) {
      page = 1;
      items.clear();
    }
    final event = ref.read(currentEventProvider).value;
    final firstDay = event?.days.firstOrNull;
    try {
      final data = await ref
          .read(apiProvider)
          .get<Json>(
            'vendors',
            query: {
              'page': page,
              'limit': 20,
              if (q.isNotEmpty) 'q': q,
              if (matchEvent && event != null) 'guests': event.guestCapacity,
              if (matchEvent && firstDay != null)
                'startAt': firstDay.startsAt.toUtc().toIso8601String(),
            },
          );
      setState(() {
        items.addAll([
          for (final v in data['items'] as List) Vendor.fromJson(v as Json),
        ]);
        total = data['total'] as int;
        page++;
      });
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(s.t('textFindVendors'))),
      body: SafeArea(
        child: NotificationListener<ScrollNotification>(
          onNotification: (n) {
            if (n.metrics.extentAfter < 400 && items.length < total) load();
            return false;
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.page,
              AppSpacing.page,
              AppSpacing.page,
              AppSpacing.xl + AppSpacing.page,
            ),
            children: [
              TextField(
                decoration: InputDecoration(
                  prefixIcon: const Icon(Icons.search),
                  hintText: s.t('search'),
                ),
                onSubmitted: (v) {
                  q = v.trim();
                  load(reset: true);
                },
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(s.t('textFreeOnMyDateFits')),
                value: matchEvent,
                onChanged: (v) {
                  setState(() => matchEvent = v);
                  load(reset: true);
                },
              ),
              for (final v in items)
                Card(
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: () => showModalBottomSheet(
                      context: context,
                      isScrollControlled: true,
                      builder: (_) => VendorSheet(vendor: v),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (v.image.isNotEmpty)
                          AspectRatio(
                            aspectRatio: 16 / 9,
                            child: Image.network(
                              v.image,
                              fit: BoxFit.cover,
                              errorBuilder: (_, _, _) => const SizedBox(),
                            ),
                          ),
                        ListTile(
                          title: Row(
                            children: [
                              Flexible(child: Text(v.businessName)),
                              if (v.verified)
                                const Padding(
                                  padding: EdgeInsets.only(left: 4),
                                  child: Icon(
                                    Icons.verified,
                                    size: 16,
                                    color: Colors.green,
                                  ),
                                ),
                            ],
                          ),
                          subtitle: Text(
                            s.details([
                              s.codeLabel(v.category),
                              v.city,
                              if (v.ratingCount > 0)
                                s.rating(
                                  numberLabel(v.ratingAvg, locale: s.locale),
                                ),
                              if (v.sponsored) s.t('sponsored'),
                            ]),
                          ),
                          trailing: v.priceFromMinor != null
                              ? Text(
                                  taka(
                                    v.priceFromMinor!,
                                    compact: true,
                                    locale: s.locale,
                                  ),
                                )
                              : null,
                        ),
                      ],
                    ),
                  ),
                ),
              if (loading)
                const Padding(
                  padding: EdgeInsets.all(AppSpacing.page),
                  child: Center(child: CircularProgressIndicator()),
                ),
              if (!loading && items.isEmpty) EmptyState(s.t('empty')),
            ],
          ),
        ),
      ),
    );
  }
}

class VendorSheet extends ConsumerStatefulWidget {
  const VendorSheet({super.key, required this.vendor});
  final Vendor vendor;
  @override
  ConsumerState<VendorSheet> createState() => _VendorSheetState();
}

class _VendorSheetState extends ConsumerState<VendorSheet> {
  final message = TextEditingController(), phone = TextEditingController();
  bool busy = false;
  @override
  void dispose() {
    message.dispose();
    phone.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final v = widget.vendor;
    final event = ref.watch(currentEventProvider).value;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.page,
        AppSpacing.page,
        AppSpacing.page,
        MediaQuery.viewInsetsOf(context).bottom + AppSpacing.page,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(v.businessName, style: Theme.of(context).textTheme.titleLarge),
            if (v.responseMinutes != null)
              Text(
                s.replyMinutes(
                  numberLabel(v.responseMinutes!, locale: s.locale),
                ),
              ),
            const SizedBox(height: AppSpacing.sm),
            Text(v.description, maxLines: 6, overflow: TextOverflow.ellipsis),
            for (final svc in v.services)
              ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: Text(svc['title'].toString()),
                trailing: Text(
                  taka(svc['basePriceMinor'] as int, locale: s.locale),
                ),
              ),
            TextField(
              controller: message,
              maxLines: 3,
              decoration: InputDecoration(
                labelText: s.t('message'),
                hintText: s.t('textTellThemAboutYourEvent'),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: phone,
              keyboardType: TextInputType.phone,
              decoration: InputDecoration(
                labelText: s.t('textYourPhoneOptional'),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            FilledButton(
              onPressed: busy
                  ? null
                  : () async {
                      setState(() => busy = true);
                      final ok = await attempt(
                        context,
                        () => ref.read(apiProvider).post(
                          'vendors/${v.id}/inquiries',
                          {
                            if (event != null && !event.readOnly)
                              'eventId': event.id,
                            if (event?.days.firstOrNull != null)
                              'eventDate': event!.days.first.startsAt
                                  .toUtc()
                                  .toIso8601String(),
                            if (event != null)
                              'guestCount': event.guestCapacity,
                            if (phone.text.isNotEmpty)
                              'phone': phone.text.trim(),
                            'message': message.text.trim(),
                          },
                        ),
                        success: s.t('textInquirySent'),
                      );
                      if (!context.mounted) return;
                      setState(() => busy = false);
                      if (ok) Navigator.pop(context);
                    },
              child: Text(s.t('sendInquiry')),
            ),
            TextButton(
              onPressed: () => launchUrl(
                Uri.parse('${AppConfig.webUrl}/v/${v.slug}'),
                mode: LaunchMode.externalApplication,
              ),
              child: Text(s.t('textFullProfile')),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
final bookingsProvider = FutureProvider.autoDispose<List<dynamic>>(
  (ref) => ref.read(apiProvider).get<List<dynamic>>('bookings'),
);

class BookingsScreen extends ConsumerWidget {
  const BookingsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final user = ref.watch(currentUserProvider);
    final bookings = ref.watch(bookingsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(s.t('bookings'))),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async => ref.invalidate(bookingsProvider),
          child: AsyncView(
            value: bookings,
            onRetry: () => ref.invalidate(bookingsProvider),
            builder: (list) => list.isEmpty
                ? ListView(children: [EmptyState(s.t('empty'))])
                : ListView(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.page,
                      AppSpacing.page,
                      AppSpacing.page,
                      AppSpacing.xl + AppSpacing.page,
                    ),
                    children: [
                      for (final b in list.cast<Json>())
                        Card(
                          child: Padding(
                            padding: const EdgeInsets.all(AppSpacing.md),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  s.details([
                                    (b['service'] as Map)['title'] as String?,
                                    ((b['service'] as Map)['vendor']
                                            as Map?)?['businessName']
                                        as String?,
                                  ]),
                                  style: Theme.of(context).textTheme.titleSmall,
                                ),
                                Text(
                                  s.details([
                                    dateTimeLabel(
                                      DateTime.parse(b['startAt'] as String)
                                          .toLocal(),
                                      locale: s.locale,
                                    ),
                                    taka(
                                      b['priceMinor'] as int,
                                      locale: s.locale,
                                    ),
                                  ]),
                                ),
                                Chip(
                                  label: Text(
                                    s.codeLabel(b['status'] as String),
                                  ),
                                ),
                                if (user?.isVendor == true)
                                  Wrap(
                                    spacing: AppSpacing.sm,
                                    runSpacing: AppSpacing.sm,
                                    children: [
                                      if ([
                                        'HELD',
                                        'AWAITING_ADVANCE',
                                      ].contains(b['status']))
                                        FilledButton(
                                          style: FilledButton.styleFrom(
                                            minimumSize: const Size(0, 40),
                                          ),
                                          onPressed: () => attempt(
                                            context,
                                            () async {
                                              await ref
                                                  .read(apiProvider)
                                                  .post(
                                                    'bookings/${b['id']}/confirm',
                                                  );
                                              ref.invalidate(bookingsProvider);
                                            },
                                            success: s.t(
                                              'textBookingConfirmed',
                                            ),
                                          ),
                                          child: Text(s.t('confirm')),
                                        ),
                                      if (b['status'] == 'CONFIRMED')
                                        OutlinedButton(
                                          onPressed: () async {
                                            final amount = await _askAmount(
                                              context,
                                              s.t('recordPayment'),
                                            );
                                            if (amount == null ||
                                                !context.mounted) {
                                              return;
                                            }
                                            await attempt(context, () async {
                                              await ref.read(apiProvider).post(
                                                'bookings/${b['id']}/offline-payments',
                                                {
                                                  'amountMinor': (amount * 100)
                                                      .round(),
                                                  'method': 'BKASH',
                                                  'idempotencyKey':
                                                      '${b['id']}-${DateTime.now().microsecondsSinceEpoch}',
                                                },
                                              );
                                              ref.invalidate(bookingsProvider);
                                            }, success: s.t('textPaymentRecorded'));
                                          },
                                          child: Text(s.t('recordPayment')),
                                        ),
                                    ],
                                  ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

Future<double?> _askAmount(BuildContext context, String title) async {
  final c = TextEditingController();
  final value = await showDialog<String>(
    context: context,
    builder: (d) => AlertDialog(
      title: Text(title),
      content: TextField(
        controller: c,
        keyboardType: TextInputType.number,
        decoration: const InputDecoration(prefixText: '৳ '),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(d),
          child: Text(
            ProviderScope.containerOf(context)
                .read(stringsProvider)
                .t('cancel'),
          ),
        ),
        TextButton(
          onPressed: () => Navigator.pop(d, c.text),
          child: Text(
            ProviderScope.containerOf(context).read(stringsProvider).t('ok'),
          ),
        ),
      ],
    ),
  );
  c.dispose();
  return double.tryParse(normalizedDigits(value ?? ''));
}

// ---------------------------------------------------------------------------
Future<void> acceptQuote(
  BuildContext context,
  WidgetRef ref,
  Json quote,
) async {
  final api = ref.read(apiProvider);
  final s = ref.read(stringsProvider);
  Json vendor;
  try {
    vendor = await api.get<Json>('vendors/${quote['vendorId']}');
  } catch (e) {
    if (context.mounted) showError(context, e);
    return;
  }
  if (!context.mounted) return;
  final services = List<Json>.from(vendor['services'] as List);
  if (services.isEmpty) {
    showMessage(context, s.t('noServices'));
    return;
  }
  String serviceId = services.first['id'] as String;
  DateTime? date;
  TimeOfDay? time;
  final selection = await showDialog<({String serviceId, DateTime startAt})>(
    context: context,
    builder: (dialog) => StatefulBuilder(
      builder: (dialog, setDialog) => AlertDialog(
        title: Text(s.t('acceptQuote')),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                isExpanded: true,
                initialValue: serviceId,
                items: [
                  for (final service in services)
                    DropdownMenuItem(
                      value: service['id'] as String,
                      child: Text(service['title'] as String),
                    ),
                ],
                onChanged: (value) => setDialog(() => serviceId = value!),
              ),
              TextButton(
                onPressed: () async {
                  final chosen = await showDatePicker(
                    context: dialog,
                    firstDate: DateTime.now(),
                    lastDate: DateTime.now().add(const Duration(days: 1095)),
                  );
                  if (chosen != null) setDialog(() => date = chosen);
                },
                child: Text(
                  date == null
                      ? s.t('chooseDate')
                      : dateLabel(date!, locale: s.locale),
                ),
              ),
              TextButton(
                onPressed: () async {
                  final chosen = await showTimePicker(
                    context: dialog,
                    initialTime: TimeOfDay.now(),
                  );
                  if (chosen != null) setDialog(() => time = chosen);
                },
                child: Text(
                  time == null
                      ? s.t('chooseTime')
                      : timeLabel(
                          DateTime(2000, 1, 1, time!.hour, time!.minute),
                          locale: s.locale,
                        ),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialog),
            child: Text(
              ProviderScope.containerOf(context)
                  .read(stringsProvider)
                  .t('cancel'),
            ),
          ),
          FilledButton(
            onPressed: date == null || time == null
                ? null
                : () {
                    final utc = DateTime.utc(
                      date!.year,
                      date!.month,
                      date!.day,
                      time!.hour - 6,
                      time!.minute,
                    );
                    Navigator.pop(dialog, (serviceId: serviceId, startAt: utc));
                  },
            child: Text(s.t('accept')),
          ),
        ],
      ),
    ),
  );
  if (selection == null || !context.mounted) return;
  await attempt(context, () async {
    await api.post('quotes/${quote['id']}/respond', {
      'status': 'ACCEPTED',
      'serviceId': selection.serviceId,
      'startAt': selection.startAt.toIso8601String(),
    });
    ref.invalidate(eventResource('quotes/event/:id'));
    ref.invalidate(bookingsProvider);
  });
}

class QuotesScreen extends ConsumerWidget {
  const QuotesScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final quotes = ref.watch(eventResource('quotes/event/:id'));
    final event = ref.watch(currentEventProvider).value;
    return Scaffold(
      appBar: AppBar(title: Text(s.t('textQuotations'))),
      body: SafeArea(
        child: AsyncView(
          value: quotes,
          builder: (list) {
            final items = List<Json>.from((list ?? const []) as List);
            if (items.isEmpty) return EmptyState(s.t('empty'));
            return ListView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.page,
                AppSpacing.page,
                AppSpacing.page,
                AppSpacing.xl + AppSpacing.page,
              ),
              children: [
                for (final q in items)
                  Card(
                    child: ListTile(
                      title: Text(
                        taka(q['amountMinor'] as int, locale: s.locale),
                      ),
                      subtitle: Text(
                        s.details([
                          s.codeLabel(q['status'] as String),
                          dateLabel(
                            DateTime.parse(q['expiresAt'] as String).toLocal(),
                            locale: s.locale,
                          ),
                        ]),
                      ),
                      onTap: () => launchUrl(
                        Uri.parse('${AppConfig.webUrl}/quotes/${q['id']}'),
                        mode: LaunchMode.externalApplication,
                      ),
                      trailing:
                          q['status'] == 'SENT' && event?.readOnly == false
                          ? Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                  icon: const Icon(
                                    Icons.check_circle_outline,
                                    color: Colors.green,
                                  ),
                                  onPressed: () => acceptQuote(context, ref, q),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.cancel_outlined),
                                  onPressed: () => attempt(context, () async {
                                    await ref.read(apiProvider).post(
                                      'quotes/${q['id']}/respond',
                                      {'status': 'REJECTED'},
                                    );
                                    ref.invalidate(
                                      eventResource('quotes/event/:id'),
                                    );
                                  }),
                                ),
                              ],
                            )
                          : null,
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

// ---------------------------------------------------------------------------
class InvitationsScreen extends ConsumerWidget {
  const InvitationsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final share = ref.watch(
      eventResource('events/:id/invitations/share?language=${s.locale}'),
    );
    final event = ref.watch(currentEventProvider).value;
    return Scaffold(
      appBar: AppBar(title: Text(s.t('textSendInvitations'))),
      body: SafeArea(
        child: AsyncView(
          value: share,
          builder: (list) {
            final items = List<Json>.from((list ?? const []) as List);
            if (items.isEmpty) {
              return EmptyState(
                s.t('empty'),
                subtitle: s.t('textAddGuestsFirst'),
              );
            }
            return ListView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.page,
                AppSpacing.page,
                AppSpacing.page,
                AppSpacing.xl + AppSpacing.page,
              ),
              children: [
                for (final i in items)
                  ListTile(
                    leading: Icon(
                      i['type'] == 'household'
                          ? Icons.home_outlined
                          : Icons.person_outline,
                    ),
                    title: Text(i['name'] as String),
                    subtitle: Text(
                      i['openedAt'] != null
                          ? (s.t('textOpened'))
                          : i['sentAt'] != null
                          ? (s.t('textSent'))
                          : (s.t('textNotSent')),
                    ),
                    trailing: IconButton(
                      icon: const Icon(Icons.send_outlined),
                      tooltip: s.t('whatsapp'),
                      onPressed: () async {
                        final number = (i['phone'] as String?) ?? '';
                        final ok = await launchUrl(
                          Uri.parse(
                            'https://wa.me/$number?text=${Uri.encodeComponent(i['text'] as String)}',
                          ),
                          mode: LaunchMode.externalApplication,
                        );
                        if (ok && event != null) {
                          await ref
                              .read(apiProvider)
                              .post(
                                'events/${event.id}/guests/mark-sent',
                                i['type'] == 'household'
                                    ? {
                                        'householdIds': [i['id']],
                                      }
                                    : {
                                        'guestIds': [i['id']],
                                      },
                              )
                              .catchError((_) => null);
                          ref.invalidate(
                            eventResource(
                              'events/:id/invitations/share?language=${s.locale}',
                            ),
                          );
                        }
                      },
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
