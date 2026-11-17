import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';
import '../../core/widgets/common.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final email = TextEditingController(), password = TextEditingController(), code = TextEditingController();
  String? challenge;
  bool busy = false;

  Future<void> submit() async {
    setState(() => busy = true);
    final auth = ref.read(authProvider.notifier);
    try {
      if (challenge != null) {
        await auth.secondFactor(challenge!, code.text.trim());
      } else {
        await auth.login(email.text.trim(), password.text);
      }
    } on TwoFactorRequired catch (e) {
      setState(() => challenge = e.challenge);
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(s.t('signIn'))),
      body: AutofillGroup(
        child: ListView(padding: const EdgeInsets.all(16), children: [
          if (challenge == null) ...[
            TextField(controller: email, keyboardType: TextInputType.emailAddress, autofillHints: const [AutofillHints.email], decoration: InputDecoration(labelText: s.t('email'))),
            const SizedBox(height: 12),
            TextField(controller: password, obscureText: true, autofillHints: const [AutofillHints.password], decoration: InputDecoration(labelText: s.t('password')), onSubmitted: (_) => submit()),
          ] else
            TextField(controller: code, keyboardType: TextInputType.number, maxLength: 6, autofocus: true, autofillHints: const [AutofillHints.oneTimeCode], decoration: InputDecoration(labelText: s.t('twoFactorCode'))),
          const SizedBox(height: 16),
          FilledButton(onPressed: busy ? null : submit, child: busy ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2)) : Text(challenge == null ? s.t('signIn') : s.t('verify'))),
          TextButton(onPressed: () => context.push('/forgot'), child: Text(s.t('forgot'))),
        ]),
      ),
    );
  }
}

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key, this.role = 'HOST'});
  final String role;
  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final name = TextEditingController(), email = TextEditingController(), password = TextEditingController();
  bool busy = false;

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final vendor = widget.role == 'VENDOR';
    return Scaffold(
      appBar: AppBar(title: Text(s.t('signUp'))),
      body: AutofillGroup(
        child: ListView(padding: const EdgeInsets.all(16), children: [
          if (vendor) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(s.t('imVendor'), style: Theme.of(context).textTheme.titleMedium)),
          TextField(controller: name, textCapitalization: TextCapitalization.words, autofillHints: const [AutofillHints.name], decoration: InputDecoration(labelText: s.t('fullName'))),
          const SizedBox(height: 12),
          TextField(controller: email, keyboardType: TextInputType.emailAddress, autofillHints: const [AutofillHints.email], decoration: InputDecoration(labelText: s.t('email'))),
          const SizedBox(height: 12),
          TextField(controller: password, obscureText: true, autofillHints: const [AutofillHints.newPassword], decoration: InputDecoration(labelText: s.t('password'), helperText: s.bn ? 'কমপক্ষে ১০ অক্ষর' : 'At least 10 characters')),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: busy
                ? null
                : () async {
                    setState(() => busy = true);
                    await attempt(context, () => ref.read(authProvider.notifier).register(
                          fullName: name.text.trim(),
                          email: email.text.trim(),
                          password: password.text,
                          role: widget.role,
                          locale: ref.read(localeProvider),
                        ));
                    if (mounted) setState(() => busy = false);
                  },
            child: Text(s.t('signUp')),
          ),
          TextButton(onPressed: () => context.push('/login'), child: Text(s.t('haveAccount'))),
          const SizedBox(height: 8),
          Text(
            s.bn ? 'অ্যাকাউন্ট খুলে আপনি আমাদের শর্তাবলী ও গোপনীয়তা নীতিতে সম্মত হচ্ছেন।' : 'By creating an account you agree to our terms and privacy policy.',
            style: Theme.of(context).textTheme.bodySmall,
            textAlign: TextAlign.center,
          ),
        ]),
      ),
    );
  }
}

class ForgotScreen extends ConsumerStatefulWidget {
  const ForgotScreen({super.key});
  @override
  ConsumerState<ForgotScreen> createState() => _ForgotScreenState();
}

class _ForgotScreenState extends ConsumerState<ForgotScreen> {
  final email = TextEditingController();
  bool sent = false;
  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(s.t('forgot'))),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        if (sent)
          Card(child: Padding(padding: const EdgeInsets.all(16), child: Text(s.t('resetSent'))))
        else ...[
          TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: InputDecoration(labelText: s.t('email'))),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () async {
              final ok = await attempt(context, () => ref.read(apiProvider).post('auth/password/forgot', {'email': email.text.trim()}));
              if (ok) setState(() => sent = true);
            },
            child: Text(s.t('sendReset')),
          ),
        ],
      ]),
    );
  }
}
