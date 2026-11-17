import 'package:flutter/material.dart';
import 'package:flutter_contacts/flutter_contacts.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config.dart';
import '../../core/format.dart';
import '../../core/providers.dart';
import '../../core/strings.dart';
import '../../core/widgets/common.dart';
import '../../models/models.dart';

/// Loads a JSON resource for the current event; `path` gets the event id.
final eventResource = FutureProvider.autoDispose.family<dynamic, String>((ref, path) async {
  final event = await ref.watch(currentEventProvider.future);
  if (event == null) return null;
  return ref.read(apiProvider).get<dynamic>(path.replaceAll(':id', event.id));
});

String sideLabel(S s, EventSummary e, String? side) {
  if (side == null) return '—';
  final custom = ((e.raw['sides'] ?? const {}) as Map)[side];
  if (custom is Map && custom['label'] is String) return custom['label'] as String;
  return s.t(switch (side) { 'BRIDE' => 'bride', 'GROOM' => 'groom', _ => 'both' });
}

// ---------------------------------------------------------------------------
class ChecklistScreen extends ConsumerWidget {
  const ChecklistScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final event = ref.watch(currentEventProvider);
    return Scaffold(
      appBar: AppBar(title: Text(s.bn ? 'চেকলিস্ট' : 'Checklist')),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          final title = await _prompt(context, s.bn ? 'নতুন কাজ' : 'New task');
          final e = event.value;
          if (title == null || title.length < 2 || e == null || !context.mounted) return;
          await attempt(context, () async {
            await ref.read(apiProvider).post('events/${e.id}/tasks', {'title': title});
            refreshEvent(ref);
          });
        },
        child: const Icon(Icons.add),
      ),
      body: AsyncView(
        value: event,
        builder: (e) {
          final tasks = List<Map>.from((e?.raw['tasks'] ?? const []) as List)..sort((a, b) => (a['done'] == true ? 1 : 0) - (b['done'] == true ? 1 : 0));
          if (tasks.isEmpty) return EmptyState(s.t('empty'));
          return ListView(children: [
            for (final t in tasks)
              Dismissible(
                key: ValueKey(t['id']),
                direction: e!.readOnly ? DismissDirection.none : DismissDirection.endToStart,
                background: Container(color: Colors.red.shade100, alignment: Alignment.centerRight, padding: const EdgeInsets.only(right: 20), child: const Icon(Icons.delete_outline)),
                confirmDismiss: (_) => confirmDialog(context, s.t('delete'), t['title'] as String, destructive: true),
                onDismissed: (_) => attempt(context, () async {
                  await ref.read(apiProvider).delete('events/${e.id}/tasks/${t['id']}');
                  refreshEvent(ref);
                }),
                child: CheckboxListTile(
                  value: t['done'] == true,
                  title: Text(t['title'] as String, style: t['done'] == true ? const TextStyle(decoration: TextDecoration.lineThrough) : null),
                  subtitle: t['dueAt'] != null ? Text(dateLabel(DateTime.parse(t['dueAt'] as String).toLocal(), locale: s.locale)) : null,
                  onChanged: e.readOnly
                      ? null
                      : (v) => attempt(context, () async {
                            await ref.read(apiProvider).patch('events/${e.id}/tasks/${t['id']}', {'done': v == true});
                            refreshEvent(ref);
                          }),
                ),
              ),
          ]);
        },
      ),
    );
  }
}

Future<String?> _prompt(BuildContext context, String title, {String? initial, TextInputType? keyboard}) {
  final controller = TextEditingController(text: initial);
  return showDialog<String>(
    context: context,
    builder: (c) => AlertDialog(
      title: Text(title),
      content: TextField(controller: controller, autofocus: true, keyboardType: keyboard),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c), child: const Text('Cancel')),
        TextButton(onPressed: () => Navigator.pop(c, controller.text.trim()), child: const Text('OK')),
      ],
    ),
  );
}

// ---------------------------------------------------------------------------
class GuestsScreen extends ConsumerStatefulWidget {
  const GuestsScreen({super.key});
  @override
  ConsumerState<GuestsScreen> createState() => _GuestsScreenState();
}

class _GuestsScreenState extends ConsumerState<GuestsScreen> {
  String query = '';
  String? side;

