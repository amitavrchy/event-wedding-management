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
  testWidgets('ordered cards, bilingual search, empty state and centered icon', (tester) async {
    tester.view.physicalSize = const Size(320, 800);
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
    final iconCenter = tester.getCenter(find.text('💍'));
    final cardCenter = tester.getCenter(find.ancestor(of: find.text('💍'), matching: find.byType(Card)).first);
    expect((iconCenter.dx - cardCenter.dx).abs(), lessThan(2));
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
