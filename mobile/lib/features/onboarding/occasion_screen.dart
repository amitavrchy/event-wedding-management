import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';
import '../../core/widgets/common.dart';
import '../../models/models.dart';

const occasionIcons = <String, IconData>{
  'favorite': Icons.favorite_outline, 'cake': Icons.cake_outlined,
  'work': Icons.work_outline, 'flower': Icons.local_florist_outlined,
  'diamond': Icons.diamond_outlined, 'celebration': Icons.celebration_outlined,
  'restaurant': Icons.restaurant_outlined, 'child': Icons.child_care_outlined,
  'moon': Icons.nightlight_outlined, 'flame': Icons.local_fire_department_outlined,
  'music': Icons.music_note_outlined, 'school': Icons.school_outlined,
  'groups': Icons.groups_outlined, 'mic': Icons.mic_none_outlined,
  'build': Icons.build_outlined, 'rocket': Icons.rocket_launch_outlined,
  'park': Icons.park_outlined, 'trophy': Icons.emoji_events_outlined,
  'home': Icons.home_outlined, 'book': Icons.menu_book_outlined,
  'palette': Icons.palette_outlined, 'bouquet': Icons.card_giftcard_outlined,
  'leaf': Icons.spa_outlined, 'bowl': Icons.ramen_dining_outlined,
  'charity': Icons.volunteer_activism_outlined,
};

/// The first screen of the app: "What are you planning?". The choice decides
/// which tools the workspace shows. Signed-in hosts reach it to add an event.
class OccasionScreen extends ConsumerStatefulWidget {
  const OccasionScreen({super.key, this.forNewEvent = false});
  final bool forNewEvent;
  @override
  ConsumerState<OccasionScreen> createState() => _OccasionScreenState();
}

class _OccasionScreenState extends ConsumerState<OccasionScreen> {
  final scrollController = ScrollController(keepScrollOffset: false);
  bool searching = false;
  String query = '';

  @override
  void dispose() {
    scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final types = ref.watch(eventTypesProvider);
    Future<void> choose(OccasionType t) async {
      await ref.read(chosenOccasionProvider.notifier).choose(t.type);
      if (!context.mounted) return;
      if (widget.forNewEvent || ref.read(currentUserProvider) != null) {
        context.push('/create-event?type=${t.type}');
      } else {
        context.push('/register?type=${t.type}');
      }
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(s.t('appName')),
        actions: [
          IconButton(tooltip: s.t('searchOccasions'), icon: const Icon(Icons.search), onPressed: () {
            if (scrollController.hasClients) scrollController.jumpTo(0);
            if (searching) {
              query = '';
              FocusScope.of(context).unfocus();
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted && scrollController.hasClients) scrollController.jumpTo(0);
              });
            }
            setState(() => searching = !searching);
          }),
          TextButton(
            onPressed: () => ref.read(localeProvider.notifier).set(s.bn ? 'en' : 'bn'),
            child: Text(s.bn ? 'English' : 'বাংলা'),
          ),
        ],
      ),
      body: AsyncView(
        value: types,
        onRetry: () => ref.invalidate(eventTypesProvider),
        builder: (list) {
          final term = query.trim().toLowerCase();
          final visible = list.where((t) => [t.label, t.labelBn, t.description, t.descriptionBn].any((v) => v.toLowerCase().contains(term))).toList();
          return ListView(
            controller: scrollController,
            padding: const EdgeInsets.all(16),
            children: [
              Text(s.t('whatPlanning'), style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 6),
              Text(s.t('whatPlanningSub')),
              if (searching) TextField(decoration: InputDecoration(labelText: s.t('searchOccasions')), onChanged: (value) => setState(() => query = value)),
              const SizedBox(height: 16),
              if (visible.isEmpty) Text(s.t('noOccasions')) else GridView.count(
                crossAxisCount: MediaQuery.sizeOf(context).width > 600 ? 3 : 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                mainAxisExtent: 200 + (MediaQuery.textScalerOf(context).scale(1) - 1).clamp(0, double.infinity) * 140,
                children: [
                  for (final t in visible)
                    Semantics(
                      button: true,
                      label: t.label,
                      child: Card(
                        clipBehavior: Clip.antiAlias,
                        child: InkWell(
                          onTap: () => choose(t),
                          child: Padding(
                            padding: const EdgeInsets.all(8),
                            child: Column(mainAxisAlignment: MainAxisAlignment.start, crossAxisAlignment: CrossAxisAlignment.center, children: [
                              Icon(occasionIcons[t.iconKey] ?? Icons.celebration_outlined, size: 44, color: Theme.of(context).colorScheme.primary),
                              const SizedBox(height: 6),
                              Text(s.bn ? t.labelBn : t.label, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.titleMedium),
                              Text(s.bn ? t.label : t.labelBn, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.bodySmall),
                              const SizedBox(height: 6),
                              Text(s.bn ? t.descriptionBn : t.description, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.labelSmall),
                            ]),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              if (!widget.forNewEvent && ref.watch(currentUserProvider) == null) ...[
                const Divider(height: 32),
                OutlinedButton(onPressed: () => context.push('/register?role=VENDOR'), child: Text(s.t('imVendor'))),
                TextButton(onPressed: () => context.push('/login'), child: Text(s.t('haveAccount'))),
              ],
            ],
          );
        },
      ),
    );
  }
}
