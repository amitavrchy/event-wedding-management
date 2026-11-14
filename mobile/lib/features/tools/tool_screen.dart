import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../core/widgets/common.dart';
import 'day_of_tools.dart';
import 'more_tools.dart';
import 'planning_tools.dart';
import 'web_tool_screen.dart';

/// Opens a workspace tool by its feature key: a native screen where the
/// phone is the right place for it, the website otherwise.
class ToolScreen extends ConsumerWidget {
  const ToolScreen({super.key, required this.featureKey});
  final String featureKey;

  static final native = <String, Widget Function()>{
    'checklist': () => const ChecklistScreen(),
    'guests': () => const GuestsScreen(),
    'sides': () => const GuestsScreen(),
    'households': () => const GuestsScreen(),
    'budget': () => const BudgetScreen(),
    'gifts': () => const GiftsScreen(),
    'catering': () => const CateringScreen(),
    'costSplit': () => const CostSplitScreen(),
    'vendors': () => const VendorsScreen(),
    'shortlist': () => const VendorsScreen(),
    'bookings': () => const BookingsScreen(),
    'quotes': () => const QuotesScreen(),
    'invitations': () => const InvitationsScreen(),
    'checkIn': () => const CheckInScreen(),
    'photoWall': () => const PhotoWallScreen(),
    'runSheet': () => const RunSheetScreen(),
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final builder = native[featureKey];
    if (builder != null) return builder();
    final catalog = ref.watch(catalogProvider);
    return AsyncView(
      value: catalog,
      builder: (c) {
        final feature = c.features.where((f) => f.key == featureKey).firstOrNull;
        if (feature == null) return Scaffold(appBar: AppBar(), body: EmptyState(ref.read(stringsProvider).t('empty')));
        return WebToolScreen(feature: feature);
      },
    );
  }
}
