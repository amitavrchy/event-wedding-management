import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format.dart';
import '../../core/providers.dart';
import '../../core/realtime.dart';
import '../../core/widgets/common.dart';
import '../../models/models.dart';

final conversationsProvider = FutureProvider.autoDispose<List<Json>>((ref) async {
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
              ? ListView(children: [EmptyState(s.t('empty'), subtitle: s.bn ? 'ভেন্ডরকে জিজ্ঞাসা পাঠালে কথোপকথন এখানে আসবে' : 'Send a vendor an inquiry to start a conversation')])
              : ListView(children: [
                  for (final c in items)
                    ListTile(
                      leading: const CircleAvatar(child: Icon(Icons.chat_bubble_outline)),
                      title: Text(((user?.isVendor ?? false) ? c['eventTitle'] : c['vendorName']) as String? ?? 'Conversation'),
                      subtitle: Text(((c['lastMessage'] as Map?)?['body'] as String?) ?? '', maxLines: 1, overflow: TextOverflow.ellipsis),
                      onTap: () => context.push('/chat/${c['id']}'),
                    ),
                ]),
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

  @override
  void initState() {
    super.initState();
    _load();
    final socket = ref.read(socketProvider);
    socket?.emitWithAck('join', widget.id, ack: (_) {});
    socket?.on('message', _onMessage);
  }

  void _onMessage(dynamic data) {
    if (data is! Map || data['conversationId'] != widget.id || !mounted) return;
    if (messages.any((m) => m['id'] == data['id'])) return;
    setState(() => messages.add(Json.from(data)));
    _bottom();
  }

  Future<void> _load() async {
    try {
      final list = await ref.read(apiProvider).get<List<dynamic>>('conversations/${widget.id}/messages');
      setState(() {
        messages
          ..clear()
          ..addAll(List<Json>.from(list));
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
    final socket = ref.read(socketProvider);
    socket?.off('message', _onMessage);
    socket?.emit('leave', widget.id);
    super.dispose();
  }

  Future<void> send() async {
    final text = input.text.trim();
    if (text.isEmpty) return;
    input.clear();
    try {
      final message = await ref.read(apiProvider).post<Json>('conversations/${widget.id}/messages', {'body': text});
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
      body: Column(children: [
        Expanded(
          child: loading
              ? const Center(child: CircularProgressIndicator())
              : ListView.builder(
                  controller: scroll,
                  padding: const EdgeInsets.all(12),
                  itemCount: messages.length,
                  itemBuilder: (_, i) {
                    final m = messages[i];
                    final mine = m['senderId'] == me;
                    return Align(
                      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
                      child: Container(
                        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.78),
                        margin: const EdgeInsets.symmetric(vertical: 4),
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: mine ? Theme.of(context).colorScheme.primaryContainer : Colors.white,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(m['body'] as String),
                          Text(dateTimeLabel(DateTime.parse(m['createdAt'] as String).toLocal(), locale: s.locale), style: Theme.of(context).textTheme.labelSmall),
                        ]),
                      ),
                    );
                  },
                ),
        ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: Row(children: [
              Expanded(child: TextField(controller: input, minLines: 1, maxLines: 4, decoration: InputDecoration(hintText: s.t('message')), onSubmitted: (_) => send())),
              IconButton.filled(onPressed: send, icon: const Icon(Icons.send)),
            ]),
          ),
        ),
      ]),
    );
  }
}

final notificationsProvider = FutureProvider.autoDispose<List<Json>>((ref) async => List<Json>.from(await ref.read(apiProvider).get<List<dynamic>>('notifications')));

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
              ? ListView(children: [EmptyState(s.t('empty'))])
              : ListView(children: [
                  for (final n in items)
                    ListTile(
                      leading: Icon(n['read'] == true ? Icons.notifications_none : Icons.notifications_active, color: n['read'] == true ? null : Theme.of(context).colorScheme.primary),
                      title: Text(n['title'] as String),
                      subtitle: Text(n['body'] as String),
                      onTap: () async {
                        await ref.read(apiProvider).patch('notifications/${n['id']}/read').catchError((_) => null);
                        ref.invalidate(notificationsProvider);
                        final link = n['link'] as String?;
                        if (link != null && context.mounted) openLink(context, link);
                      },
                    ),
                ]),
        ),
      ),
    );
  }
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
  final target = tools.entries.where((e) => path.startsWith(e.key)).firstOrNull?.value;
  if (target != null) context.push(target);
}
