import 'package:ayojon/core/strings.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('all strings have distinct English and Bangla translations', () {
    final en = S.english;
    final bn = S.bangla;
    expect(bn.keys.toSet(), en.keys.toSet());
    const sameInBothLanguages = <String>{};
    for (final key in en.keys) {
      expect(bn[key], isNotEmpty, reason: key);
      if (!sameInBothLanguages.contains(key)) {
        expect(bn[key], isNot(en[key]), reason: key);
      }
    }
  });
}
