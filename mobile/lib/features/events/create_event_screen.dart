import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';
import '../../core/format.dart';
import '../../core/ui/spacing.dart';
import '../../core/widgets/common.dart';
import '../../models/models.dart';

/// Second step after choosing the occasion: name, city, budget, guests, date.
class CreateEventScreen extends ConsumerStatefulWidget {
  const CreateEventScreen({super.key, required this.type});
  final String type;
  @override
  ConsumerState<CreateEventScreen> createState() => _CreateEventScreenState();
}

class _CreateEventScreenState extends ConsumerState<CreateEventScreen> {
  final title = TextEditingController(), city = TextEditingController();
  TextEditingController? budget, guests;
  DateTime? date;
  bool busy = false;
  bool cityInitialized = false;

  @override
  void dispose() {
    title.dispose();
    city.dispose();
    budget?.dispose();
    guests?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    if (!cityInitialized) {
      city.text = s.t('dhaka');
      cityInitialized = true;
    }
    final types = ref.watch(eventTypesProvider).value ?? [];
    final occasion = types.where((t) => t.type == widget.type).firstOrNull;
    budget ??= occasion == null
        ? null
        : TextEditingController(
            text: numberLabelPhone(
              (occasion.budgetMinor ~/ 100).toString(),
              locale: s.locale,
            ),
          );
    guests ??= occasion == null
        ? null
        : TextEditingController(
            text: numberLabelPhone(
              occasion.guestCapacity.toString(),
              locale: s.locale,
            ),
          );
    return Scaffold(
      appBar: AppBar(
        title: Text(
          occasion == null
              ? s.t('createEvent')
              : (s.bn ? occasion.labelBn : occasion.label),
        ),
      ),
      body: occasion == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.page,
                AppSpacing.page,
                AppSpacing.page,
                AppSpacing.xl,
              ),
              children: [
                Text(s.bn ? occasion.descriptionBn : occasion.description),
                const SizedBox(height: AppSpacing.page),
                TextField(
                  controller: title,
                  textCapitalization: TextCapitalization.words,
                  decoration: InputDecoration(labelText: s.t('eventName')),
                ),
                const SizedBox(height: AppSpacing.md),
                TextField(
                  controller: city,
                  decoration: InputDecoration(labelText: s.t('city')),
                ),
                const SizedBox(height: AppSpacing.md),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: budget,
                        keyboardType: TextInputType.number,
                        decoration: InputDecoration(labelText: s.t('budget')),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: TextField(
                        controller: guests,
                        keyboardType: TextInputType.number,
                        decoration: InputDecoration(labelText: s.t('guests')),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.event_outlined),
                  title: Text(
                    date == null
                        ? s.t('eventDate')
                        : dateLabel(date!, locale: s.locale),
                  ),
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      firstDate: DateTime.now().add(const Duration(days: 1)),
                      lastDate: DateTime.now().add(const Duration(days: 1000)),
                    );
                    if (picked != null) setState(() => date = picked);
                  },
                ),
                const SizedBox(height: AppSpacing.page),
                FilledButton(
                  onPressed: busy
                      ? null
                      : () async {
                          setState(() => busy = true);
                          final ok = await attempt(context, () async {
                            final created = await ref
                                .read(apiProvider)
                                .post<Json>('events', {
                                  'title': title.text.trim(),
                                  'eventType': widget.type,
                                  'city': city.text.trim(),
                                  'budgetMinor':
                                      (int.tryParse(
                                            normalizedDigits(budget!.text),
                                          ) ??
                                          0) *
                                      100,
                                  'guestCapacity':
                                      int.tryParse(
                                        normalizedDigits(guests!.text),
                                      ) ??
                                      50,
                                  'starterPlan': true,
                                  if (date != null)
                                    'startsAt':
                                        '${date!.toIso8601String().substring(0, 10)}T18:00:00+06:00',
                                });
                            await ref
                                .read(selectedEventIdProvider.notifier)
                                .select(created['id'] as String);
                            await ref
                                .read(chosenOccasionProvider.notifier)
                                .choose(null);
                            refreshEvent(ref);
                          });
                          if (!context.mounted) return;
                          setState(() => busy = false);
                          if (ok) context.go('/home');
                        },
                  child: Text(s.t('createEvent')),
                ),
              ],
            ),
    );
  }
}