  Future<void> edit(EventSummary e, {Guest? guest, String? name, String? phone}) async {
    final s = ref.read(stringsProvider);
    final nameC = TextEditingController(text: guest?.name ?? name), phoneC = TextEditingController(text: guest?.phone ?? phone);
    final partyC = TextEditingController(text: '${guest?.maxPartySize ?? 2}'), relC = TextEditingController(text: guest?.relationship);
    String? chosenSide = guest?.side;
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (c) => StatefulBuilder(
        builder: (c, setSheet) => Padding(
          padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.viewInsetsOf(c).bottom + 16),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(controller: nameC, decoration: InputDecoration(labelText: s.t('fullName')), textCapitalization: TextCapitalization.words),
            const SizedBox(height: 10),
            TextField(controller: phoneC, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone')),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: TextField(controller: partyC, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: s.bn ? 'সর্বোচ্চ সদস্য' : 'Max party size'))),
              const SizedBox(width: 10),
              Expanded(child: TextField(controller: relC, decoration: InputDecoration(labelText: s.bn ? 'সম্পর্ক' : 'Relationship'))),
            ]),
            if (e.has('sides')) ...[
              const SizedBox(height: 10),
              SegmentedButton<String?>(
                segments: [
                  ButtonSegment(value: 'BRIDE', label: Text(sideLabel(s, e, 'BRIDE'))),
                  ButtonSegment(value: 'GROOM', label: Text(sideLabel(s, e, 'GROOM'))),
                  ButtonSegment(value: 'BOTH', label: Text(s.t('both'))),
                ],
                emptySelectionAllowed: true,
                selected: {chosenSide},
                onSelectionChanged: (v) => setSheet(() => chosenSide = v.firstOrNull),
              ),
            ],
            const SizedBox(height: 16),
            FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(s.t('save'))),
          ]),
        ),
      ),
    );
    if (saved != true || !mounted) return;
    final body = {
      'name': nameC.text.trim(),
      if (phoneC.text.trim().isNotEmpty) 'phone': phoneC.text.trim(),
      'maxPartySize': int.tryParse(partyC.text) ?? 2,
      if (relC.text.trim().isNotEmpty) 'relationship': relC.text.trim(),
      if (e.has('sides')) 'side': chosenSide,
    };
    await attempt(context, () async {
      final api = ref.read(apiProvider);
      if (guest == null) {
        await api.post('events/${e.id}/guests', body);
      } else {
        await api.patch('events/${e.id}/guests/${guest.id}', body);
      }
      refreshEvent(ref);
    });
  }

  /// Native contact picker: no contacts permission needed, one contact at a time.
  Future<void> fromContacts(EventSummary e) async {
    final contact = await FlutterContacts.native.showPicker(properties: {ContactProperty.name, ContactProperty.phone});
    if (contact == null || !mounted) return;
    await edit(e, name: contact.displayName, phone: contact.phones.firstOrNull?.number);
  }

  Future<void> invite(EventSummary e, Guest g) async {
    final s = ref.read(stringsProvider);
    if (g.token == null) return;
    final url = '${AppConfig.webUrl}/rsvp/${g.token}';
    final text = s.bn ? 'আসসালামু আলাইকুম ${g.name},\n${e.title} — উপস্থিতি জানাতে এই লিংকে ক্লিক করুন: $url' : 'Dear ${g.name},\n${e.title}. Please let us know if you can come: $url';
    final number = whatsappNumber(g.phone) ?? '';
    final opened = await launchUrl(Uri.parse('https://wa.me/$number?text=${Uri.encodeComponent(text)}'), mode: LaunchMode.externalApplication);
    if (opened) await ref.read(apiProvider).post('events/${e.id}/guests/mark-sent', {'guestIds': [g.id]}).catchError((_) => null);
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final event = ref.watch(currentEventProvider);
    return Scaffold(
      appBar: AppBar(title: Text(s.bn ? 'অতিথি তালিকা' : 'Guest list')),
      floatingActionButton: event.value?.readOnly == false
          ? Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
              FloatingActionButton.small(heroTag: 'contacts', onPressed: () => fromContacts(event.value!), tooltip: s.t('fromContacts'), child: const Icon(Icons.contacts_outlined)),
              const SizedBox(height: 10),
              FloatingActionButton.extended(heroTag: 'add', onPressed: () => edit(event.value!), icon: const Icon(Icons.person_add_alt), label: Text(s.t('addGuest'))),
            ])
          : null,
      body: AsyncView(
        value: event,
        builder: (e) {
          if (e == null) return const SizedBox();
          final guests = [for (final g in (e.raw['guests'] ?? const []) as List) Guest.fromJson(g as Json)]
              .where((g) => g.name.toLowerCase().contains(query.toLowerCase()) && (side == null || g.side == side))
              .toList();
          final attending = guests.where((g) => g.rsvpStatus == 'ACCEPTED').fold<int>(0, (n, g) => n + g.partySize);
          return Column(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: TextField(decoration: InputDecoration(prefixIcon: const Icon(Icons.search), hintText: s.t('search')), onChanged: (v) => setState(() => query = v)),
            ),
            if (e.has('sides'))
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                child: Row(children: [
                  for (final option in [null, 'BRIDE', 'GROOM', 'BOTH'])
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: ChoiceChip(label: Text(option == null ? (s.bn ? 'সবাই' : 'All') : sideLabel(s, e, option)), selected: side == option, onSelected: (_) => setState(() => side = option)),
                    ),
                ]),
              ),
            Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Align(alignment: Alignment.centerLeft, child: Text('${guests.length} · $attending ${s.t('attending')}'))),
            Expanded(
              child: guests.isEmpty
                  ? EmptyState(s.t('empty'))
                  : ListView.builder(
                      padding: const EdgeInsets.only(bottom: 140),
                      itemCount: guests.length,
                      itemBuilder: (_, i) {
                        final g = guests[i];
                        return ListTile(
                          title: Text(g.name),
                          subtitle: Text([g.rsvpStatus.toLowerCase(), '${g.partySize}/${g.maxPartySize}', if (e.has('sides') && g.side != null) sideLabel(s, e, g.side)].join(' · ')),
                          trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                            if (!e.readOnly) IconButton(tooltip: s.t('whatsapp'), icon: const Icon(Icons.send_outlined), onPressed: () => invite(e, g)),
                            if (!e.readOnly)
                              PopupMenuButton<String>(
                                onSelected: (v) async {
                                  if (v == 'edit') return edit(e, guest: g);
                                  if (await confirmDialog(context, s.t('delete'), g.name, destructive: true) && context.mounted) {
                                    await attempt(context, () async {
                                      await ref.read(apiProvider).delete('events/${e.id}/guests/${g.id}');
                                      refreshEvent(ref);
                                    });
                                  }
                                },
                                itemBuilder: (_) => [PopupMenuItem(value: 'edit', child: Text(s.t('edit'))), PopupMenuItem(value: 'delete', child: Text(s.t('delete')))],
                              ),
                          ]),
                        );
                      },
                    ),
            ),
          ]);
        },
      ),
    );
  }
}

