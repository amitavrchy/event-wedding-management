import 'dart:convert';
import 'package:ayojon/core/occasion_catalog.dart';
import 'package:ayojon/core/providers.dart';
import 'package:ayojon/features/onboarding/occasion_screen.dart';
import 'package:ayojon/models/models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('old server list augments the complete ordered bundled catalogue', () {
    final merged = mergeOccasionTypes([
      {'type': 'BIRTHDAY', 'label': 'Old birthday', 'features': ['gifts'], 'budgetMinor': 123, 'guestCapacity': 42},
      {'type': 'WEDDING', 'label': 'Old wedding', 'features': ['guests']},
    ]);
    final catalogue = (jsonDecode(occasionCatalogJson) as List).cast<Map<String, dynamic>>();
    expect(merged.length, 46);
    expect(merged.map((t) => t.type), catalogue.map((j) => j['type']));
    expect(merged[0].label, 'Wedding');
    expect(merged[0].features, ['guests']);
    expect(merged[1].label, 'Birthday');
    expect(merged[1].features, ['gifts']);
    expect(merged[1].budgetMinor, 123);
    expect(merged[1].guestCapacity, 42);
    final extra = mergeOccasionTypes([{'type': 'NEW', 'label': 'New occasion'}]);
    expect(extra.last.type, 'NEW');
  });
  testWidgets('ordered cards, bilingual search, empty state and centered icon', (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    SharedPreferences.setMockInitialValues({'locale': 'en'});
    final prefs = await SharedPreferences.getInstance();
    final list = (jsonDecode(occasionCatalogJson) as List).map((j) => OccasionType.fromJson(j as Map<String, dynamic>)).toList();
    await tester.pumpWidget(ProviderScope(overrides: [sharedPrefsProvider.overrideWithValue(prefs), authProvider.overrideWith(_SignedOutAuth.new), eventTypesProvider.overrideWith((ref) async => list)], child: const MaterialApp(home: OccasionScreen())));
    await tester.pumpAndSettle();
    expect(tester.getTopLeft(find.text('Wedding')).dx, lessThan(tester.getTopLeft(find.text('Birthday')).dx));
    expect(tester.getTopLeft(find.text('Anniversary')).dy, greaterThan(tester.getTopLeft(find.text('Wedding')).dy));
    expect(find.text('Office Program'), findsOneWidget);
    final iconCenter = tester.getCenter(find.byIcon(Icons.favorite_outline).first);
    final cardCenter = tester.getCenter(find.ancestor(of: find.byIcon(Icons.favorite_outline).first, matching: find.byType(Card)).first);
    expect((iconCenter.dx - cardCenter.dx).abs(), lessThan(2));
    expect(tester.takeException(), isNull);
    expect(tester.getBottomLeft(find.text('Wedding')).dy, lessThanOrEqualTo(tester.getTopLeft(find.text('বিয়ে')).dy));
    expect(tester.getBottomLeft(find.text('বিয়ে')).dy, lessThanOrEqualTo(tester.getTopLeft(find.text('Celebrate your wedding together')).dy));
    await tester.tap(find.byTooltip('Search occasions'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'birthday');
    await tester.pumpAndSettle();
    expect(find.text('Birthday'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'গায়ে হলুদ');
    await tester.pumpAndSettle();
    expect(find.text('Gaye Holud'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'zzzzzz');
    await tester.pumpAndSettle();
    expect(find.text('No occasions found.'), findsOneWidget);
  });
}
class _SignedOutAuth extends AuthController {
  @override
  AuthState build() => const SignedOut();
}
