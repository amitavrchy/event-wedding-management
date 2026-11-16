import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/api/api_error.dart';
import '../../core/format.dart';
import '../../core/providers.dart';
import '../../core/widgets/common.dart';
import '../../models/models.dart';
import 'planning_tools.dart';

/// Offline-capable welcome desk. The roster (accepted guests' tokens) is
/// cached on the phone; arrivals scanned without signal are queued and synced
/// when the connection returns. The server applies each arrival once.
class CheckInScreen extends ConsumerStatefulWidget {
  const CheckInScreen({super.key});
  @override
  ConsumerState<CheckInScreen> createState() => _CheckInScreenState();
}

class _CheckInScreenState extends ConsumerState<CheckInScreen> {
  EventDay? day;
  Map<String, Json> roster = {}; // token -> guest
  List<Json> queue = []; // {clientId, token}
  DateTime? rosterAt;
  String? last;
  bool online = true, syncing = false;
  StreamSubscription<List<ConnectivityResult>>? sub;
  final scanner = MobileScannerController(detectionSpeed: DetectionSpeed.noDuplicates);
  DateTime lastScan = DateTime.fromMillisecondsSinceEpoch(0);

  @override
  void initState() {
    super.initState();
    sub = Connectivity().onConnectivityChanged.listen((r) {
      final now = !r.contains(ConnectivityResult.none);
      setState(() => online = now);
      if (now) sync();
    });
  }

  @override
  void dispose() {
    sub?.cancel();
    scanner.dispose();
    super.dispose();
  }

  Future<File> _file(String eventId, String dayId) async => File('${(await getApplicationDocumentsDirectory()).path}/checkin-$eventId-$dayId.json');

  Future<void> _persist(EventSummary e) async {
    final f = await _file(e.id, day!.id);
    await f.writeAsString(jsonEncode({'roster': roster, 'queue': queue, 'rosterAt': rosterAt?.toIso8601String()}));
  }

  Future<void> _open(EventSummary e, EventDay d) async {
    setState(() => day = d);
    final f = await _file(e.id, d.id);
    if (await f.exists()) {
      final data = jsonDecode(await f.readAsString()) as Json;
      setState(() {
        roster = Map<String, Json>.from((data['roster'] as Map).map((k, v) => MapEntry(k as String, Json.from(v as Map))));
        queue = List<Json>.from((data['queue'] as List).map((v) => Json.from(v as Map)));
        rosterAt = data['rosterAt'] == null ? null : DateTime.parse(data['rosterAt'] as String);
      });
    }
    await download(e);
  }

  Future<void> download(EventSummary e) async {
    try {
      final data = await ref.read(apiProvider).get<Json>('events/${e.id}/check-in/${day!.id}/roster');
      final fresh = <String, Json>{for (final g in data['guests'] as List) (g['token'] as String): Json.from(g as Map)};
      // Keep local arrivals that have not synced yet.
      for (final q in queue) {
        fresh[q['token']]?['arrivedAt'] ??= q['at'];
      }
      setState(() {
        roster = fresh;
        rosterAt = DateTime.now();
      });
      await _persist(e);
    } catch (_) {
      // Offline: keep the cached roster.
    }
  }

  Future<void> sync() async {
    final e = ref.read(currentEventProvider).value;
    if (e == null || day == null || queue.isEmpty || syncing) return;
    setState(() => syncing = true);
    try {
      final result = await ref.read(apiProvider).post<Json>('events/${e.id}/check-in/${day!.id}/sync', {
        'items': [for (final q in queue) {'clientId': q['clientId'], 'token': q['token']}],
      });
      final done = {for (final r in result['results'] as List) if (r['ok'] == true || r['error'] != null) r['clientId']};
      setState(() => queue.removeWhere((q) => done.contains(q['clientId'])));
      await _persist(e);
    } catch (_) {
      // Still offline; retry on the next connectivity change.
    } finally {
      if (mounted) setState(() => syncing = false);
    }
  }

