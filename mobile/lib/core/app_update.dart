import 'dart:io' show Platform;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

import 'providers.dart';

/// Asks the API whether this app version is still supported.
final appUpdateProvider = FutureProvider<Map<String, dynamic>?>((ref) async {
  try {
    final info = await PackageInfo.fromPlatform();
    return await ref.read(apiProvider).get<Map<String, dynamic>>('app/config', query: {'version': info.version, 'platform': Platform.isIOS ? 'ios' : 'android'});
  } catch (_) {
    return null; // Offline: never block the app.
  }
});
