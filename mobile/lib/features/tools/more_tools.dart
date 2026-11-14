import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config.dart';
import '../../core/format.dart';
import '../../core/providers.dart';
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
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: Theme.of(context).textTheme.titleMedium),
              Text('${p['recommendedPlates']}', style: Theme.of(context).textTheme.displaySmall),
              Text(s.bn ? 'প্লেট অর্ডার করুন · ${p['confirmedPeople']} জন নিশ্চিত' : 'plates to order · ${p['confirmedPeople']} confirmed'),
              const Divider(),
              for (final m in (p['meals'] as Map).entries) Row(children: [Expanded(child: Text('${m.key}')), Text('${m.value}')]),
            ]),
          ),
        );
    return Scaffold(
      appBar: AppBar(title: Text(s.bn ? 'খাবারের হিসাব' : 'Catering headcount')),
      body: AsyncView(
        value: data,
        builder: (d) {
          if (d == null) return const SizedBox();
          return ListView(padding: const EdgeInsets.all(16), children: [
            Text('${s.bn ? 'বাড়তি' : 'Buffer'}: $buffer%'),
            Slider(value: buffer.toDouble(), min: 0, max: 30, divisions: 6, label: '$buffer%', onChanged: (v) => setState(() => buffer = v.round())),
            plan(s.bn ? 'পুরো অনুষ্ঠান' : 'Whole event', d['overall'] as Map),
            for (final day in d['days'] as List) plan('${day['name']}', day as Map),
            OutlinedButton.icon(
              onPressed: () {
                final lines = [for (final day in d['days'] as List) '${day['name']}: ${day['recommendedPlates']} plates (${(day['meals'] as Map).entries.map((m) => '${m.key} ${m.value}').join(', ')})'];
                SharePlus.instance.share(ShareParams(text: lines.join('\n')));
              },
              icon: const Icon(Icons.share_outlined),
              label: Text(s.bn ? 'ক্যাটারারকে পাঠান' : 'Send to caterer'),
            ),
          ]);
        },
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
      appBar: AppBar(title: Text(s.bn ? 'খরচ ভাগাভাগি' : 'Family cost split')),
      body: AsyncView(
        value: data,
        builder: (d) {
          if (d == null) return const SizedBox();
          final labels = d['labels'] as Map, settlement = d['settlement'] as Map?;
          return ListView(padding: const EdgeInsets.all(16), children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(children: [
                  const Icon(Icons.balance, size: 36),
                  const SizedBox(height: 8),
                  Text(
                    settlement == null
                        ? (s.bn ? 'দুই পরিবার সমান' : 'Both families are even')
                        : '${labels[settlement['from']]} → ${labels[settlement['to']]}: ${taka(settlement['amountMinor'] as int)}',
                    style: Theme.of(context).textTheme.titleLarge,
                    textAlign: TextAlign.center,
                  ),
                  Text('${(d['sharePercent'] as Map)['BRIDE']}% / ${(d['sharePercent'] as Map)['GROOM']}% · ${taka(d['totalMinor'] as int)}'),
                ]),
              ),
            ),
            for (final side in ['BRIDE', 'GROOM'])
              Card(
                child: ListTile(
                  title: Text('${labels[side]}'),
                  subtitle: Text('${s.bn ? 'নিজে দিয়েছেন' : 'Paid'} ${taka((d['paidMinor'] as Map)[side] as int)} · ${s.bn ? 'ন্যায্য অংশ' : 'Fair share'} ${taka((d['fairShareMinor'] as Map)[side] as int)}'),
                ),
              ),
          ]);
        },
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
      final data = await ref.read(apiProvider).get<Json>('vendors', query: {
        'page': page,
        'limit': 20,
        if (q.isNotEmpty) 'q': q,
        if (matchEvent && event != null) 'guests': event.guestCapacity,
        if (matchEvent && firstDay != null) 'startAt': firstDay.startsAt.toUtc().toIso8601String(),
      });
      setState(() {
        items.addAll([for (final v in data['items'] as List) Vendor.fromJson(v as Json)]);
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
      appBar: AppBar(title: Text(s.bn ? 'ভেন্ডর খুঁজুন' : 'Find vendors')),
      body: NotificationListener<ScrollNotification>(
        onNotification: (n) {
          if (n.metrics.extentAfter < 400 && items.length < total) load();
          return false;
        },
        child: ListView(padding: const EdgeInsets.all(16), children: [
          TextField(
            decoration: InputDecoration(prefixIcon: const Icon(Icons.search), hintText: s.t('search')),
            onSubmitted: (v) {
              q = v.trim();
              load(reset: true);
            },
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(s.bn ? 'আমার তারিখ ও অতিথি সংখ্যায় মেলে' : 'Free on my date, fits my guests'),
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
                onTap: () => showModalBottomSheet(context: context, isScrollControlled: true, builder: (_) => VendorSheet(vendor: v)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  if (v.image.isNotEmpty) AspectRatio(aspectRatio: 16 / 9, child: Image.network(v.image, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox())),
                  ListTile(
                    title: Row(children: [
                      Flexible(child: Text(v.businessName)),
                      if (v.verified) const Padding(padding: EdgeInsets.only(left: 4), child: Icon(Icons.verified, size: 16, color: Colors.green)),
                    ]),
                    subtitle: Text('${v.category} · ${v.city}${v.ratingCount > 0 ? ' · ★ ${v.ratingAvg.toStringAsFixed(1)}' : ''}${v.sponsored ? ' · Sponsored' : ''}'),
                    trailing: v.priceFromMinor != null ? Text(taka(v.priceFromMinor!, compact: true)) : null,
                  ),
                ]),
              ),
            ),
          if (loading) const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator())),
          if (!loading && items.isEmpty) EmptyState(s.t('empty')),
        ]),
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
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final v = widget.vendor;
    final event = ref.watch(currentEventProvider).value;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.viewInsetsOf(context).bottom + 16),
      child: SingleChildScrollView(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          Text(v.businessName, style: Theme.of(context).textTheme.titleLarge),
          if (v.responseMinutes != null) Text(s.bn ? 'সাধারণত ${v.responseMinutes} মিনিটে উত্তর দেন' : 'Usually replies in ${v.responseMinutes} min'),
          const SizedBox(height: 8),
          Text(v.description, maxLines: 6, overflow: TextOverflow.ellipsis),
          for (final svc in v.services) ListTile(dense: true, contentPadding: EdgeInsets.zero, title: Text('${svc['title']}'), trailing: Text(taka(svc['basePriceMinor'] as int))),
          TextField(controller: message, maxLines: 3, decoration: InputDecoration(labelText: s.t('message'), hintText: s.bn ? 'আপনার অনুষ্ঠান ও প্রয়োজন লিখুন' : 'Tell them about your event')),
          const SizedBox(height: 8),
          TextField(controller: phone, keyboardType: TextInputType.phone, decoration: InputDecoration(labelText: s.bn ? 'আপনার ফোন (ঐচ্ছিক)' : 'Your phone (optional)')),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: busy
                ? null
                : () async {
                    setState(() => busy = true);
                    final ok = await attempt(context, () => ref.read(apiProvider).post('vendors/${v.id}/inquiries', {
                          if (event != null && !event.readOnly) 'eventId': event.id,
                          if (event?.days.firstOrNull != null) 'eventDate': event!.days.first.startsAt.toUtc().toIso8601String(),
                          if (event != null) 'guestCount': event.guestCapacity,
                          if (phone.text.isNotEmpty) 'phone': phone.text.trim(),
                          'message': message.text.trim(),
                        }), success: s.bn ? 'জিজ্ঞাসা পাঠানো হয়েছে' : 'Inquiry sent');
                    if (!context.mounted) return;
                    setState(() => busy = false);
                    if (ok) Navigator.pop(context);
                  },
            child: Text(s.t('sendInquiry')),
          ),
          TextButton(onPressed: () => launchUrl(Uri.parse('${AppConfig.webUrl}/v/${v.slug}'), mode: LaunchMode.externalApplication), child: Text(s.bn ? 'পুরো প্রোফাইল' : 'Full profile')),
        ]),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
