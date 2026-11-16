import 'package:ayojon/core/providers.dart';
import 'package:ayojon/core/strings.dart';
import 'package:ayojon/features/tools/day_of_tools.dart';
import 'package:ayojon/features/tools/planning_tools.dart';
import 'package:ayojon/features/tools/tool_screen.dart';
import 'package:ayojon/features/tools/web_tool_screen.dart';
import 'package:ayojon/models/models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

void main() {
  setUpAll(() async => initializeDateFormatting('bn'));
  final event = EventSummary.fromJson({
    'id': '1',
    'title': 'Fixture',
    'features': [],
    'days': [
      {'id': '1', 'name': 'Fixture', 'startsAt': '2026-11-16T10:00:00Z'},
    ],
  });
  final feature = Feature(
    key: 'seating',
    group: 'plan',
    label: 'Seating',
    labelBn: 'বসার ব্যবস্থা',
    description: 'Plan seating',
    path: '/seating',
  );
  for (final locale in ['en', 'bn']) {
    for (final screen in <Widget>[
      const CheckInScreen(),
      const PhotoWallScreen(),
      const RunSheetScreen(),
      WebToolScreen(feature: feature),
      const ToolScreen(featureKey: 'runSheet'),
    ]) {
      testWidgets('${screen.runtimeType} $locale fits and localizes', (
        tester,
      ) async {
        tester.view.physicalSize = const Size(320, 640);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              stringsProvider.overrideWithValue(S.of(locale)),
              currentEventProvider.overrideWith((ref) async => event),
              eventResource('events/:id/photo-wall?status=PENDING')
                  .overrideWith((ref) async => {'token': null, 'photos': []}),
              eventResource('events/:id/run-sheet').overrideWith(
                (ref) async => [
                  {
                    'id': '1',
                    'startsAt': '2026-11-16T10:00:00Z',
                    'title': 'Fixture',
                    'owner': 'Fixture',
                    'durationMinutes': 15,
                    'status': 'READY',
                    'version': 1,
                  },
                ],
              ),
            ],
            child: MaterialApp(
              locale: Locale(locale),
              supportedLocales: const [Locale('en'), Locale('bn')],
              localizationsDelegates: GlobalMaterialLocalizations.delegates,
              builder: (context, child) => MediaQuery(
                data: MediaQuery.of(context)
                    .copyWith(textScaler: const TextScaler.linear(1.4)),
                child: child!,
              ),
              home: screen,
            ),
          ),
        );
        await tester.pumpAndSettle();
        void check() {
          expect(tester.takeException(), isNull);
          for (final widget in tester.widgetList<Text>(find.byType(Text))) {
            final value = widget.data ?? '';
            if (value.contains('Fixture')) continue;
            expect(
              RegExp(locale == 'bn' ? '[A-Za-z]' : '[\\u0980-\\u09ff]')
                  .hasMatch(value),
              isFalse,
              reason: value,
            );
          }
        }

        check();
        if (screen is RunSheetScreen || screen is ToolScreen) {
          await tester.tap(find.byType(PopupMenuButton<String>));
          await tester.pumpAndSettle();
          check();
          expect(find.text(S.of(locale).codeLabel('LIVE')), findsOneWidget);
        }
      });
    }
  }
}
