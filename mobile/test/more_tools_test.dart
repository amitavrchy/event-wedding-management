import 'dart:convert';
import 'dart:typed_data';

import 'package:ayojon/core/api/api_client.dart';
import 'package:ayojon/core/auth/token_store.dart';
import 'package:ayojon/core/providers.dart';
import 'package:ayojon/core/strings.dart';
import 'package:ayojon/features/tools/more_tools.dart';
import 'package:ayojon/features/tools/planning_tools.dart';
import 'package:ayojon/models/models.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

class _Tokens extends TokenStore {
  @override
  Future<String?> access() async => 'token';
}

class _Adapter implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? stream,
    Future<void>? cancelFuture,
  ) async => ResponseBody.fromString(
    jsonEncode({
      'items': [
        {
          'id': '1',
          'slug': 'fixture',
          'businessName': 'Fixture',
          'category': 'CATERING',
          'city': 'Fixture',
          'description': 'Fixture',
          'responseMinutes': 15,
          'ratingAvg': 4.5,
          'ratingCount': 2,
          'priceFromMinor': 10000,
          'services': [
            {'title': 'Fixture', 'basePriceMinor': 10000},
          ],
        },
      ],
      'total': 1,
    }),
    200,
    headers: {
      Headers.contentTypeHeader: ['application/json'],
    },
  );
  @override
  void close({bool force = false}) {}
}

void main() {
  setUpAll(() async => initializeDateFormatting('bn'));
  final event = EventSummary.fromJson({
    'id': '1',
    'title': 'Fixture',
    'features': [],
    'days': [],
  });
  final plan = {
    'recommendedPlates': 12,
    'confirmedPeople': 10,
    'meals': {'Regular': 8, 'Vegetarian': 1, 'No beef': 1},
  };
  final cost = {
    'labels': {'BRIDE': "Bride's side", 'GROOM': "Groom's side"},
    'settlement': {'from': 'BRIDE', 'to': 'GROOM', 'amountMinor': 50000},
    'sharePercent': {'BRIDE': 50, 'GROOM': 50},
    'totalMinor': 100000,
    'paidMinor': {'BRIDE': 0, 'GROOM': 100000},
    'fairShareMinor': {'BRIDE': 50000, 'GROOM': 50000},
  };
  for (final locale in ['en', 'bn']) {
    for (final screen in [
      const CateringScreen(),
      const CostSplitScreen(),
      const VendorsScreen(),
      const BookingsScreen(),
      const QuotesScreen(),
      const InvitationsScreen(),
    ]) {
      testWidgets('${screen.runtimeType} $locale fits and localizes', (
        tester,
      ) async {
        tester.view.physicalSize = const Size(320, 640);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final dio = Dio(BaseOptions(baseUrl: 'https://example.test/'))
          ..httpClientAdapter = _Adapter();
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              apiProvider.overrideWithValue(ApiClient(_Tokens(), dio: dio)),
              stringsProvider.overrideWithValue(S.of(locale)),
              currentEventProvider.overrideWith((ref) async => event),
              eventResource('events/:id/catering?buffer=10').overrideWith(
                (ref) async => {
                  'overall': plan,
                  'days': [
                    {'name': 'Fixture', ...plan},
                  ],
                },
              ),
              eventResource('events/:id/cost-split')
                  .overrideWith((ref) async => cost),
              bookingsProvider.overrideWith(
                (ref) async => [
                  {
                    'id': '1',
                    'service': {
                      'title': 'Fixture',
                      'vendor': {'businessName': 'Fixture'},
                    },
                    'startAt': '2026-11-16T10:00:00Z',
                    'priceMinor': 10000,
                    'status': 'CONFIRMED',
                  },
                ],
              ),
              eventResource('quotes/event/:id').overrideWith(
                (ref) async => [
                  {
                    'id': '1',
                    'status': 'SENT',
                    'amountMinor': 10000,
                    'expiresAt': '2026-11-16T10:00:00Z',
                  },
                ],
              ),
              eventResource('events/:id/invitations/share?language=$locale')
                  .overrideWith(
                    (ref) async => [
                      {'id': '1', 'name': 'Fixture', 'type': 'guest'},
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
        if (screen is VendorsScreen) {
          await tester.tap(find.text('Fixture').first);
          await tester.pumpAndSettle();
          check();
          tester.view.viewInsets = const FakeViewPadding(bottom: 250);
          addTearDown(tester.view.resetViewInsets);
          await tester.showKeyboard(find.byType(TextField).last);
          await tester.pumpAndSettle();
          check();
        } else if (find.byType(ListView).evaluate().isNotEmpty) {
          await tester.drag(find.byType(ListView).first, const Offset(0, -400));
          await tester.pumpAndSettle();
          check();
        }
      });
    }
  }
}
