import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../core/format.dart';
import '../../core/providers.dart';
import '../../core/realtime.dart';
import '../../core/strings.dart';
import '../../core/ui/spacing.dart';
import '../../core/widgets/common.dart';
import '../../models/models.dart';

final conversationsProvider = FutureProvider.autoDispose<List<Json>>((
  ref,
) async {
  ref.watch(currentUserProvider);
  final list = await ref.read(apiProvider).get<List<dynamic>>('conversations');
  return List<Json>.from(list);
});

class ConversationsScreen extends ConsumerWidget {
  const ConversationsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final user = ref.watch(currentUserProvider);
    final list = ref.watch(conversationsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(s.t('messages'))),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(conversationsProvider),
        child: AsyncView(
          value: list,
          onRetry: () => ref.invalidate(conversationsProvider),
          builder: (items) => items.isEmpty
              ? ListView(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.page,
                    AppSpacing.page,
                    AppSpacing.page,
                    AppSpacing.xl,
                  ),
                  children: [
                    EmptyState(
                      s.t('empty'),
                      subtitle: s.t('textSendAVendorAnInquiry'),
                    ),
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
                    for (final c in items)
                      ListTile(
                        leading: const CircleAvatar(
                          child: Icon(Icons.chat_bubble_outline),
                        ),
                        title: Text(
                          ((user?.isVendor ?? false)
                                      ? c['eventTitle']
                                      : c['vendorName'])
                                  as String? ??
                              s.t('message'),
                        ),
                        subtitle: Text(
                          ((c['lastMessage'] as Map?)?['body'] as String?) ??
                              '',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        onTap: () => context.push('/chat/${c['id']}'),
                      ),
                  ],
                ),
        ),
      ),
    );
  }
}

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key, required this.id});
  final String id;
  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final List<Json> messages = [];
  final input = TextEditingController();
  final scroll = ScrollController();
  bool loading = true;
  io.Socket? socket;

  @override
  void initState() {
    super.initState();
    _load();
    socket = ref.read(socketProvider);
    socket?.on('message', _onMessage);
    socket?.onConnect(_join);
    if (socket?.connected == true) _join(null);
  }

  void _join(dynamic _) {
    socket?.emitWithAck(
      'join',
      widget.id,
      ack: (result) {
        if (mounted && result is Map && result['ok'] == true) _load();
      },
    );
  }

  void _onMessage(dynamic data) {
    if (data is! Map || data['conversationId'] != widget.id || !mounted) return;
    if (messages.any((m) => m['id'] == data['id'])) return;
    setState(() => messages.add(Json.from(data)));
    _bottom();
  }

  Future<void> _load() async {
    try {
      final list = await ref
          .read(apiProvider)
          .get<List<dynamic>>('conversations/${widget.id}/messages');
      if (!mounted) return;
      setState(() {
        final known = {for (final m in list) m['id']};
        final newer = messages.where((m) => !known.contains(m['id'])).toList();
        messages
          ..clear()
          ..addAll(List<Json>.from(list))
          ..addAll(newer);
        loading = false;
      });
      _bottom();
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  void _bottom() => WidgetsBinding.instance.addPostFrameCallback((_) {
    if (scroll.hasClients) scroll.jumpTo(scroll.position.maxScrollExtent);
  });

  @override
  void dispose() {
    socket?.off('connect', _join);
    socket?.off('message', _onMessage);
    socket?.emit('leave', widget.id);
    input.dispose();
    scroll.dispose();
    super.dispose();
  }

  Future<void> send() async {
    final text = input.text.trim();
    if (text.isEmpty) return;
    input.clear();
    try {
      final message = await ref.read(apiProvider).post<Json>(
        'conversations/${widget.id}/messages',
        {'body': text},
      );
      _onMessage(message);
    } catch (e) {
      input.text = text;
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final me = ref.watch(currentUserProvider)?.id;
    return Scaffold(
      appBar: AppBar(title: Text(s.t('message'))),
      body: Column(
        children: [
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : ListView.builder(
                    controller: scroll,
                    padding: const EdgeInsets.all(AppSpacing.page),
                    itemCount: messages.length,
                    itemBuilder: (_, i) {
                      final m = messages[i];
                      final mine = m['senderId'] == me;
                      return Align(
                        alignment: mine
                            ? Alignment.centerRight
                            : Alignment.centerLeft,
                        child: Container(
                          constraints: BoxConstraints(
                            maxWidth: MediaQuery.sizeOf(context).width * 0.78,
                          ),
                          margin: const EdgeInsets.symmetric(
                            vertical: AppSpacing.xs,
                          ),
                          padding: const EdgeInsets.all(AppSpacing.md),
                          decoration: BoxDecoration(
                            color: mine
                                ? Theme.of(context).colorScheme.primaryContainer
                                : Colors.white,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(m['body'] as String),
                              Text(
                                dateTimeLabel(
                                  DateTime.parse(m['createdAt'] as String)
                                      .toLocal(),
                                  locale: s.locale,
                                ),
                                style: Theme.of(context).textTheme.labelSmall,
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.page),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: input,
                      minLines: 1,
                      maxLines: 4,
                      decoration: InputDecoration(hintText: s.t('message')),
                      onSubmitted: (_) => send(),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  IconButton.filled(
                    onPressed: send,
                    tooltip: s.t('sendMessage'),
                    icon: const Icon(Icons.send),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

final notificationsProvider = FutureProvider.autoDispose<List<Json>>(
  (ref) async => List<Json>.from(
    await ref.read(apiProvider).get<List<dynamic>>('notifications'),
  ),
);

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final list = ref.watch(notificationsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(s.t('alerts'))),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(notificationsProvider),
        child: AsyncView(
          value: list,
          builder: (items) => items.isEmpty
              ? ListView(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.page,
                    AppSpacing.page,
                    AppSpacing.page,
                    AppSpacing.xl,
                  ),
                  children: [EmptyState(s.t('empty'))],
                )
              : ListView(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.page,
                    AppSpacing.page,
                    AppSpacing.page,
                    AppSpacing.xl,
                  ),
                  children: [
                    for (final n in items)
                      ListTile(
                        leading: Icon(
                          n['read'] == true
                              ? Icons.notifications_none
                              : Icons.notifications_active,
                          color: n['read'] == true
                              ? null
                              : Theme.of(context).colorScheme.primary,
                        ),
                        title: Text(localizedNotification(s, n).$1),
                        subtitle: Text(localizedNotification(s, n).$2),
                        onTap: () async {
                          await ref
                              .read(apiProvider)
                              .patch('notifications/${n['id']}/read')
                              .catchError((_) => null);
                          ref.invalidate(notificationsProvider);
                          final link = n['link'] as String?;
                          if (link != null && context.mounted) {
                            openLink(context, link);
                          }
                        },
                      ),
                  ],
                ),
        ),
      ),
    );
  }
}

/// Translate known system-generated notification templates. Unknown text is
/// retained because automation rules, messages and review notes are user-authored.
(String, String) localizedNotification(S s, Json notification) {
  final title = notification['title'] as String? ?? '';
  final body = notification['body'] as String? ?? '';
  const titles = {
    'notificationTitlePayment': 'A little payment reminder',
    'notificationTitleMilestone': 'A payment milestone is coming up',
    'notificationTitleTask': 'One lovely detail is nearly due',
    'notificationTitleRsvp': 'A little nudge for your guest list',
    'notificationTitleInquiry': 'An inquiry is waiting for you',
    'notificationTitleActive': 'Your plan is active',
    'notificationTitlePaymentFailed': 'We could not confirm your payment',
    'notificationTitleRenewal': 'Your plan renews soon',
    'notificationTitleVerified': 'Your business is verified',
    'notificationTitleVerification': 'Verification needs another look',
    'notificationTitleReviewRequest': 'How did it go?',
    'notificationTitleAccepted': 'Your quotation was accepted',
    'notificationTitleDeclined': 'Your quotation was declined',
    'notificationTitleBooking': 'Your booking is recorded',
    'notificationTitleMessage': 'New message',
    'notificationTitleNewInquiry': 'New inquiry on Ayojon',
    'notificationTitleQuote': 'You received a quotation',
    'notificationTitleBookingUpdate': 'Booking update',
    'notificationTitleInvite': "You're invited to plan together",
  };
  String? key;
  for (final entry in titles.entries) {
    if (title == entry.value || title == S.of('bn').t(entry.key)) {
      key = entry.key;
      break;
    }
  }
  var resultTitle = key == null ? title : s.t(key);
  var resultBody = body;
  String fill(String k, Map<String, String> vars) => s.format(k, vars);
  String date(String raw) {
    if (raw == 'a date to confirm') return s.t('dateToConfirm');
    final value = DateTime.tryParse(normalizedDigits(raw));
    return value == null ? raw : dateLabel(value, locale: s.locale);
  }

  String amount(String raw) => taka(
    (double.tryParse(normalizedDigits(raw).replaceAll(',', '')) ?? 0) * 100,
    locale: s.locale,
  );
  Match? m;
  if ((m = RegExp(r'^New (\d+)★ review$').firstMatch(title)) != null) {
    resultTitle = fill('notificationReviewTitle', {
      'rating': numberLabel(int.parse(m![1]!), locale: s.locale),
    });
  } else if ((m = RegExp(r'^(.*) has arrived$').firstMatch(title)) != null) {
    resultTitle = fill('notificationArrivedTitle', {
      'name': m![1] == 'A vendor' ? s.t('vendorFallback') : m[1]!,
    });
  } else if ((m = RegExp(r'^Your (\d{4}-\d{2}) report$').firstMatch(title)) !=
      null) {
    resultTitle = fill('notificationReportTitle', {
      'month': monthLabel(DateTime.parse('${m![1]}-01'), locale: s.locale),
    });
    final report = RegExp(
      r'^(\d+) inquiries, (\d+) bookings(?:, average reply (\d+) min)?\.$',
    ).firstMatch(body);
    if (report != null) {
      final summary = fill('notificationReportBody', {
        'inquiries': numberLabel(int.parse(report[1]!), locale: s.locale),
        'bookings': numberLabel(int.parse(report[2]!), locale: s.locale),
      });
      resultBody = report[3] == null
          ? fill('notificationReportNoAverage', {'summary': summary})
          : fill('notificationReportAverage', {
              'summary': summary,
              'minutes': numberLabel(int.parse(report[3]!), locale: s.locale),
            });
    }
  }
  if (key == 'notificationTitleVerified' &&
      body == 'The Verified badge now shows on your profile.') {
    resultBody = s.t('notificationVerifiedBody');
  }
  if (key == 'notificationTitleReviewRequest' &&
      body ==
          'Your booking is complete. A short review helps other families choose well.') {
    resultBody = s.t('notificationReviewRequestBody');
  }
  if (key == 'notificationTitleBooking' &&
      body == 'Arrange the advance and balance directly with your vendor.') {
    resultBody = s.t('notificationBookingBody');
  }
  if (key == 'notificationTitleInquiry' &&
      (m = RegExp(r'^(.*) asked a day ago\. Quick replies win more bookings\.$')
              .firstMatch(body)) !=
          null) {
    resultBody = fill('notificationInquiryBody', {'name': m![1]!});
  }
  if (key == 'notificationTitleRsvp' &&
      (m = RegExp(
            r'^(\d+) invitation replies are still pending for (.*)\. Share their public invitation links before the deadline\.$',
          ).firstMatch(body)) !=
          null) {
    resultBody = fill('notificationRsvpBody', {
      'count': numberLabel(int.parse(m![1]!), locale: s.locale),
      'event': m[2]!,
    });
  }
  if (key == 'notificationTitlePayment' &&
      (m = RegExp(
            r'^Your (.*) booking is coming up\. Balance remaining: BDT ([\d,.]+)\.$',
          ).firstMatch(body)) !=
          null) {
    resultBody = fill('notificationBalanceBody', {
      'service': m![1]!,
      'amount': amount(m[2]!),
    });
  }
  if (key == 'notificationTitleMilestone' &&
      (m = RegExp(r'^(.*): BDT ([\d,.]+) due (\d{4}-\d{2}-\d{2})\.$')
              .firstMatch(body)) !=
          null) {
    resultBody = fill('notificationInstallmentBody', {
      'label': m![1]!,
      'amount': amount(m[2]!),
      'date': date(m[3]!),
    });
  }
  if (key == 'notificationTitleRenewal' &&
      (m = RegExp(
            r'^Your (.*) plan ends on (\d{4}-\d{2}-\d{2})\. Renew to keep your listing benefits\.$',
          ).firstMatch(body)) !=
          null) {
    resultBody = fill('notificationRenewalBody', {
      'plan': s.codeLabel(m![1]!),
      'date': date(m[2]!),
    });
  }
  if (key == 'notificationTitleActive' &&
      (m = RegExp(
            r'^(.*) is active until (\d{4}-\d{2}-\d{2})\. Receipt (.*)\.$',
          ).firstMatch(body)) !=
          null) {
    resultBody = fill('notificationActiveBody', {
      'plan': s.codeLabel(m![1]!),
      'date': date(m[2]!),
      'receipt': m[3]!,
    });
  }
  if ((key == 'notificationTitleAccepted' ||
          key == 'notificationTitleDeclined') &&
      (m = RegExp(r'^BDT ([\d,.]+)$').firstMatch(body)) != null) {
    resultBody = fill('notificationQuoteAmount', {'amount': amount(m![1]!)});
  }
  if (key == 'notificationTitleNewInquiry' &&
      (m = RegExp(r'^(.*) sent you an inquiry for (.*)\. Reply soon: (.*)$')
              .firstMatch(body)) !=
          null) {
    resultBody = fill('notificationInquiryTemplate', {
      'name': m![1]!,
      'date': date(m[2]!),
      'link': m[3]!,
    });
  }
  if (key == 'notificationTitleQuote' &&
      (m = RegExp(r'^(.*) sent a quotation of BDT ([\d,.]+)\. Review it: (.*)$')
              .firstMatch(body)) !=
          null) {
    resultBody = fill('notificationQuoteTemplate', {
      'vendor': m![1]!,
      'amount': amount(m[2]!),
      'link': m[3]!,
    });
  }
  if (key == 'notificationTitleNewInquiry' &&
      (m = RegExp(
            r'^(.*) (\d{4}-\d{2}-\d{2}|a date to confirm) তারিখের জন্য জিজ্ঞাসা পাঠিয়েছেন। দ্রুত উত্তর দিন: (.*)$',
          ).firstMatch(body)) !=
          null) {
    resultBody = fill('notificationInquiryTemplate', {
      'name': m![1]!,
      'date': date(m[2]!),
      'link': m[3]!,
    });
  }
  if (key == 'notificationTitleQuote' &&
      (m = RegExp(r'^(.*) ৳([\d০-৯,.]+) এর কোটেশন পাঠিয়েছে। দেখুন: (.*)$')
              .firstMatch(body)) !=
          null) {
    resultBody = fill('notificationQuoteTemplate', {
      'vendor': m![1]!,
      'amount': amount(m[2]!),
      'link': m[3]!,
    });
  }
  if (key == 'notificationTitleInvite' &&
      (m = RegExp(r'^(.*) invited you to (.*)$').firstMatch(body)) != null) {
    resultBody = fill('notificationInviteBody', {
      'name': m![1]!,
      'workspace': m[2] == 'a workspace' ? s.t('workspaceFallback') : m[2]!,
    });
  }
  if (key == 'notificationTitleBookingUpdate') {
    final booking =
        RegExp(r'^(.*): (.*)\. Details: (.*)$').firstMatch(body) ??
        RegExp(r'^(.*): (.*)। বিস্তারিত: (.*)$').firstMatch(body);
    if (booking != null) {
      String phrase(String raw, Map<String, String> known) {
        for (final entry in known.entries) {
          if (raw == entry.value || raw == S.of('bn').t(entry.key)) {
            return s.t(entry.key);
          }
        }
        return s.codeLabel(raw);
      }

      resultBody = fill('notificationBookingTemplate', {
        'title': phrase(booking[1]!, {
          'bookingRequestTitle': 'New booking request',
          'yourBookingTitle': 'Your booking',
        }),
        'status': phrase(booking[2]!, {
          'bookingWaiting': 'waiting for advance',
          'bookingPleaseConfirm': 'please confirm',
          'bookingConfirmedVendor': 'confirmed by the vendor',
          'bookingCancelledVendor': 'cancelled by the vendor',
        }),
        'link': booking[3]!,
      });
    }
  }
  return (resultTitle, resultBody);
}

/// Maps a web link from a notification to the matching app screen.
void openLink(BuildContext context, String link) {
  final uri = Uri.tryParse(link);
  if (uri == null) return;
  final path = uri.path;
  final conversation = uri.queryParameters['c'];
  if (path.startsWith('/messages') && conversation != null) {
    context.push('/chat/$conversation');
    return;
  }
  const tools = {
    '/bookings': '/tool/bookings',
    '/packages': '/tool/quotes',
    '/gifts': '/tool/gifts',
    '/run-sheet': '/tool/runSheet',
    '/checklist': '/tool/checklist',
    '/guests': '/tool/guests',
    '/business': '/vendor',
    '/studio': '/vendor',
    '/insights': '/vendor',
  };
  final target = tools.entries
      .where((e) => path.startsWith(e.key))
      .firstOrNull
      ?.value;
  if (target != null) context.push(target);
}
