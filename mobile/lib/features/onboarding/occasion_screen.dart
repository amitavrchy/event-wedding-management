import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';
import '../../core/widgets/common.dart';
import '../../models/models.dart';

const _featured = ['WEDDING', 'HOLUD', 'RECEPTION', 'ENGAGEMENT', 'BIRTHDAY', 'ANNIVERSARY', 'CORPORATE', 'CONFERENCE'];
const _icons = {
  'WEDDING': Icons.favorite_outline,
  'HOLUD': Icons.local_florist_outlined,
  'RECEPTION': Icons.restaurant_outlined,
  'ENGAGEMENT': Icons.diamond_outlined,
  'BIRTHDAY': Icons.cake_outlined,
  'ANNIVERSARY': Icons.celebration_outlined,
  'CORPORATE': Icons.business_center_outlined,
  'CONFERENCE': Icons.mic_none_outlined,
  'BABY_SHOWER': Icons.child_friendly_outlined,
  'GRADUATION': Icons.school_outlined,
  'REUNION': Icons.groups_outlined,
  'COMMUNITY': Icons.diversity_3_outlined,
  'GENERAL': Icons.auto_awesome_outlined,
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
  bool all = false;

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final types = ref.watch(eventTypesProvider);
    final catalog = ref.watch(catalogProvider).value;
    String toolNames(OccasionType t) => t.features
        .map((k) => catalog?.features.where((f) => f.key == k).firstOrNull)
        .whereType<Feature>()
        .take(3)
        .map((f) => s.bn ? f.labelBn : f.label)
        .join(' · ');

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
          int rank(OccasionType t) => _featured.contains(t.type) ? _featured.indexOf(t.type) : 100;
          final visible = (all ? [...list] : list.where((t) => _featured.contains(t.type)).toList())..sort((a, b) => rank(a).compareTo(rank(b)));
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(s.t('whatPlanning'), style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 6),
              Text(s.t('whatPlanningSub')),
              const SizedBox(height: 16),
              GridView.count(
                crossAxisCount: MediaQuery.sizeOf(context).width > 600 ? 3 : 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 0.95,
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
                            padding: const EdgeInsets.all(14),
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Icon(_icons[t.type] ?? Icons.auto_awesome_outlined, size: 30, color: Theme.of(context).colorScheme.primary),
                              const Spacer(),
                              Text(s.bn ? t.labelBn : t.label, style: Theme.of(context).textTheme.titleMedium),
                              Text(s.bn ? t.label : t.labelBn, style: Theme.of(context).textTheme.bodySmall),
                              const SizedBox(height: 6),
                              Text(toolNames(t), maxLines: 2, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.labelSmall),
                            ]),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              if (!all) TextButton(onPressed: () => setState(() => all = true), child: Text(s.t('moreOccasions'))),
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