  Future<void> scanned(EventSummary e, String raw) async {
    if (DateTime.now().difference(lastScan) < const Duration(milliseconds: 1500)) return;
    lastScan = DateTime.now();
    final s = ref.read(stringsProvider);
    final token = tokenFromScan(raw);
    final guest = roster[token];
    HapticFeedback.mediumImpact();
    if (online) {
      try {
        final r = await ref.read(apiProvider).post<Json>('events/${e.id}/check-in/${day!.id}', {'token': token});
        final g = r['guest'] as Map;
        roster[token]?['arrivedAt'] = DateTime.now().toIso8601String();
        setState(() => last = r['duplicate'] == true ? '${g['name']}: ${s.t('alreadyArrived')}' : '${g['name']} · ${g['partySize']} — ${s.t('arrived')} ✓');
        await _persist(e);
        return;
      } catch (err) {
        // A network failure (no HTTP status) falls through to offline handling.
        final error = ApiError.from(err);
        if (error.status != null) {
          setState(() => last = error.message);
          return;
        }
        setState(() => online = false);
      }
    }
    if (guest == null) {
      setState(() => last = s.t('notInvited'));
      return;
    }
    if (guest['arrivedAt'] != null) {
      setState(() => last = '${guest['name']}: ${s.t('alreadyArrived')}');
      return;
    }
    guest['arrivedAt'] = DateTime.now().toIso8601String();
    queue.add({'clientId': '${DateTime.now().microsecondsSinceEpoch}', 'token': token, 'at': guest['arrivedAt']});
    setState(() => last = '${guest['name']} · ${guest['partySize']} — ${s.t('arrived')} ✓ (${s.t('pendingSync')})');
    await _persist(e);
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final event = ref.watch(currentEventProvider).value;
    if (event == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final arrived = roster.values.where((g) => g['arrivedAt'] != null).fold<int>(0, (n, g) => n + ((g['partySize'] ?? 1) as int));
    final expected = roster.values.fold<int>(0, (n, g) => n + ((g['partySize'] ?? 1) as int));
    return Scaffold(
      appBar: AppBar(title: Text(s.bn ? 'স্বাগত ডেস্ক' : 'Welcome desk'), actions: [
        if (!online) Padding(padding: const EdgeInsets.only(right: 12), child: Chip(label: Text(s.t('offline')))),
      ]),
      body: day == null
          ? ListView(children: [
              for (final d in event.days) ListTile(leading: const Icon(Icons.event), title: Text(d.name), subtitle: Text(dateTimeLabel(d.startsAt, locale: s.locale)), onTap: () => _open(event, d)),
              if (event.days.isEmpty) EmptyState(s.bn ? 'আগে অনুষ্ঠানের দিন যোগ করুন' : 'Add an event day first'),
            ])
          : Column(children: [
              SizedBox(
                height: 280,
                child: MobileScanner(controller: scanner, onDetect: (capture) {
                  final value = capture.barcodes.firstOrNull?.rawValue;
                  if (value != null) scanned(event, value);
                }),
              ),
              if (last != null) Container(width: double.infinity, color: Colors.green.shade50, padding: const EdgeInsets.all(12), child: Text(last!, style: Theme.of(context).textTheme.titleMedium)),
              ListTile(
                title: Text('$arrived / $expected ${s.t('arrived').toLowerCase()}'),
                subtitle: Text('${queue.length} ${s.t('pendingSync')} · ${rosterAt == null ? '' : (s.bn ? 'তালিকা ' : 'List ') + dateTimeLabel(rosterAt!, locale: s.locale)}'),
                trailing: queue.isEmpty ? IconButton(icon: const Icon(Icons.download_outlined), tooltip: s.t('downloadRoster'), onPressed: () => download(event)) : TextButton(onPressed: syncing ? null : sync, child: Text(s.t('syncNow'))),
              ),
              Expanded(
                child: ListView(children: [
                  for (final g in roster.values.toList()..sort((a, b) => (a['name'] as String).compareTo(b['name'] as String)))
                    ListTile(
                      dense: true,
                      title: Text(g['name'] as String),
                      subtitle: Text('${g['partySize']}${g['tableLabel'] != null ? ' · ${g['tableLabel']}' : ''}'),
                      trailing: g['arrivedAt'] != null ? const Icon(Icons.check_circle, color: Colors.green) : TextButton(onPressed: () => scanned(event, g['token'] as String), child: Text(s.t('arrived'))),
                    ),
                ]),
              ),
            ]),
    );
  }
}

// ---------------------------------------------------------------------------
class PhotoWallScreen extends ConsumerStatefulWidget {
  const PhotoWallScreen({super.key});
  @override
  ConsumerState<PhotoWallScreen> createState() => _PhotoWallScreenState();
}

class _PhotoWallScreenState extends ConsumerState<PhotoWallScreen> {
  String status = 'PENDING';
  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final path = 'events/:id/photo-wall?status=$status';
    final wall = ref.watch(eventResource(path));
    final event = ref.watch(currentEventProvider).value;
    final api = ref.read(apiProvider);
    return Scaffold(
      appBar: AppBar(title: Text(s.bn ? 'ফটো ওয়াল' : 'Photo wall')),
      body: AsyncView(
        value: wall,
        builder: (w) {
          if (w == null || event == null) return const SizedBox();
          final photos = List<Json>.from(w['photos'] as List);
          return ListView(padding: const EdgeInsets.all(12), children: [
            if (w['token'] == null)
              FilledButton(
                onPressed: event.readOnly ? null : () => attempt(context, () async {
                  await api.post('events/${event.id}/photo-wall/settings', {'enabled': true, 'moderation': true});
                  ref.invalidate(eventResource(path));
                }),
                child: Text(s.bn ? 'ফটো ওয়াল চালু করুন' : 'Open the photo wall'),
              )
            else
              Card(
                child: ListTile(
                  leading: const Icon(Icons.qr_code_2),
                  title: Text(s.bn ? 'অতিথিদের এই লিংক/QR দিন' : 'Share this link or its QR with guests'),
                  subtitle: Text('${w['uploadUrl']}'),
                  trailing: IconButton(icon: const Icon(Icons.share_outlined), onPressed: () => SharePlus.instance.share(ShareParams(text: '${w['uploadUrl']}'))),
                ),
              ),
            SegmentedButton<String>(
              segments: [
                ButtonSegment(value: 'PENDING', label: Text(s.bn ? 'অপেক্ষমাণ' : 'Waiting')),
                ButtonSegment(value: 'APPROVED', label: Text(s.bn ? 'ওয়ালে' : 'On wall')),
                ButtonSegment(value: 'HIDDEN', label: Text(s.bn ? 'লুকানো' : 'Hidden')),
              ],
              selected: {status},
              onSelectionChanged: (v) => setState(() => status = v.first),
            ),
            const SizedBox(height: 8),
            GridView.count(
              crossAxisCount: 3,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 4,
              crossAxisSpacing: 4,
              children: [
                for (final p in photos)
                  GestureDetector(
                    onTap: event.readOnly
                        ? null
                        : () => showModalBottomSheet(
                              context: context,
                              builder: (c) => SafeArea(
                                child: Column(mainAxisSize: MainAxisSize.min, children: [
                                  Image.network(api.absoluteUrl(p['url'] as String), height: 260, fit: BoxFit.contain),
                                  ListTile(leading: const Icon(Icons.check), title: Text(s.bn ? 'অনুমোদন' : 'Approve'), onTap: () => _moderate(c, event, p, 'APPROVED')),
                                  ListTile(leading: const Icon(Icons.visibility_off_outlined), title: Text(s.bn ? 'লুকান' : 'Hide'), onTap: () => _moderate(c, event, p, 'HIDDEN')),
                                ]),
                              ),
                            ),
                    child: Image.network(api.absoluteUrl(p['url'] as String), fit: BoxFit.cover, errorBuilder: (_, _, _) => const ColoredBox(color: Colors.black12)),
                  ),
              ],
            ),
            if (photos.isEmpty) EmptyState(s.t('empty')),
          ]);
        },
      ),
    );
  }