final bookingsProvider = FutureProvider.autoDispose<List<dynamic>>((ref) => ref.read(apiProvider).get<List<dynamic>>('bookings'));

class BookingsScreen extends ConsumerWidget {
  const BookingsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final user = ref.watch(currentUserProvider);
    final bookings = ref.watch(bookingsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(s.t('bookings'))),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(bookingsProvider),
        child: AsyncView(
          value: bookings,
          onRetry: () => ref.invalidate(bookingsProvider),
          builder: (list) => list.isEmpty
              ? ListView(children: [EmptyState(s.t('empty'))])
              : ListView(padding: const EdgeInsets.all(12), children: [
                  for (final b in list.cast<Json>())
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('${(b['service'] as Map)['title']} · ${((b['service'] as Map)['vendor'] as Map?)?['businessName'] ?? ''}', style: Theme.of(context).textTheme.titleSmall),
                          Text('${dateTimeLabel(DateTime.parse(b['startAt'] as String).toLocal(), locale: s.locale)} · ${taka(b['priceMinor'] as int)}'),
                          Chip(label: Text((b['status'] as String).toLowerCase())),
                          if (user?.isVendor == true) Wrap(spacing: 8, children: [
                            if (['HELD', 'AWAITING_ADVANCE'].contains(b['status']))
                              FilledButton(
                                style: FilledButton.styleFrom(minimumSize: const Size(0, 40)),
                                onPressed: () => attempt(context, () async {
                                  await ref.read(apiProvider).post('bookings/${b['id']}/confirm');
                                  ref.invalidate(bookingsProvider);
                                }, success: s.bn ? 'বুকিং নিশ্চিত' : 'Booking confirmed'),
                                child: Text(s.t('confirm')),
                              ),
                            if (b['status'] == 'CONFIRMED')
                              OutlinedButton(
                                onPressed: () async {
                                  final amount = await _askAmount(context, s.t('recordPayment'));
                                  if (amount == null || !context.mounted) return;
                                  await attempt(context, () async {
                                    await ref.read(apiProvider).post('bookings/${b['id']}/offline-payments', {
                                      'amountMinor': (amount * 100).round(),
                                      'method': 'BKASH',
                                      'idempotencyKey': '${b['id']}-${DateTime.now().microsecondsSinceEpoch}',
                                    });
                                    ref.invalidate(bookingsProvider);
                                  }, success: s.bn ? 'পেমেন্ট লেখা হয়েছে' : 'Payment recorded');
                                },
                                child: Text(s.t('recordPayment')),
                              ),
                          ]),
                        ]),
                      ),
                    ),
                ]),
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
      content: TextField(controller: c, keyboardType: TextInputType.number, decoration: const InputDecoration(prefixText: '৳ ')),
      actions: [TextButton(onPressed: () => Navigator.pop(d), child: const Text('Cancel')), TextButton(onPressed: () => Navigator.pop(d, c.text), child: const Text('OK'))],
    ),
  );
  return double.tryParse(value ?? '');
}