// ---------------------------------------------------------------------------
class BudgetScreen extends ConsumerWidget {
  const BudgetScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final budget = ref.watch(eventResource('events/:id/budget'));
    final event = ref.watch(currentEventProvider).value;
    Future<void> add() async {
      if (event == null) return;
      final noteC = TextEditingController(), amountC = TextEditingController();
      String category = 'Other';
      String? paidBy;
      XFile? receipt;
      final ok = await showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        builder: (c) => StatefulBuilder(
          builder: (c, set) => Padding(
            padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.viewInsetsOf(c).bottom + 16),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextField(controller: noteC, decoration: InputDecoration(labelText: s.bn ? 'কী খরচ' : 'What for')),
              const SizedBox(height: 10),
              TextField(controller: amountC, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: '৳')),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: category,
                items: [for (final c in ['Venue', 'Catering', 'Decoration', 'Photography', 'Attire', 'Other']) DropdownMenuItem(value: c, child: Text(c))],
                onChanged: (v) => set(() => category = v ?? 'Other'),
              ),
              if (event.has('costSplit'))
                DropdownButtonFormField<String?>(
                  initialValue: paidBy,
                  decoration: InputDecoration(labelText: s.bn ? 'কে দিলেন' : 'Paid by'),
                  items: [
                    const DropdownMenuItem(value: null, child: Text('—')),
                    DropdownMenuItem(value: 'BRIDE', child: Text(sideLabel(s, event, 'BRIDE'))),
                    DropdownMenuItem(value: 'GROOM', child: Text(sideLabel(s, event, 'GROOM'))),
                    DropdownMenuItem(value: 'SHARED', child: Text(s.bn ? 'যৌথ' : 'Shared')),
                  ],
                  onChanged: (v) => set(() => paidBy = v),
                ),
              TextButton.icon(
                onPressed: () async {
                  final picked = await ImagePicker().pickImage(source: ImageSource.camera, maxWidth: 2000, imageQuality: 80);
                  if (picked != null) set(() => receipt = picked);
                },
                icon: const Icon(Icons.receipt_long_outlined),
                label: Text(receipt == null ? (s.bn ? 'রসিদের ছবি' : 'Photo of receipt') : (s.bn ? 'রসিদ যুক্ত হয়েছে' : 'Receipt attached')),
              ),
              FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(s.t('save'))),
            ]),
          ),
        ),
      );
      if (ok != true || !context.mounted) return;
      await attempt(context, () async {
        final api = ref.read(apiProvider);
        final created = await api.post<Json>('events/${event.id}/budget/expenses', {
          'category': category,
          'note': noteC.text.trim(),
          'amountMinor': ((double.tryParse(amountC.text) ?? 0) * 100).round(),
        });
        final media = receipt == null ? null : await api.upload(await receipt!.readAsBytes(), 'image/jpeg', 'RECEIPT', fileName: 'receipt.jpg');
        if (paidBy != null || media != null) {
          await api.patch('events/${event.id}/budget/expenses/${created['id']}', {'paidBy': ?paidBy, if (media != null) 'receiptMediaId': media['id']});
        }
        ref.invalidate(eventResource('events/:id/budget'));
        refreshEvent(ref);
      });
    }

    return Scaffold(
      appBar: AppBar(title: Text(s.bn ? 'বাজেট' : 'Budget')),
      floatingActionButton: event?.readOnly == false ? FloatingActionButton(onPressed: add, child: const Icon(Icons.add)) : null,
      body: AsyncView(
        value: budget,
        onRetry: () => ref.invalidate(eventResource('events/:id/budget')),
        builder: (data) {
          if (data == null) return const SizedBox();
          final expenses = List<Map>.from(data['expenses'] as List);
          return ListView(padding: const EdgeInsets.all(16), children: [
            Row(children: [
              StatTile(value: taka(data['plannedMinor'] as int, compact: true), label: s.bn ? 'পরিকল্পিত' : 'Planned', icon: Icons.flag_outlined),
              StatTile(value: taka(data['committedMinor'] as int, compact: true), label: s.bn ? 'বুক করা' : 'Committed', icon: Icons.event_available_outlined),
              StatTile(value: taka(data['actualMinor'] as int, compact: true), label: s.t('spent'), icon: Icons.payments_outlined),
            ]),
            if (data['alert'] == true) Card(color: Colors.red.shade50, child: ListTile(leading: const Icon(Icons.warning_amber), title: Text(s.bn ? 'বাজেট ছাড়িয়ে গেছে' : 'Bookings exceed your budget'))),
            const SizedBox(height: 8),
            for (final x in expenses)
              Card(
                child: ListTile(
                  title: Text(x['note'] as String),
                  subtitle: Text('${x['category']}${x['paidBy'] != null && event != null ? ' · ${x['paidBy'] == 'SHARED' ? (s.bn ? 'যৌথ' : 'Shared') : sideLabel(s, event, x['paidBy'] as String)}' : ''}'),
                  trailing: Text(taka(x['amountMinor'] as int)),
                  onLongPress: event == null || event.readOnly
                      ? null
                      : () async {
                          if (await confirmDialog(context, s.t('delete'), x['note'] as String, destructive: true) && context.mounted) {
                            await attempt(context, () async {
                              await ref.read(apiProvider).delete('events/${event.id}/budget/expenses/${x['id']}');
                              ref.invalidate(eventResource('events/:id/budget'));
                            });
                          }
                        },
                ),
              ),
            if (expenses.isEmpty) EmptyState(s.t('empty')),
          ]);
        },
      ),
    );
  }
}

