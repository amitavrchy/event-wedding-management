import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Access and refresh tokens live in the Keychain (iOS) / Keystore (Android).
class TokenStore {
  TokenStore([FlutterSecureStorage? storage]) : _storage = storage ?? const FlutterSecureStorage();
  final FlutterSecureStorage _storage;
  static const _access = 'ayojon.access';
  static const _refresh = 'ayojon.refresh';

  String? _cachedAccess;
  String? _cachedRefresh;

  Future<String?> access() async => _cachedAccess ??= await _storage.read(key: _access);
  Future<String?> refresh() async => _cachedRefresh ??= await _storage.read(key: _refresh);

  Future<void> save(String access, String refresh) async {
    _cachedAccess = access;
    _cachedRefresh = refresh;
    await _storage.write(key: _access, value: access);
    await _storage.write(key: _refresh, value: refresh);
  }

  Future<void> clear() async {
    _cachedAccess = null;
    _cachedRefresh = null;
    await _storage.delete(key: _access);
    await _storage.delete(key: _refresh);
  }
}
