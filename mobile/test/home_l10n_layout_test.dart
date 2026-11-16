import 'dart:convert';

import 'package:ayojon/core/occasion_catalog.dart';
import 'package:ayojon/core/providers.dart';
import 'package:ayojon/core/strings.dart';
import 'package:ayojon/features/account/account_screen.dart';
import 'package:ayojon/features/auth/auth_screens.dart';
import 'package:ayojon/features/events/create_event_screen.dart';
import 'package:ayojon/features/home/dashboard_screen.dart';
import 'package:ayojon/features/home/tools_screen.dart';
import 'package:ayojon/features/onboarding/occasion_screen.dart';
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
    'features': ['checklist'],
    'days': [
      {
        'id': '1',
        'name': 'Fixture',
        'startsAt': '2099-01-02T12:00:00Z',
        'venueName': 'Fixture',
      },
    ],
    'tasks': [
      {'title': 'Fixture', 'done': true},
    ],
    'guests': [
      {'rsvpStatus': 'ACCEPTED', 'partySize': 12},
    ],
    'expenses': [
      {'amountMinor': 50000},
    ],
  });
  final types = (jsonDecode(occasionCatalogJson) as List)
      .map((x) => OccasionType.fromJson(x))
      .toList();
  final catalog = FeatureCatalog.fromJson({
    'groups': [
      {'key': 'plan', 'label': 'Planning', 'labelBn': 'পরিকল্পনা'},
    ],
    'features': [
      {
        'key': 'checklist',
        'group': 'plan',
        'label': 'Checklist',
        'labelBn': 'করণীয় তালিকা',
        'description': 'Track tasks',
        'path': '/',
      },
    ],
  });
  final user = User(
    id: '1',
    fullName: 'Fixture',
    email: 'fixture@example.com',
    role: 'HOST',
    emailVerified: true,
  );
  for (final locale in ['en', 'bn']) {
    for (final screen in <Widget>[
      const DashboardScreen(),
      const ToolsScreen(),
      const ToolSettingsScreen(),
      const CreateEventScreen(type: 'WEDDING'),
      const AccountScreen(),
      const LoginScreen(),
      const RegisterScreen(),
      const ForgotScreen(),
      const OccasionScreen(),
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
              currentUserProvider.overrideWithValue(user),
              eventsProvider.overrideWith((ref) async => [event]),
              currentEventProvider.overrideWith((ref) async => event),
              eventTypesProvider.overrideWith((ref) async => types),
              catalogProvider.overrideWith((ref) async => catalog),
              sessionsProvider.overrideWith(
                (ref) async => [
                  {
                    'id': '1',
                    'client': 'web',
                    'lastUsedAt': '2026-01-02T00:00:00Z',
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
          for (final text in tester.widgetList<Text>(find.byType(Text))) {
            final value = text.data ?? '';
            if (value.contains('Fixture') ||
                value.contains('fixture@example.com') ||
                value == 'English' ||
                value == 'বাংলা') {
              continue;
            }
            expect(
              RegExp(locale == 'bn' ? '[A-Za-z]' : r'[\u0980-\u09ff]')
                  .hasMatch(value.replaceAll('৳', '')),
              isFalse,
              reason: value,
            );
          }
        }

        check();
        final lists = find.byType(ListView);
        if (lists.evaluate().isNotEmpty) {
          await tester.drag(lists.first, const Offset(0, -500));
          await tester.pumpAndSettle();
          check();
        }
      });
    }
  }
}
