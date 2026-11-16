# Ayojon

Ayojon is the Flutter companion app for Utsab. Flutter 3.47.8 and Java 17 are used in CI.

Run `flutter pub get`, then `flutter run`. The default debug endpoints use Android emulator address `10.0.2.2`; pass `--dart-define=API_URL=...`, `--dart-define=WEB_URL=...` and `--dart-define=SOCKET_URL=...` for other devices. Run `flutter analyze`, `flutter test`, and `flutter build apk --debug` to verify local changes.

For production Android builds, configure `android/key.properties` with `storeFile` (absolute path to a keystore outside the repository), `storePassword`, `keyAlias` and `keyPassword`. These values and keystores must stay private. Without the properties file, release builds use the debug key for local testing and must not be published. Run `scripts/build-release.sh` to build the APK and app bundle with `config/production.json` and the production App Links host. Set `ANDROID_CERT_SHA256` on the web server to the colon-separated SHA-256 fingerprint of the actual release signing certificate (or Play App Signing certificate); multiple fingerprints can be comma-separated.

For iOS, run `flutter pub get`, `cd ios && pod install`, then `flutter build ios --release --no-codesign --dart-define-from-file=config/production.json` from this directory. Apple distribution requires an authorized signing team and App Store configuration. Review the privacy manifest and App Store privacy answers against deployed services and actual data practices before submission.

Firebase is optional: leave the Firebase values in the configuration empty to disable push. Configure the platform Firebase files and corresponding dart defines only when a project is available. The camera is used for QR scanning and optional photos; notifications are requested for optional push, and contacts access is used when adding guests. Version and build number come from `pubspec.yaml` and can be overridden with Flutter build flags.
