import 'dart:io' show Platform;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'config.dart';
import 'providers.dart';

/// Push notifications through Firebase Cloud Messaging (Android and iOS).
/// Runs only when Firebase values are supplied with --dart-define.
class PushService {
  PushService(this.ref);
  final Ref ref;
  bool _ready = false;
  void Function(String link)? onOpen;

  Future<void> start() async {
    if (!AppConfig.pushConfigured || _ready) return;
    try {
      await Firebase.initializeApp(
        options: FirebaseOptions(
          apiKey: AppConfig.firebaseApiKey,
          appId: AppConfig.firebaseAppId,
          messagingSenderId: AppConfig.firebaseSenderId,
          projectId: AppConfig.firebaseProjectId,
        ),
      );
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission();
      // The backend sends with the FCM HTTP v1 `message.token` field, which
      // takes registration tokens. firebase_messaging 17 deprecates getToken in
      // favour of installation IDs for "direct send"; migrate both sides together.
      // ignore: deprecated_member_use
      final token = await messaging.getToken();
      if (token != null) await _register(token);
      // ignore: deprecated_member_use
      messaging.onTokenRefresh.listen(_register);
      FirebaseMessaging.onMessageOpenedApp.listen((m) => _open(m.data));
      final initial = await messaging.getInitialMessage();
      if (initial != null) _open(initial.data);
      _ready = true;
    } catch (e) {
      debugPrint('Push unavailable: $e');
    }
  }

  void _open(Map<String, dynamic> data) {
    final link = data['link'];
    if (link is String && link.isNotEmpty) onOpen?.call(link);
  }

  Future<void> _register(String token) => ref.read(apiProvider).post('auth/devices', {'platform': Platform.isIOS ? 'ios' : 'android', 'token': token});
}

final pushProvider = Provider<PushService>((ref) => PushService(ref));
