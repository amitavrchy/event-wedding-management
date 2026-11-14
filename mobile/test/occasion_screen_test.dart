import 'package:ayojon/core/providers.dart';
import 'package:ayojon/features/onboarding/occasion_screen.dart';
import 'package:ayojon/models/models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

OccasionType _type(String type, String label, String bn, List<String> features) =>
    OccasionType(type: type, label: label, labelBn: bn, description: '', budgetMinor: 100000, guestCapacity: 50, features: features);

void main() {
  testWidgets('first screen asks what you are planning and lists occasions with their tools', (tester) async {
    SharedPreferences.setMockInitialValues({'locale': 'bn'});
    final prefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(ProviderScope(
      overrides: [
        sharedPrefsProvider.overrideWithValue(prefs),
        authProvider.overrideWith(_SignedOutAuth.new),
        eventTypesProvider.overrideWith((ref) async => [
              _type('WEDDING', 'Wedding', 'বিয়ে', ['sides', 'gifts']),
              _type('BIRTHDAY', 'Birthday', 'জন্মদিন', ['gifts']),
              _type('REUNION', 'Family & friends reunion', 'পুনর্মিলনী', []),
            ]),
        catalogProvider.overrideWith((ref) async => FeatureCatalog([], [
              Feature(key: 'sides', group: 'people', label: 'Bride & groom sides', labelBn: 'বর ও কনে পক্ষ', description: '', path: '/guests'),
              Feature(key: 'gifts', group: 'plan', label: 'Gift register', labelBn: 'উপহার খাতা', description: '', path: '/gifts'),
            ])),
      ],
      child: const MaterialApp(home: OccasionScreen()),
    ));
    await tester.pumpAndSettle();
    expect(find.text('কোন অনুষ্ঠানের পরিকল্পনা করছেন?'), findsOneWidget);
    expect(find.text('বিয়ে'), findsOneWidget);
    expect(find.text('বর ও কনে পক্ষ · উপহার খাতা'), findsOneWidget);
    // Less common occasions sit behind "more occasions".
    expect(find.text('পুনর্মিলনী'), findsNothing);
    await tester.tap(find.text('আরও অনুষ্ঠান'));
    await tester.pumpAndSettle();
    expect(find.text('পুনর্মিলনী'), findsOneWidget);
  });
}

class _SignedOutAuth extends AuthController {
  @override
  AuthState build() => const SignedOut();
}
