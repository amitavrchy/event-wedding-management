import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

// Match the start of a literal, including interpolated and multiline strings.
// Looking only at the start avoids treating quotes inside ${...} as its end.
final _widgetLiteral = RegExp(
  r'''(?:\bText\s*\(\s*|\b(?:hintText|labelText|helperText|tooltip|semanticsLabel)\s*:\s*|\b(?:SnackBar|AlertDialog)\s*\(\s*(?:(?:title|content)\s*:\s*)?)(?:r)?(['"])''',
  multiLine: true,
);

List<String> literalViolations(String source) {
  const allowed = {'English', 'বাংলা', '৳', '—', ''};
  final violations = <String>[];
  for (final match in _widgetLiteral.allMatches(source)) {
    final quote = match.group(1)!;
    final start = match.end;
    // Only exact, uninterpolated language names and symbols are exempt.
    final end = source.indexOf(quote, start);
    final value = end < 0
        ? source.substring(start)
        : source.substring(start, end);
    if (!allowed.contains(value)) {
      final line = '\n'.allMatches(source.substring(0, match.start)).length + 1;
      violations.add('$line: $value');
    }
  }
  return violations;
}

void main() {
  test('detects interpolated and multiline widget literals', () {
    const source = r'''
Text('$n guests');
Text(
  'Due ${date.toString()}',
);
InputDecoration(hintText: '$n guests', labelText: 'Name',
  helperText: 'Help');
IconButton(tooltip: 'Open', semanticsLabel: 'Open');
SnackBar(content: Text('Saved'));
AlertDialog(title: Text('Title'), content: Text('Content'));
''';
    expect(literalViolations(source), hasLength(10));
  });

  test('feature widget text and labels use the string catalog', () {
    final violations = <String>[];
    for (final file
        in Directory('lib/features')
            .listSync(recursive: true)
            .whereType<File>()
            .where((f) => f.path.endsWith('.dart'))) {
      violations.addAll(
        literalViolations(file.readAsStringSync())
            .map((violation) => '${file.path}:$violation'),
      );
    }
    expect(violations, isEmpty);
  });
}
