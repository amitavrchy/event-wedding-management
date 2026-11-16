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
import 'package:ayojon/features/messages/messages_screens.dart';
import 'package:ayojon/features/vendor/vendor_home.dart';
import 'package:ayojon/features/tools/day_of_tools.dart';
import 'package:ayojon/features/tools/more_tools.dart';
import 'package:ayojon/features/tools/planning_tools.dart';
import 'package:ayojon/features/tools/tool_screen.dart';
import 'package:ayojon/features/tools/web_tool_screen.dart';
import 'package:ayojon/core/realtime.dart';

import 'messages_vendor_l10n_test.dart' show FakeApi;

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
      {
        'id': '1',
        'name': 'Fixture',
        'rsvpStatus': 'ACCEPTED',
        'partySize': 12,
        'maxPartySize': 12,
        'side': 'BRIDE',
      },
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
  testWidgets(
    'all main screens fit and localize at large text in both locales',
    (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      for (final locale in ['en', 'bn']) {
        final screens = <Widget>[
          const DashboardScreen(),
          const ToolsScreen(),
          const ToolSettingsScreen(),
          const CreateEventScreen(type: 'WEDDING'),
          const AccountScreen(),
          const LoginScreen(),
          const RegisterScreen(),
          const ForgotScreen(),
          const OccasionScreen(),
          const ChecklistScreen(),
          const GuestsScreen(),
          const BudgetScreen(),
          const GiftsScreen(),
          const CateringScreen(),
          const CostSplitScreen(),
          const VendorsScreen(),
          const BookingsScreen(),
          const QuotesScreen(),
          const InvitationsScreen(),
          const CheckInScreen(),
          const PhotoWallScreen(),
          const RunSheetScreen(),
          const ToolScreen(featureKey: 'runSheet'),
          WebToolScreen(feature: catalog.features.first),
          const ConversationsScreen(),
          const ChatScreen(id: 'c'),
          const NotificationsScreen(),
          const VendorHome(),
        ];
        for (final screen in screens) {
          await tester.pumpWidget(
            ProviderScope(
              key: UniqueKey(),
              overrides: [
                stringsProvider.overrideWithValue(S.of(locale)),
                currentUserProvider.overrideWithValue(user),
                apiProvider.overrideWithValue(FakeApi()),
                socketProvider.overrideWithValue(null),
                eventsProvider.overrideWith((ref) async => [event]),
                currentEventProvider.overrideWith((ref) async => event),
                eventTypesProvider.overrideWith((ref) async => types),
                catalogProvider.overrideWith((ref) async => catalog),
                sessionsProvider.overrideWith((ref) async => []),
                conversationsProvider.overrideWith((ref) async => []),
                notificationsProvider.overrideWith((ref) async => []),
                myBusinessesProvider.overrideWith((ref) async => []),
                bookingsProvider.overrideWith((ref) async => []),
                eventResource('events/:id/budget').overrideWith(
                  (ref) async => {
                    'plannedMinor': 0,
                    'committedMinor': 0,
                    'actualMinor': 0,
                    'expenses': [],
                  },
                ),
                eventResource('events/:id/gifts').overrideWith(
                  (ref) async => {
                    'summary': {
                      'count': 0,
                      'cashMinor': 0,
                      'thankYouPending': 0,
                    },
                    'items': [],
                  },
                ),
                eventResource('events/:id/catering?buffer=10').overrideWith(
                  (ref) async => {
                    'overall': {
                      'recommendedPlates': 0,
                      'confirmedPeople': 0,
                      'meals': {},
                    },
                    'days': [],
                  },
                ),
                eventResource('events/:id/cost-split').overrideWith(
                  (ref) async => {
                    'labels': {
                      'BRIDE': "Bride's side",
                      'GROOM': "Groom's side",
                    },
                    'settlement': null,
                    'sharePercent': {'BRIDE': 50, 'GROOM': 50},
                    'totalMinor': 0,
                    'paidMinor': {'BRIDE': 0, 'GROOM': 0},
                    'fairShareMinor': {'BRIDE': 0, 'GROOM': 0},
                  },
                ),
                eventResource('events/:id/photo-wall?status=PENDING')
                    .overrideWith((ref) async => {'token': null, 'photos': []}),
                eventResource('events/:id/run-sheet')
                    .overrideWith((ref) async => []),
                eventResource('quotes/event/:id')
                    .overrideWith((ref) async => []),
                eventResource('events/:id/invitations/share?language=$locale')
                    .overrideWith((ref) async => []),
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
          expect(
            tester.takeException(),
            isNull,
            reason: '${screen.runtimeType} $locale',
          );
          for (final widget in tester.widgetList<Text>(find.byType(Text))) {
            final value = widget.data ?? '';
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
              reason: '${screen.runtimeType} $locale: $value',
            );
          }
        }
      }
    },
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