// ---------------------------------------------------------------------------
class GiftsScreen extends ConsumerWidget {
  const GiftsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final gifts = ref.watch(eventResource('events/:id/gifts'));
    final event = ref.watch(currentEventProvider).value;
    void reload() => ref.invalidate(eventResource('events/:id/gifts'));
    Future<void> add() async {
      final nameC = TextEditingController(), amountC = TextEditingController(), descC = TextEditingController();
      String kind = 'CASH';
      final ok = await showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        builder: (c) => StatefulBuilder(
          builder: (c, set) => Padding(
            padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.viewInsetsOf(c).bottom + 16),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextField(controller: nameC, autofocus: true, decoration: InputDecoration(labelText: s.bn ? 'কার কাছ থেকে' : 'From')),
              const SizedBox(height: 10),
              SegmentedButton<String>(
                segments: [
                  ButtonSegment(value: 'CASH', label: Text(s.bn ? 'নগদ' : 'Cash')),
                  ButtonSegment(value: 'GIFT', label: Text(s.bn ? 'উপহার' : 'Gift')),
                  ButtonSegment(value: 'GOLD', label: Text(s.bn ? 'স্বর্ণ' : 'Gold')),
                ],
                selected: {kind},
                onSelectionChanged: (v) => set(() => kind = v.first),
              ),
              const SizedBox(height: 10),
              TextField(controller: amountC, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: '৳')),
              const SizedBox(height: 10),
              TextField(controller: descC, decoration: InputDecoration(labelText: s.bn ? 'বিবরণ' : 'Description')),
              const SizedBox(height: 16),
              FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(s.t('save'))),
            ]),
          ),
        ),
      );
      if (ok != true || event == null || !context.mounted) return;
      await attempt(context, () async {
        await ref.read(apiProvider).post('events/${event.id}/gifts', {
          'giverName': nameC.text.trim(),
          'kind': kind,
          if (amountC.text.isNotEmpty) 'amountMinor': ((double.tryParse(amountC.text) ?? 0) * 100).round(),
          if (descC.text.isNotEmpty) 'description': descC.text.trim(),
        });
        reload();
      });
    }

    return Scaffold(
      appBar: AppBar(title: Text(s.bn ? 'উপহার খাতা' : 'Gift register')),
      floatingActionButton: event?.readOnly == false ? FloatingActionButton(onPressed: add, child: const Icon(Icons.add)) : null,
      body: AsyncView(
        value: gifts,
        onRetry: reload,
        builder: (data) {
          if (data == null) return const SizedBox();
          final items = List<Map>.from(data['items'] as List);
          final summary = data['summary'] as Map;
          return ListView(padding: const EdgeInsets.all(16), children: [
            Row(children: [
              StatTile(value: '${summary['count']}', label: s.bn ? 'উপহার' : 'Gifts', icon: Icons.redeem_outlined),
              StatTile(value: taka(summary['cashMinor'] as int, compact: true), label: s.bn ? 'নগদ' : 'Cash', icon: Icons.payments_outlined),
              StatTile(value: '${summary['thankYouPending']}', label: s.bn ? 'ধন্যবাদ বাকি' : 'Thank-yous', icon: Icons.mark_email_unread_outlined),
            ]),
            for (final g in items)
              Card(
                child: CheckboxListTile(
                  title: Text(g['giverName'] as String),
                  subtitle: Text('${g['kind']}${g['amountMinor'] != null ? ' · ${taka(g['amountMinor'] as int)}' : ''}${g['description'] != null ? ' · ${g['description']}' : ''}'),
                  value: g['thankYouSentAt'] != null,
                  secondary: const Icon(Icons.redeem_outlined),
                  onChanged: event == null || event.readOnly
                      ? null
                      : (v) => attempt(context, () async {
                            await ref.read(apiProvider).patch('events/${event.id}/gifts/${g['id']}', {'thankYouSent': v == true});
                            reload();
                          }),
                ),
              ),
            if (items.isEmpty) EmptyState(s.t('empty')),
          ]);
        },
      ),
    );
  }
}
