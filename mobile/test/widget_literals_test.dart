import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('widget text and field labels do not use direct prose literals', () {
    // Language names are intentionally displayed in their own language.
    const allowed = {'English', 'বাংলা', '৳', '—'};
    final pattern = RegExp(r'''(?:\bText\s*\(\s*|\b(?:hintText|labelText|tooltip|helperText)\s*:\s*)['"]([^'"\n]*)['"]''');
    final violations = <String>[];
    for (final file in Directory('lib/features').listSync(recursive: true).whereType<File>().where((f) => f.path.endsWith('.dart'))) {
      final lines = file.readAsLinesSync();
      for (var i = 0; i < lines.length; i++) {
        for (final match in pattern.allMatches(lines[i])) {
          final value = match.group(1)!;
          // Interpolated expressions need separate review.
          if (value.contains(r'$') || allowed.contains(value) || value.trim().isEmpty) continue;
          violations.add('${file.path}:${i + 1}: $value');
        }
      }
    }
    expect(violations, isEmpty);
  });
}
