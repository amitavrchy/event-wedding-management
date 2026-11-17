import 'package:ayojon/core/api/api_client.dart';
import 'package:ayojon/core/providers.dart';
import 'package:ayojon/core/realtime.dart';
import 'package:ayojon/core/strings.dart';
import 'package:ayojon/features/messages/messages_screens.dart';
import 'package:ayojon/features/vendor/vendor_home.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

class FakeApi implements ApiClient {
  @override
  Future<T> get<T>(String path, {Map<String, dynamic>? query}) async {
    final Object data = switch (path) {
      'vendors/v/inquiries' => {
        'items': [
          {
            'id': 'i',
            'name': 'Fixture',
            'status': 'NEW',
            'eventDate': '2026-11-16T10:00:00Z',
            'guestCount': 125,
            'budgetMinor': 500000,
            'message': 'Fixture',
            'phone': '01712345678',
          },
        ],
      },
      'vendors/v/report' => {
        'month': '2026-11',
        'inquiries': 12,
        'responseRate': 75,
        'bookings': 3,
        'bookedValueMinor': 500000,
        'averageResponseMinutes': 15,
      },
      'conversations/c/messages' => [
        {
          'id': 'm',
          'senderId': 'x',
          'body': 'Fixture',
          'createdAt': '2026-11-16T10:00:00Z',
        },
      ],
      _ => throw StateError(path),
    };
    return data as T;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  setUpAll(() async => initializeDateFormatting('bn'));
  for (final locale in ['en', 'bn']) {
    testWidgets('messages and vendor screens fit and localize in $locale', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      Future<void> show(Widget screen) async {
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              stringsProvider.overrideWithValue(S.of(locale)),
              currentUserProvider.overrideWithValue(null),
              socketProvider.overrideWithValue(null),
              apiProvider.overrideWithValue(FakeApi()),
              myBusinessesProvider.overrideWith(
                (ref) async => [
                  {'id': 'v', 'businessName': 'Fixture', 'planCode': 'FREE'},
                ],
              ),
              conversationsProvider.overrideWith(
                (ref) async => [
                  {
                    'id': 'c',
                    'vendorName': 'Fixture',
                    'lastMessage': {'body': 'Fixture'},
                  },
                ],
              ),
              notificationsProvider.overrideWith(
                (ref) async => [
                  {
                    'id': 'n',
                    'title': 'A payment milestone is coming up',
                    'body': 'Fixture: BDT 1234.00 due 2026-11-16.',
                    'read': false,
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
      }

      void check() {
        expect(tester.takeException(), isNull);
        for (final text in tester.widgetList<Text>(find.byType(Text))) {
          final value = text.data ?? '';
          if (value.contains('Fixture')) continue;
          expect(
            RegExp(locale == 'bn' ? '[A-Za-z]' : r'[\u0980-\u09ff]')
                .hasMatch(value.replaceAll('৳', '')),
            isFalse,
            reason: value,
          );
        }
      }

      await show(const ConversationsScreen());
      check();
      await show(const ChatScreen(id: 'c'));
      check();
      await show(const NotificationsScreen());
      check();
      expect(
        find.textContaining(locale == 'bn' ? '১,২৩৪' : '1,234'),
        findsOneWidget,
      );
      await show(const VendorHome());
      check();
      await tester.tap(find.text(S.of(locale).t('textBusiness')).last);
      await tester.pumpAndSettle();
      check();
      expect(find.textContaining(locale == 'bn' ? '৭৫' : '75'), findsOneWidget);
    });
  }
  test('notification templates preserve user content and localize values', () {
    final s = S.of('bn');
    final report = localizedNotification(s, {
      'title': 'Your 2026-11 report',
      'body': '12 inquiries, 3 bookings, average reply 15 min.',
    });
    expect(report.$1, contains('২০২৬'));
    expect(report.$2, contains('১২'));
    final note = localizedNotification(s, {
      'title': 'We could not confirm your payment',
      'body': 'Fixture',
    });
    expect(note.$2, 'Fixture');
    final booking = localizedNotification(s, {
      'title': 'Booking update',
      'body': 'New booking request: waiting for advance. Details: https://example.com',
    });
    expect(booking.$2, contains('অগ্রিমের অপেক্ষায়'));
    final english = localizedNotification(S.of('en'), {
      'title': 'বুকিং আপডেট',
      'body': 'Your booking: confirmed by the vendor। বিস্তারিত: https://example.com',
    });
    expect(english.$2, contains('confirmed by the vendor'));
  });
}