  Future<void> _moderate(BuildContext sheet, EventSummary event, Json photo, String next) async {
    Navigator.pop(sheet);
    await attempt(context, () async {
      await ref.read(apiProvider).patch('events/${event.id}/photo-wall/${photo['id']}', {'status': next});
      ref.invalidate(eventResource('events/:id/photo-wall?status=$status'));
    });
  }
}

// ---------------------------------------------------------------------------
class RunSheetScreen extends ConsumerWidget {
  const RunSheetScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final cues = ref.watch(eventResource('events/:id/run-sheet'));
    final event = ref.watch(currentEventProvider).value;
    return Scaffold(
      appBar: AppBar(title: Text(s.bn ? 'রান শিট' : 'Run sheet')),
      body: AsyncView(
        value: cues,
        builder: (list) {
          final items = List<Json>.from(((list is Map ? list['items'] : list) ?? const []) as List);
          if (items.isEmpty) return EmptyState(s.t('empty'));
          return ListView(children: [
            for (final c in items)
              ListTile(
                leading: Text(TimeOfDay.fromDateTime(DateTime.parse(c['startsAt'] as String).toLocal()).format(context)),
                title: Text(c['title'] as String),
                subtitle: Text('${c['owner']} · ${c['durationMinutes']} min'),
                trailing: event?.readOnly == false
                    ? PopupMenuButton<String>(
                        child: Chip(label: Text((c['status'] as String).toLowerCase())),
                        onSelected: (v) => attempt(context, () async {
                          await ref.read(apiProvider).patch('events/${event!.id}/run-sheet/${c['id']}', {'status': v, 'version': c['version']});
                          ref.invalidate(eventResource('events/:id/run-sheet'));
                        }),
                        itemBuilder: (_) => [for (final st in ['READY', 'LIVE', 'DONE']) PopupMenuItem(value: st, child: Text(st.toLowerCase()))],
                      )
                    : Chip(label: Text((c['status'] as String).toLowerCase())),
              ),
          ]);
        },
      ),
    );
  }
}
