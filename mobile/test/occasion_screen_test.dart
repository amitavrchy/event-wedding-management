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
      {
        'type': 'BIRTHDAY',
        'label': 'Old birthday',
        'features': ['gifts'],
        'budgetMinor': 123,
        'guestCapacity': 42,
      },
      {
        'type': 'WEDDING',
        'label': 'Old wedding',
        'features': ['guests'],
      },
    ]);
    final catalogue = (jsonDecode(occasionCatalogJson) as List)
        .cast<Map<String, dynamic>>();
    expect(merged.length, 46);
    final firstIcons = merged
        .take(12)
        .map((t) => occasionIcons[t.iconKey])
        .toList();
    expect(firstIcons, isNot(contains(null)));
    expect(firstIcons.toSet().length, 12);
    expect(
      occasionIcons[merged.firstWhere((t) => t.type == 'CHARITY').iconKey],
      Icons.volunteer_activism_outlined,
    );
    expect(merged.map((t) => t.type), catalogue.map((j) => j['type']));
    expect(merged[0].label, 'Wedding');
    expect(merged[0].features, ['guests']);
    expect(merged[1].label, 'Birthday');
    expect(merged[1].features, ['gifts']);
    expect(merged[1].budgetMinor, 123);
    expect(merged[1].guestCapacity, 42);
    final extra = mergeOccasionTypes([
      {'type': 'NEW', 'label': 'New occasion'},
    ]);
    expect(extra.last.type, 'NEW');
  });
  testWidgets(
    'ordered cards, bilingual search, empty state and centered icon',
    (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      SharedPreferences.setMockInitialValues({'locale': 'en'});
      final prefs = await SharedPreferences.getInstance();
      final list = (jsonDecode(occasionCatalogJson) as List)
          .map((j) => OccasionType.fromJson(j as Map<String, dynamic>))
          .toList();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            sharedPrefsProvider.overrideWithValue(prefs),
            authProvider.overrideWith(_SignedOutAuth.new),
            eventTypesProvider.overrideWith((ref) async => list),
          ],
          child: MaterialApp(
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(context)
                  .copyWith(textScaler: const TextScaler.linear(1.4)),
              child: child!,
            ),
            home: const OccasionScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        tester
            .state<ScrollableState>(find.byType(Scrollable).first)
            .position
            .pixels,
        0,
      );
      expect(find.text('Wedding').hitTestable(), findsOneWidget);
      expect(
        tester.getTopLeft(find.text('Wedding')).dx,
        lessThan(tester.getTopLeft(find.text('Birthday')).dx),
      );
      expect(
        tester.getTopLeft(find.text('Anniversary')).dy,
        greaterThan(tester.getTopLeft(find.text('Wedding')).dy),
      );
      expect(find.text('Office Program'), findsOneWidget);
      final iconCenter = tester.getCenter(
        find.byIcon(Icons.favorite_outline).first,
      );
      final cardCenter = tester.getCenter(
        find
            .ancestor(
              of: find.byIcon(Icons.favorite_outline).first,
              matching: find.byType(Card),
            )
            .first,
      );
      expect((iconCenter.dx - cardCenter.dx).abs(), lessThan(2));
      expect(
        tester.getSize(find.byType(Card).first).height,
        lessThanOrEqualTo(256),
      );
      expect(tester.takeException(), isNull);
      expect(find.text('বিয়ে'), findsNothing);
      expect(
        tester.getBottomLeft(find.text('Wedding')).dy,
        lessThanOrEqualTo(
          tester.getTopLeft(find.text('Celebrate your wedding together')).dy,
        ),
      );
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
      await tester.tap(find.byTooltip('Search occasions'));
      await tester.pumpAndSettle();
      final scrollable = tester.state<ScrollableState>(
        find.byType(Scrollable).first,
      );
      expect(scrollable.position.pixels, 0);
      await tester.drag(find.byType(ListView).first, const Offset(0, -1200));
      await tester.pumpAndSettle();
      expect(scrollable.position.pixels, greaterThan(0));
      await tester.tap(find.byTooltip('Search occasions'));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Search occasions'));
      await tester.pumpAndSettle();
      expect(scrollable.position.pixels, 0);
      expect(find.text('Wedding').hitTestable(), findsOneWidget);
    },
  );
  testWidgets('Bangla cards fit at 1.4 text scale', (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    SharedPreferences.setMockInitialValues({'locale': 'bn'});
    final prefs = await SharedPreferences.getInstance();
    final list = (jsonDecode(occasionCatalogJson) as List)
        .map((j) => OccasionType.fromJson(j as Map<String, dynamic>))
        .toList();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sharedPrefsProvider.overrideWithValue(prefs),
          authProvider.overrideWith(_SignedOutAuth.new),
          eventTypesProvider.overrideWith((ref) async => list),
        ],
        child: MaterialApp(
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context)
                .copyWith(textScaler: const TextScaler.linear(1.4)),
            child: child!,
          ),
          home: const OccasionScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(
      tester.getSize(find.byType(Card).first).height,
      lessThanOrEqualTo(256),
    );
    expect(find.text('বিয়ে').hitTestable(), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  for (final locale in ['en', 'bn']) {
    testWidgets('search layout fits at 1.4 text scale in $locale', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      SharedPreferences.setMockInitialValues({'locale': locale});
      final prefs = await SharedPreferences.getInstance();
      final list = (jsonDecode(occasionCatalogJson) as List)
          .map((j) => OccasionType.fromJson(j as Map<String, dynamic>))
          .toList();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            sharedPrefsProvider.overrideWithValue(prefs),
            authProvider.overrideWith(_SignedOutAuth.new),
            eventTypesProvider.overrideWith((ref) async => list),
          ],
          child: MaterialApp(
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(context)
                  .copyWith(textScaler: const TextScaler.linear(1.4)),
              child: child!,
            ),
            home: const OccasionScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      final searchLabel = locale == 'en'
          ? 'Search occasions'
          : 'অনুষ্ঠান খুঁজুন';
      await tester.tap(find.byTooltip(searchLabel));
      await tester.pumpAndSettle();
      final field = find.byType(TextField);
      final subtitle = find.text(
        locale == 'en'
            ? 'Choose your occasion. We will show only the tools it needs.'
            : 'অনুষ্ঠান বেছে নিন। শুধু দরকারি টুলগুলোই দেখাব।',
      );
      expect(tester.getSize(field).height, greaterThanOrEqualTo(48));
      expect(
        find.descendant(of: field, matching: find.byIcon(Icons.search)),
        findsOneWidget,
      );
      expect(
        tester.getTopLeft(field).dy - tester.getBottomLeft(subtitle).dy,
        greaterThanOrEqualTo(12),
      );
      expect(
        tester.getTopLeft(find.byType(GridView)).dy -
            tester.getBottomLeft(field).dy,
        greaterThanOrEqualTo(12),
      );
      expect(tester.widget<TextField>(field).focusNode!.hasFocus, isTrue);
      expect(tester.takeException(), isNull);
      await tester.enterText(field, 'xyz');
      await tester.pumpAndSettle();
      expect(find.byIcon(Icons.clear), findsOneWidget);
      final empty = find.text(
        locale == 'en' ? 'No occasions found.' : 'কোনো অনুষ্ঠান পাওয়া যায়নি।',
      );
      expect(
        tester.getTopLeft(empty).dy - tester.getBottomLeft(field).dy,
        greaterThanOrEqualTo(12),
      );
      expect(tester.takeException(), isNull);
      await tester.tap(find.byIcon(Icons.clear));
      await tester.pumpAndSettle();
      expect(tester.widget<TextField>(field).controller!.text, isEmpty);
      expect(find.byType(GridView), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}

class _SignedOutAuth extends AuthController {
  @override
  AuthState build() => const SignedOut();
}
