import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config.dart';
import '../../core/providers.dart';
import '../../core/widgets/common.dart';
import '../../models/models.dart';

final sessionsProvider = FutureProvider.autoDispose<List<Json>>((ref) async => List<Json>.from(await ref.read(apiProvider).get<List<dynamic>>('auth/sessions')));

class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final user = ref.watch(currentUserProvider);
    final sessions = ref.watch(sessionsProvider);
    if (user == null) return const SizedBox();
    return Scaffold(
      appBar: AppBar(title: Text(s.t('account'))),
      body: ListView(children: [
        ListTile(leading: const CircleAvatar(child: Icon(Icons.person)), title: Text(user.fullName), subtitle: Text(user.email)),
        if (!user.emailVerified)
          ListTile(
            leading: const Icon(Icons.mark_email_unread_outlined, color: Colors.orange),
            title: Text(s.bn ? 'ইমেইল নিশ্চিত করুন' : 'Confirm your email'),
            subtitle: Text(s.bn ? 'ইমেইলে পাঠানো কোড দিন' : 'Enter the code we emailed you'),
            onTap: () async {
              final code = await _code(context, s.bn ? 'ইমেইল কোড' : 'Email code');
              if (code == null || !context.mounted) return;
              await attempt(context, () async {
                ref.read(authProvider.notifier).setUser(User.fromJson(await ref.read(apiProvider).post<Json>('auth/email/verify', {'code': code})));
              });
            },
          ),
        ListTile(
          leading: const Icon(Icons.translate),
          title: Text(s.t('language')),
          trailing: SegmentedButton<String>(
            segments: const [ButtonSegment(value: 'bn', label: Text('বাংলা')), ButtonSegment(value: 'en', label: Text('English'))],
            selected: {s.locale},
            onSelectionChanged: (v) => attempt(context, () => ref.read(localeProvider.notifier).set(v.first)),
          ),
        ),
        ListTile(
          leading: Icon(user.twoFactorEnabled ? Icons.verified_user : Icons.shield_outlined),
          title: Text(s.bn ? 'দুই ধাপে সাইন-ইন' : 'Two-step sign-in'),
          subtitle: Text(user.twoFactorEnabled ? (s.bn ? 'চালু' : 'On') : (s.bn ? 'ওয়েবসাইট থেকে চালু করুন' : 'Turn on from the website')),
          onTap: () => launchUrl(Uri.parse('${AppConfig.webUrl}/account'), mode: LaunchMode.externalApplication),
        ),
        const Divider(),
        Padding(padding: const EdgeInsets.fromLTRB(16, 8, 16, 0), child: Text(s.t('devices'), style: Theme.of(context).textTheme.titleSmall)),
        ...sessions.when(
          data: (list) => [
            for (final x in list)
              ListTile(
                leading: Icon(x['client'] == 'mobile' ? Icons.phone_android : Icons.laptop),
                title: Text((x['deviceName'] as String?) ?? (x['client'] == 'mobile' ? 'Ayojon app' : 'Web browser')),
                subtitle: Text(x['current'] == true ? (s.bn ? 'এই ডিভাইস' : 'This device') : '${x['lastUsedAt']}'.substring(0, 10)),
                trailing: x['current'] == true
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.logout),
                        onPressed: () => attempt(context, () async {
                          await ref.read(apiProvider).delete('auth/sessions/${x['id']}');
                          ref.invalidate(sessionsProvider);
                        }),
                      ),
              ),
          ],
          loading: () => [const LinearProgressIndicator()],
          error: (_, _) => [],
        ),
        const Divider(),
        ListTile(leading: const Icon(Icons.description_outlined), title: Text(s.bn ? 'শর্তাবলী ও গোপনীয়তা' : 'Terms & privacy'), onTap: () => launchUrl(Uri.parse('${AppConfig.webUrl}/privacy'), mode: LaunchMode.externalApplication)),
        ListTile(leading: const Icon(Icons.logout), title: Text(s.t('signOut')), onTap: () => ref.read(authProvider.notifier).logout()),
        ListTile(
          leading: Icon(Icons.delete_forever_outlined, color: Colors.red.shade700),
          title: Text(s.t('deleteAccount'), style: TextStyle(color: Colors.red.shade700)),
          onTap: () async {
            if (!await confirmDialog(context, s.t('deleteAccount'), s.t('deleteAccountWarn'), confirm: s.t('delete'), destructive: true)) return;
            if (!context.mounted) return;
            final password = await _code(context, s.t('password'), obscure: true);
            if (password == null || !context.mounted) return;
            final ok = await attempt(context, () => ref.read(apiProvider).delete('auth/me', {'password': password}));
            if (ok) await ref.read(authProvider.notifier).logout();
          },
        ),
        const SizedBox(height: 24),
      ]),
    );
  }
}

Future<String?> _code(BuildContext context, String label, {bool obscure = false}) {
  final c = TextEditingController();
  return showDialog<String>(
    context: context,
    builder: (d) => AlertDialog(
      title: Text(label),
      content: TextField(controller: c, autofocus: true, obscureText: obscure, keyboardType: obscure ? TextInputType.visiblePassword : TextInputType.number),
      actions: [TextButton(onPressed: () => Navigator.pop(d), child: const Text('Cancel')), TextButton(onPressed: () => Navigator.pop(d, c.text.trim()), child: const Text('OK'))],
    ),
  );
}
