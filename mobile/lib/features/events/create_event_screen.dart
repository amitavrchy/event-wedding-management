import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';
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
  final title = TextEditingController(), city = TextEditingController(text: 'Dhaka');
  TextEditingController? budget, guests;
  DateTime? date;
  bool busy = false;

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final types = ref.watch(eventTypesProvider).value ?? [];
    final occasion = types.where((t) => t.type == widget.type).firstOrNull;
    budget ??= occasion == null ? null : TextEditingController(text: (occasion.budgetMinor ~/ 100).toString());
    guests ??= occasion == null ? null : TextEditingController(text: occasion.guestCapacity.toString());
    return Scaffold(
      appBar: AppBar(title: Text(occasion == null ? s.t('createEvent') : (s.bn ? occasion.labelBn : occasion.label))),
      body: occasion == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(padding: const EdgeInsets.all(16), children: [
              Text(occasion.description),
              const SizedBox(height: 16),
              TextField(controller: title, textCapitalization: TextCapitalization.words, decoration: InputDecoration(labelText: s.t('eventName'))),
              const SizedBox(height: 12),
              TextField(controller: city, decoration: InputDecoration(labelText: s.t('city'))),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(child: TextField(controller: budget, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: s.t('budget')))),
                const SizedBox(width: 12),
                Expanded(child: TextField(controller: guests, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: s.t('guests')))),
              ]),
              const SizedBox(height: 12),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.event_outlined),
                title: Text(date == null ? s.t('eventDate') : MaterialLocalizations.of(context).formatFullDate(date!)),
                onTap: () async {
                  final picked = await showDatePicker(context: context, firstDate: DateTime.now().add(const Duration(days: 1)), lastDate: DateTime.now().add(const Duration(days: 1000)));
                  if (picked != null) setState(() => date = picked);
                },
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: busy
                    ? null
                    : () async {
                        setState(() => busy = true);
                        final ok = await attempt(context, () async {
                          final created = await ref.read(apiProvider).post<Json>('events', {
                            'title': title.text.trim(),
                            'eventType': widget.type,
                            'city': city.text.trim(),
                            'budgetMinor': (int.tryParse(budget!.text) ?? 0) * 100,
                            'guestCapacity': int.tryParse(guests!.text) ?? 50,
                            'starterPlan': true,
                            if (date != null) 'startsAt': '${date!.toIso8601String().substring(0, 10)}T18:00:00+06:00',
                          });
                          await ref.read(selectedEventIdProvider.notifier).select(created['id'] as String);
                          await ref.read(chosenOccasionProvider.notifier).choose(null);
                          refreshEvent(ref);
                        });
                        if (!context.mounted) return;
                        setState(() => busy = false);
                        if (ok) context.go('/home');
                      },
                child: Text(s.t('createEvent')),
              ),
            ]),
    );
  }
}
