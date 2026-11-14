import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform;

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/models.dart';
import 'api/api_client.dart';
import 'api/api_error.dart';
import 'auth/token_store.dart';
import 'strings.dart';

final sharedPrefsProvider = Provider<SharedPreferences>((ref) => throw UnimplementedError('Overridden in main'));
final tokenStoreProvider = Provider<TokenStore>((ref) => TokenStore());
final apiProvider = Provider<ApiClient>((ref) {
  final client = ApiClient(ref.watch(tokenStoreProvider));
  client.onSessionExpired = () => ref.read(authProvider.notifier).expire();
  return client;
});

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------
sealed class AuthState {
  const AuthState();
}

class AuthUnknown extends AuthState {
  const AuthUnknown();
}

class SignedOut extends AuthState {
  const SignedOut();
}

class SignedIn extends AuthState {
  const SignedIn(this.user);
  final User user;
}

/// Result of a sign-in attempt that needs a second factor.
class TwoFactorRequired implements Exception {
  TwoFactorRequired(this.challenge);
  final String challenge;
}

final authProvider = NotifierProvider<AuthController, AuthState>(AuthController.new);

class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    Future.microtask(_restore);
    return const AuthUnknown();
  }

  ApiClient get _api => ref.read(apiProvider);
  TokenStore get _tokens => ref.read(tokenStoreProvider);
  String get _device => Platform.isIOS ? 'iPhone' : 'Android phone';

  Future<void> _restore() async {
    if (await _tokens.refresh() == null) {
      state = const SignedOut();
      return;
    }
    final prefs = ref.read(sharedPrefsProvider);
    try {
      final me = await _api.get<Json>('auth/me');
      await prefs.setString('user', jsonEncode(me));
      state = SignedIn(User.fromJson(me));
    } on ApiError catch (e) {
      final cached = prefs.getString('user');
      if (e.status == null && cached != null) {
        // Offline at launch (e.g. at the venue): keep working with the cached profile.
        state = SignedIn(User.fromJson(jsonDecode(cached) as Json));
      } else {
        await _tokens.clear();
        state = const SignedOut();
      }
    }
  }

  Future<void> _start(Json response) async {
    await _tokens.save(response['accessToken'] as String, response['refreshToken'] as String);
    await ref.read(sharedPrefsProvider).setString('user', jsonEncode(response['user']));
    state = SignedIn(User.fromJson(response['user'] as Json));
  }

  Future<void> login(String email, String password) async {
    final response = await _api.post<Json>('auth/login', {'email': email, 'password': password, 'client': 'mobile', 'deviceName': _device});
    if (response['twoFactorRequired'] == true) throw TwoFactorRequired(response['challenge'] as String);
    await _start(response);
  }

  Future<void> secondFactor(String challenge, String code) async =>
      _start(await _api.post<Json>('auth/login/2fa', {'challenge': challenge, 'code': code}));

  Future<void> register({required String fullName, required String email, required String password, required String role, required String locale}) async =>
      _start(await _api.post<Json>('auth/register', {
        'fullName': fullName,
        'email': email,
        'password': password,
        'role': role,
        'locale': locale,
        'client': 'mobile',
        'deviceName': _device,
      }));

  Future<void> refreshUser() async {
    if (state is SignedIn) state = SignedIn(User.fromJson(await _api.get<Json>('auth/me')));
  }

  void setUser(User user) => state = SignedIn(user);

  Future<void> logout() async {
    final refresh = await _tokens.refresh();
    try {
      if (refresh != null) await _api.post('auth/logout', {'refreshToken': refresh});
    } catch (_) {}
    await _tokens.clear();
    await ref.read(sharedPrefsProvider).remove('user');
    ref.read(selectedEventIdProvider.notifier).clear();
    state = const SignedOut();
  }

  void expire() {
    unawaited(_tokens.clear());
    state = const SignedOut();
  }
}

final currentUserProvider = Provider<User?>((ref) {
  final auth = ref.watch(authProvider);
  return auth is SignedIn ? auth.user : null;
});

// ---------------------------------------------------------------------------
// Language: the user's saved locale, else the device language.
// ---------------------------------------------------------------------------
final localeProvider = NotifierProvider<LocaleController, String>(LocaleController.new);

class LocaleController extends Notifier<String> {
  @override
  String build() {
    final user = ref.watch(currentUserProvider);
    final saved = ref.read(sharedPrefsProvider).getString('locale');
    return user?.locale ?? saved ?? (WidgetsBinding.instance.platformDispatcher.locale.languageCode == 'bn' ? 'bn' : 'en');
  }

  Future<void> set(String locale) async {
    await ref.read(sharedPrefsProvider).setString('locale', locale);
    state = locale;
    if (ref.read(currentUserProvider) != null) {
      final user = await ref.read(apiProvider).patch<Json>('auth/me', {'locale': locale});
      ref.read(authProvider.notifier).setUser(User.fromJson(user));
    }
  }
}

final stringsProvider = Provider<S>((ref) => S.of(ref.watch(localeProvider)));

// ---------------------------------------------------------------------------
// Occasion chosen on the first screen (before an account exists).
// ---------------------------------------------------------------------------
final chosenOccasionProvider = NotifierProvider<ChosenOccasion, String?>(ChosenOccasion.new);

class ChosenOccasion extends Notifier<String?> {
  @override
  String? build() => ref.read(sharedPrefsProvider).getString('occasion');
  Future<void> choose(String? type) async {
    final prefs = ref.read(sharedPrefsProvider);
    if (type == null) {
      await prefs.remove('occasion');
    } else {
      await prefs.setString('occasion', type);
    }
    state = type;
  }
}

final eventTypesProvider = FutureProvider<List<OccasionType>>((ref) async {
  final list = await ref.read(apiProvider).get<List<dynamic>>('event-types');
  return [for (final j in list) OccasionType.fromJson(j as Json)];
});

final catalogProvider = FutureProvider<FeatureCatalog>((ref) async => FeatureCatalog.fromJson(await ref.read(apiProvider).get<Json>('features')));

// ---------------------------------------------------------------------------
// Events: the list, the selected event (remembered), and its full detail.
// ---------------------------------------------------------------------------
final eventsProvider = FutureProvider<List<EventSummary>>((ref) async {
  final user = ref.watch(currentUserProvider);
  if (user == null || user.isVendor) return [];
  final list = await ref.read(apiProvider).get<List<dynamic>>('events');
  return [for (final j in list) EventSummary.fromJson(j as Json)];
});

final selectedEventIdProvider = NotifierProvider<SelectedEventId, String?>(SelectedEventId.new);

class SelectedEventId extends Notifier<String?> {
  @override
  String? build() => ref.read(sharedPrefsProvider).getString('event');
  Future<void> select(String id) async {
    await ref.read(sharedPrefsProvider).setString('event', id);
    state = id;
  }

  void clear() {
    ref.read(sharedPrefsProvider).remove('event');
    state = null;
  }
}

/// Full detail of the selected event (days, guests, tasks, budget…).
final currentEventProvider = FutureProvider<EventSummary?>((ref) async {
  final events = await ref.watch(eventsProvider.future);
  if (events.isEmpty) return null;
  final selected = ref.watch(selectedEventIdProvider);
  final id = events.any((e) => e.id == selected) ? selected! : events.first.id;
  return EventSummary.fromJson(await ref.read(apiProvider).get<Json>('events/$id'));
});

/// Reload the event after a change made on a tool screen.
void refreshEvent(WidgetRef ref) {
  ref.invalidate(eventsProvider);
  ref.invalidate(currentEventProvider);
}
