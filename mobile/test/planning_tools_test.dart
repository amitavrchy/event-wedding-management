import 'package:ayojon/core/providers.dart';
import 'package:ayojon/core/strings.dart';
import 'package:ayojon/features/tools/planning_tools.dart';
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
    'features': ['sides', 'costSplit'],
    'tasks': [
      {
        'id': '1',
        'title': 'Fixture',
        'done': false,
        'dueAt': '2026-11-16T00:00:00Z',
      },
    ],
    'guests': [
      {
        'id': '1',
        'name': 'Fixture',
        'rsvpStatus': 'ACCEPTED',
        'partySize': 2,
        'maxPartySize': 3,
        'side': 'BRIDE',
      },
    ],
  });
  final budget = {
    'plannedMinor': 100000,
    'committedMinor': 50000,
    'actualMinor': 25000,
    'alert': true,
    'expenses': [
      {
        'id': '1',
        'note': 'Fixture',
        'category': 'Venue',
        'paidBy': 'SHARED',
        'amountMinor': 25000,
      },
    ],
  };
  final gifts = {
    'summary': {'count': 2, 'cashMinor': 50000, 'thankYouPending': 1},
    'items': [
      {'id': '1', 'giverName': 'Fixture', 'kind': 'GOLD', 'amountMinor': 10000},
    ],
  };
  for (final locale in ['en', 'bn']) {
    for (final screen in [
      const ChecklistScreen(),
      const GuestsScreen(),
      const BudgetScreen(),
      const GiftsScreen(),
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
              eventResource('events/:id/budget')
                  .overrideWith((ref) async => budget),
              eventResource('events/:id/gifts')
                  .overrideWith((ref) async => gifts),
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
            final text = widget.data ?? '';
            if (text.contains('Fixture')) continue;
            expect(
              RegExp(locale == 'bn' ? '[A-Za-z]' : '[\\u0980-\\u09ff]')
                  .hasMatch(text.replaceAll('৳', '')),
              isFalse,
              reason: text,
            );
          }
        }

        check();
        if (screen is BudgetScreen || screen is GiftsScreen) {
          await tester.drag(find.byType(ListView).first, const Offset(0, -700));
          await tester.pumpAndSettle();
          check();
        }
        if (screen is ChecklistScreen) {
          await tester.tap(find.byType(FloatingActionButton));
          await tester.pumpAndSettle();
          check();
        } else {
          await tester.tap(find.byType(FloatingActionButton).last);
          await tester.pumpAndSettle();
          check();
          if (screen is GuestsScreen ||
              screen is BudgetScreen ||
              screen is GiftsScreen) {
            final field = find
                .descendant(
                  of: find.byType(BottomSheet),
                  matching: find.byType(TextField),
                )
                .first;
            tester.view.viewInsets = const FakeViewPadding(bottom: 280);
            addTearDown(tester.view.resetViewInsets);
            await tester.showKeyboard(field);
            await tester.pumpAndSettle();
            check();
          }
        }
      });
    }
  }
}
