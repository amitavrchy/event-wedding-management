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
import '../../core/ui/spacing.dart';
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
  final scanner = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
  );
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

  Future<File> _file(String eventId, String dayId) async => File(
    '${(await getApplicationDocumentsDirectory()).path}/checkin-$eventId-$dayId.json',
  );

  Future<void> _persist(EventSummary e) async {
    final f = await _file(e.id, day!.id);
    await f.writeAsString(
      jsonEncode({
        'roster': roster,
        'queue': queue,
        'rosterAt': rosterAt?.toIso8601String(),
      }),
    );
  }

  Future<void> _open(EventSummary e, EventDay d) async {
    setState(() => day = d);
    final f = await _file(e.id, d.id);
    if (await f.exists()) {
      final data = jsonDecode(await f.readAsString()) as Json;
      setState(() {
        roster = Map<String, Json>.from(
          (data['roster'] as Map).map(
            (k, v) => MapEntry(k as String, Json.from(v as Map)),
          ),
        );
        queue = List<Json>.from(
          (data['queue'] as List).map((v) => Json.from(v as Map)),
        );
        rosterAt = data['rosterAt'] == null
            ? null
            : DateTime.parse(data['rosterAt'] as String);
      });
    }
    await download(e);
  }

  Future<void> download(EventSummary e) async {
    try {
      final data = await ref
          .read(apiProvider)
          .get<Json>('events/${e.id}/check-in/${day!.id}/roster');
      final fresh = <String, Json>{
        for (final g in data['guests'] as List)
          (g['token'] as String): Json.from(g as Map),
      };
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
      final result = await ref.read(apiProvider).post<Json>(
        'events/${e.id}/check-in/${day!.id}/sync',
        {
          'items': [
            for (final q in queue)
              {'clientId': q['clientId'], 'token': q['token']},
          ],
        },
      );
      final done = {
        for (final r in result['results'] as List)
          if (r['ok'] == true || r['error'] != null) r['clientId'],
      };
      setState(() => queue.removeWhere((q) => done.contains(q['clientId'])));
      await _persist(e);
    } catch (_) {
      // Still offline; retry on the next connectivity change.
    } finally {
      if (mounted) setState(() => syncing = false);
    }
  }

  Future<void> scanned(EventSummary e, String raw) async {
    if (DateTime.now().difference(lastScan) <
        const Duration(milliseconds: 1500)) {
      return;
    }
    lastScan = DateTime.now();
    final s = ref.read(stringsProvider);
    final token = tokenFromScan(raw);
    final guest = roster[token];
    HapticFeedback.mediumImpact();
    if (online) {
      try {
        final r = await ref.read(apiProvider).post<Json>(
          'events/${e.id}/check-in/${day!.id}',
          {'token': token},
        );
        final g = r['guest'] as Map;
        roster[token]?['arrivedAt'] = DateTime.now().toIso8601String();
        setState(
          () => last = r['duplicate'] == true
              ? s.alreadyArrivedMessage('${g['name']}')
              : s.arrivalMessage(
                  '${g['name']}',
                  numberLabel((g['partySize'] as num?) ?? 1, locale: s.locale),
                ),
        );
        await _persist(e);
        return;
      } catch (err) {
        // A network failure (no HTTP status) falls through to offline handling.
        final error = ApiError.from(err);
        if (error.status != null) {
          setState(() => last = error.localized(ref.read(stringsProvider)));
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
      setState(() => last = s.alreadyArrivedMessage('${guest['name']}'));
      return;
    }
    guest['arrivedAt'] = DateTime.now().toIso8601String();
    queue.add({
      'clientId': '${DateTime.now().microsecondsSinceEpoch}',
      'token': token,
      'at': guest['arrivedAt'],
    });
    setState(
      () => last = s.arrivalMessage(
        '${guest['name']}',
        numberLabel((guest['partySize'] as num?) ?? 1, locale: s.locale),
        pending: true,
      ),
    );
    await _persist(e);
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final event = ref.watch(currentEventProvider).value;
    if (event == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final arrived = roster.values
        .where((g) => g['arrivedAt'] != null)
        .fold<int>(0, (n, g) => n + ((g['partySize'] ?? 1) as int));
    final expected = roster.values.fold<int>(
      0,
      (n, g) => n + ((g['partySize'] ?? 1) as int),
    );
    return Scaffold(
      appBar: AppBar(
        title: Text(s.t('textWelcomeDesk')),
        actions: [
          if (!online)
            Padding(
              padding: const EdgeInsets.only(right: AppSpacing.page),
              child: Tooltip(
                message: s.t('offline'),
                child: const Icon(Icons.cloud_off_outlined),
              ),
            ),
        ],
      ),
      body: SafeArea(
        child: day == null
            ? ListView(
                padding: const EdgeInsets.all(AppSpacing.page),
                children: [
                  for (final d in event.days)
                    ListTile(
                      leading: const Icon(Icons.event),
                      title: Text(d.name),
                      subtitle: Text(
                        dateTimeLabel(d.startsAt, locale: s.locale),
                      ),
                      onTap: () => _open(event, d),
                    ),
                  if (event.days.isEmpty)
                    EmptyState(s.t('textAddAnEventDayFirst')),
                ],
              )
            : ListView(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.page,
                  AppSpacing.page,
                  AppSpacing.page,
                  AppSpacing.xl,
                ),
                children: [
                  SizedBox(
                    height: 200,
                    child: MobileScanner(
                      controller: scanner,
                      onDetect: (capture) {
                        final value = capture.barcodes.firstOrNull?.rawValue;
                        if (value != null) scanned(event, value);
                      },
                    ),
                  ),
                  if (last != null)
                    Container(
                      width: double.infinity,
                      color: Colors.green.shade50,
                      padding: const EdgeInsets.all(AppSpacing.md),
                      child: Text(
                        last!,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
                  ListTile(
                    title: Text(
                      s.arrivalTotal(
                        numberLabel(arrived, locale: s.locale),
                        numberLabel(expected, locale: s.locale),
                      ),
                    ),
                    subtitle: Text(
                      [
                        s.pendingCount(
                          numberLabel(queue.length, locale: s.locale),
                        ),
                        if (rosterAt != null)
                          s.rosterUpdated(
                            dateTimeLabel(rosterAt!, locale: s.locale),
                          ),
                      ].join(' · '),
                    ),
                    trailing: queue.isEmpty
                        ? IconButton(
                            icon: const Icon(Icons.download_outlined),
                            tooltip: s.t('downloadRoster'),
                            onPressed: () => download(event),
                          )
                        : IconButton(
                            onPressed: syncing ? null : sync,
                            tooltip: s.t('syncNow'),
                            icon: const Icon(Icons.sync),
                          ),
                  ),
                  for (final g
                      in roster.values.toList()..sort(
                        (a, b) => (a['name'] as String).compareTo(
                          b['name'] as String,
                        ),
                      ))
                    ListTile(
                      dense: true,
                      title: Text(g['name'] as String),
                      subtitle: Text(
                        g['tableLabel'] == null
                            ? numberLabel(
                                (g['partySize'] as num?) ?? 1,
                                locale: s.locale,
                              )
                            : s.partyTable(
                                numberLabel(
                                  (g['partySize'] as num?) ?? 1,
                                  locale: s.locale,
                                ),
                                '${g['tableLabel']}',
                              ),
                      ),
                      trailing: g['arrivedAt'] != null
                          ? const Icon(Icons.check_circle, color: Colors.green)
                          : TextButton(
                              onPressed: () =>
                                  scanned(event, g['token'] as String),
                              child: Text(s.t('arrived')),
                            ),
                    ),
                ],
              ),
      ),
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
      appBar: AppBar(title: Text(s.t('textPhotoWall'))),
      body: SafeArea(
        child: AsyncView(
          value: wall,
          builder: (w) {
            if (w == null || event == null) return const SizedBox();
            final photos = List<Json>.from(w['photos'] as List);
            return ListView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.page,
                AppSpacing.page,
                AppSpacing.page,
                AppSpacing.xl,
              ),
              children: [
                if (w['token'] == null)
                  FilledButton(
                    onPressed: event.readOnly
                        ? null
                        : () => attempt(context, () async {
                            await api.post(
                              'events/${event.id}/photo-wall/settings',
                              {'enabled': true, 'moderation': true},
                            );
                            ref.invalidate(eventResource(path));
                          }),
                    child: Text(s.t('textOpenThePhotoWall')),
                  )
                else
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.qr_code_2),
                      title: Text(s.t('textShareThisLinkOrIts')),
                      subtitle: Text(w['uploadUrl'].toString()),
                      trailing: IconButton(
                        icon: const Icon(Icons.share_outlined),
                        onPressed: () => SharePlus.instance.share(
                          ShareParams(text: '${w['uploadUrl']}'),
                        ),
                      ),
                    ),
                  ),
                const SizedBox(height: AppSpacing.md),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: [
                    for (final entry in {
                      'PENDING': 'textWaiting',
                      'APPROVED': 'textOnWall',
                      'HIDDEN': 'textHidden',
                    }.entries)
                      ChoiceChip(
                        label: Text(s.t(entry.value)),
                        selected: status == entry.key,
                        onSelected: (_) => setState(() => status = entry.key),
                      ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                GridView.count(
                  crossAxisCount: 3,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: AppSpacing.xs,
                  crossAxisSpacing: AppSpacing.xs,
                  children: [
                    for (final p in photos)
                      GestureDetector(
                        onTap: event.readOnly
                            ? null
                            : () => showModalBottomSheet(
                                context: context,
                                builder: (c) => SafeArea(
                                  child: Padding(
                                    padding: const EdgeInsets.all(
                                      AppSpacing.page,
                                    ),
                                    child: SingleChildScrollView(
                                      child: Column(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Image.network(
                                            api.absoluteUrl(p['url'] as String),
                                            height: 260,
                                            fit: BoxFit.contain,
                                          ),
                                          ListTile(
                                            leading: const Icon(Icons.check),
                                            title: Text(s.t('textApprove')),
                                            onTap: () => _moderate(
                                              c,
                                              event,
                                              p,
                                              'APPROVED',
                                            ),
                                          ),
                                          ListTile(
                                            leading: const Icon(
                                              Icons.visibility_off_outlined,
                                            ),
                                            title: Text(s.t('textHide')),
                                            onTap: () => _moderate(
                                              c,
                                              event,
                                              p,
                                              'HIDDEN',
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                        child: Image.network(
                          api.absoluteUrl(p['url'] as String),
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) =>
                              const ColoredBox(color: Colors.black12),
                        ),
                      ),
                  ],
                ),
                if (photos.isEmpty) EmptyState(s.t('empty')),
              ],
            );
          },
        ),
      ),
    );
  }

  Future<void> _moderate(
    BuildContext sheet,
    EventSummary event,
    Json photo,
    String next,
  ) async {
    Navigator.pop(sheet);
    await attempt(context, () async {
      await ref.read(apiProvider).patch(
        'events/${event.id}/photo-wall/${photo['id']}',
        {'status': next},
      );
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
      appBar: AppBar(title: Text(s.t('textRunSheet'))),
      body: SafeArea(
        child: AsyncView(
          value: cues,
          builder: (list) {
            final items = List<Json>.from(
              ((list is Map ? list['items'] : list) ?? const []) as List,
            );
            if (items.isEmpty) return EmptyState(s.t('empty'));
            return ListView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.page,
                AppSpacing.page,
                AppSpacing.page,
                AppSpacing.xl,
              ),
              children: [
                for (final c in items)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(AppSpacing.page),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            timeLabel(
                              DateTime.parse(c['startsAt'] as String).toLocal(),
                              locale: s.locale,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Text(
                            c['title'] as String,
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          Text(
                            s.cueDetails(
                              '${c['owner']}',
                              numberLabel(
                                c['durationMinutes'] as num,
                                locale: s.locale,
                              ),
                            ),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          event?.readOnly == false
                              ? PopupMenuButton<String>(
                                  child: Chip(
                                    label: Text(
                                      s.codeLabel(c['status'] as String),
                                    ),
                                  ),
                                  onSelected: (v) => attempt(context, () async {
                                    await ref.read(apiProvider).patch(
                                      'events/${event!.id}/run-sheet/${c['id']}',
                                      {'status': v, 'version': c['version']},
                                    );
                                    ref.invalidate(
                                      eventResource('events/:id/run-sheet'),
                                    );
                                  }),
                                  itemBuilder: (_) => [
                                    for (final st in ['READY', 'LIVE', 'DONE'])
                                      PopupMenuItem(
                                        value: st,
                                        child: Text(s.codeLabel(st)),
                                      ),
                                  ],
                                )
                              : Chip(
                                  label: Text(
                                    s.codeLabel(c['status'] as String),
                                  ),
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
