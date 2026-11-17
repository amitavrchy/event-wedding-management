import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config.dart';
import '../../core/providers.dart';
import '../../models/models.dart';
import '../home/tools_screen.dart';

/// Tools that need a large screen (seating plan, website editor, contracts…)
/// open on the website.
class WebToolScreen extends ConsumerWidget {
  const WebToolScreen({super.key, required this.feature});
  final Feature feature;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(s.bn ? feature.labelBn : feature.label)),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(toolIcons[feature.key] ?? Icons.open_in_browser, size: 48, color: Theme.of(context).colorScheme.primary),
          const SizedBox(height: 12),
          Text(feature.description, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Text(s.t('webOnly'), textAlign: TextAlign.center),
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: () => launchUrl(Uri.parse('${AppConfig.webUrl}${feature.path}'), mode: LaunchMode.externalApplication),
            icon: const Icon(Icons.open_in_new),
            label: Text(s.t('openOnWeb')),
          ),
        ]),
      ),
    );
  }
}
