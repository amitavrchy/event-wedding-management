/// Build-time configuration. Pass values with --dart-define, for example:
///   flutter run --dart-define=API_URL=https://api.example.com/api --dart-define=WEB_URL=https://example.com
class AppConfig {
  /// The Android emulator reaches the host machine at 10.0.2.2.
  static const _apiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:4000/api');

  /// Always ends with "/" so relative paths ("events") join correctly.
  static String get apiUrl => _apiUrl.endsWith('/') ? _apiUrl : '$_apiUrl/';
  static const webUrl = String.fromEnvironment('WEB_URL', defaultValue: 'http://10.0.2.2:3000');
  static const socketUrl = String.fromEnvironment('SOCKET_URL', defaultValue: 'http://10.0.2.2:4000');

  // Firebase (push notifications). Leave empty to run without push.
  static const firebaseApiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const firebaseAppId = String.fromEnvironment('FIREBASE_APP_ID');
  static const firebaseSenderId = String.fromEnvironment('FIREBASE_SENDER_ID');
  static const firebaseProjectId = String.fromEnvironment('FIREBASE_PROJECT_ID');
  static bool get pushConfigured => firebaseApiKey.isNotEmpty && firebaseAppId.isNotEmpty;
}
