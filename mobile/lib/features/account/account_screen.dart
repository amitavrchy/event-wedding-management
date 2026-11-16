import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config.dart';
import '../../core/format.dart';
import '../../core/ui/spacing.dart';
import '../../core/providers.dart';
import '../../core/widgets/common.dart';
import '../../models/models.dart';

final sessionsProvider = FutureProvider.autoDispose<List<Json>>(
  (ref) async => List<Json>.from(
    await ref.read(apiProvider).get<List<dynamic>>('auth/sessions'),
  ),
);

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
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.page,
          AppSpacing.page,
          AppSpacing.page,
          AppSpacing.xl,
        ),
        children: [
          ListTile(
            leading: const CircleAvatar(child: Icon(Icons.person)),
            title: Text(user.fullName),
            subtitle: Text(user.email),
          ),
          if (!user.emailVerified)
            ListTile(
              leading: const Icon(
                Icons.mark_email_unread_outlined,
                color: Colors.orange,
              ),
              title: Text(s.t('textConfirmYourEmail')),
              subtitle: Text(s.t('textEnterTheCodeWeEmailed')),
              onTap: () async {
                final code = await _code(context, s.t('textEmailCode'));
                if (code == null || !context.mounted) return;
                await attempt(context, () async {
                  await ref.read(authProvider.notifier).refreshUser();
                  ref
                      .read(authProvider.notifier)
                      .setUser(
                        User.fromJson(
                          await ref.read(apiProvider).post<Json>(
                            'auth/email/verify',
                            {'code': code},
                          ),
                        ),
                      );
                });
              },
            ),
          ListTile(
            title: Text(s.t('language')),
            subtitle: SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'bn', label: Text('বাংলা')),
                ButtonSegment(value: 'en', label: Text('English')),
              ],
              selected: {s.locale},
              onSelectionChanged: (v) => attempt(
                context,
                () => ref.read(localeProvider.notifier).set(v.first),
              ),
            ),
          ),
          ListTile(
            leading: Icon(
              user.twoFactorEnabled
                  ? Icons.verified_user
                  : Icons.shield_outlined,
            ),
            title: Text(s.t('textTwoStepSignIn')),
            subtitle: Text(
              user.twoFactorEnabled
                  ? (s.t('textOn'))
                  : (s.t('textTurnOnFromTheWebsite')),
            ),
            onTap: () => launchUrl(
              Uri.parse('${AppConfig.webUrl}/account'),
              mode: LaunchMode.externalApplication,
            ),
          ),
          const Divider(),
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.page,
              AppSpacing.sm,
              AppSpacing.page,
              0,
            ),
            child: Text(
              s.t('devices'),
              style: Theme.of(context).textTheme.titleSmall,
            ),
          ),
          ...sessions.when(
            data: (list) => [
              for (final x in list)
                ListTile(
                  leading: Icon(
                    x['client'] == 'mobile'
                        ? Icons.phone_android
                        : Icons.laptop,
                  ),
                  title: Text(
                    (x['deviceName'] as String?) ??
                        (x['client'] == 'mobile'
                            ? s.t('appDevice')
                            : s.t('webBrowser')),
                  ),
                  subtitle: Text(
                    x['current'] == true
                        ? (s.t('textThisDevice'))
                        : _sessionDate(
                            x['lastUsedAt'],
                            s.locale,
                            s.t('unknownDate'),
                          ),
                  ),
                  trailing: x['current'] == true
                      ? null
                      : IconButton(
                          icon: const Icon(Icons.logout),
                          onPressed: () => attempt(context, () async {
                            await ref
                                .read(apiProvider)
                                .delete('auth/sessions/${x['id']}');
                            ref.invalidate(sessionsProvider);
                          }),
                        ),
                ),
            ],
            loading: () => [const LinearProgressIndicator()],
            error: (_, _) => [],
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.description_outlined),
            title: Text(s.t('textTermsPrivacy')),
            onTap: () => launchUrl(
              Uri.parse('${AppConfig.webUrl}/privacy'),
              mode: LaunchMode.externalApplication,
            ),
          ),
          ListTile(
            leading: const Icon(Icons.logout),
            title: Text(s.t('signOut')),
            onTap: () => ref.read(authProvider.notifier).logout(),
          ),
          ListTile(
            leading: Icon(
              Icons.delete_forever_outlined,
              color: Colors.red.shade700,
            ),
            title: Text(
              s.t('deleteAccount'),
              style: TextStyle(color: Colors.red.shade700),
            ),
            onTap: () async {
              if (!await confirmDialog(
                context,
                s.t('deleteAccount'),
                s.t('deleteAccountWarn'),
                confirm: s.t('delete'),
                destructive: true,
              )) {
                return;
              }
              if (!context.mounted) return;
              final password = await _code(
                context,
                s.t('password'),
                obscure: true,
              );
              if (password == null || !context.mounted) return;
              final ok = await attempt(
                context,
                () => ref.read(apiProvider).delete('auth/me', {
                  'password': password,
                }),
              );
              if (ok) await ref.read(authProvider.notifier).logout();
            },
          ),
          const SizedBox(height: AppSpacing.lg),
        ],
      ),
    );
  }
}

Future<String?> _code(
  BuildContext context,
  String label, {
  bool obscure = false,
}) {
  final c = TextEditingController();
  return showDialog<String>(
    context: context,
    builder: (d) => AlertDialog(
      title: Text(label),
      content: TextField(
        controller: c,
        autofocus: true,
        obscureText: obscure,
        keyboardType: obscure
            ? TextInputType.visiblePassword
            : TextInputType.number,
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
          onPressed: () => Navigator.pop(d, c.text.trim()),
          child: Text(
            ProviderScope.containerOf(context).read(stringsProvider).t('ok'),
          ),
        ),
      ],
    ),
  );
}

String _sessionDate(Object? value, String locale, String fallback) {
  final date = DateTime.tryParse(value?.toString() ?? '');
  return date == null ? fallback : dateLabel(date.toLocal(), locale: locale);
}