// ---------------------------------------------------------------------------
class QuotesScreen extends ConsumerWidget {
  const QuotesScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final quotes = ref.watch(eventResource('quotes/event/:id'));
    final event = ref.watch(currentEventProvider).value;
    return Scaffold(
      appBar: AppBar(title: Text(s.bn ? 'কোটেশন' : 'Quotations')),
      body: AsyncView(
        value: quotes,
        builder: (list) {
          final items = List<Json>.from((list ?? const []) as List);
          if (items.isEmpty) return EmptyState(s.t('empty'));
          return ListView(padding: const EdgeInsets.all(12), children: [
            for (final q in items)
              Card(
                child: ListTile(
                  title: Text(taka(q['amountMinor'] as int)),
                  subtitle: Text('${(q['status'] as String).toLowerCase()} · ${dateLabel(DateTime.parse(q['expiresAt'] as String).toLocal(), locale: s.locale)}'),
                  onTap: () => launchUrl(Uri.parse('${AppConfig.webUrl}/quotes/${q['id']}'), mode: LaunchMode.externalApplication),
                  trailing: q['status'] == 'SENT' && event?.readOnly == false
                      ? Row(mainAxisSize: MainAxisSize.min, children: [
                          IconButton(
                            icon: const Icon(Icons.check_circle_outline, color: Colors.green),
                            onPressed: () => attempt(context, () async {
                              await ref.read(apiProvider).post('quotes/${q['id']}/respond', {'status': 'ACCEPTED'});
                              ref.invalidate(eventResource('quotes/event/:id'));
                            }),
                          ),
                          IconButton(
                            icon: const Icon(Icons.cancel_outlined),
                            onPressed: () => attempt(context, () async {
                              await ref.read(apiProvider).post('quotes/${q['id']}/respond', {'status': 'REJECTED'});
                              ref.invalidate(eventResource('quotes/event/:id'));
                            }),
                          ),
                        ])
                      : null,
                ),
              ),
          ]);
        },
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
    final share = ref.watch(eventResource('events/:id/invitations/share?language=${s.locale}'));
    final event = ref.watch(currentEventProvider).value;
    return Scaffold(
      appBar: AppBar(title: Text(s.bn ? 'দাওয়াত পাঠান' : 'Send invitations')),
      body: AsyncView(
        value: share,
        builder: (list) {
          final items = List<Json>.from((list ?? const []) as List);
          if (items.isEmpty) return EmptyState(s.t('empty'), subtitle: s.bn ? 'আগে অতিথি যোগ করুন' : 'Add guests first');
          return ListView(children: [
            for (final i in items)
              ListTile(
                leading: Icon(i['type'] == 'household' ? Icons.home_outlined : Icons.person_outline),
                title: Text(i['name'] as String),
                subtitle: Text(i['openedAt'] != null ? (s.bn ? 'দেখেছেন' : 'Opened') : i['sentAt'] != null ? (s.bn ? 'পাঠানো হয়েছে' : 'Sent') : (s.bn ? 'পাঠানো হয়নি' : 'Not sent')),
                trailing: IconButton(
                  icon: const Icon(Icons.send_outlined),
                  tooltip: s.t('whatsapp'),
                  onPressed: () async {
                    final number = (i['phone'] as String?) ?? '';
                    final ok = await launchUrl(Uri.parse('https://wa.me/$number?text=${Uri.encodeComponent(i['text'] as String)}'), mode: LaunchMode.externalApplication);
                    if (ok && event != null) {
                      await ref.read(apiProvider).post('events/${event.id}/guests/mark-sent', i['type'] == 'household' ? {'householdIds': [i['id']]} : {'guestIds': [i['id']]}).catchError((_) => null);
                      ref.invalidate(eventResource('events/:id/invitations/share?language=${s.locale}'));
                    }
                  },
                ),
              ),
          ]);
        },
      ),
    );
  }
}
