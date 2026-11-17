import 'package:ayojon/core/format.dart';
import 'package:ayojon/core/strings.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('money is shown in taka from paisa', () {
    expect(taka(150000), '৳1,500');
    expect(taka(12345), '৳123.45');
  });

  test('guest tokens are read from scanned RSVP links or raw tokens', () {
    expect(tokenFromScan('https://ayojon.example.com/rsvp/abcdef0123456789abcd'), 'abcdef0123456789abcd');
    expect(tokenFromScan('https://x.y/rsvp/family/AbCd_ef-0123456789xyz'), 'AbCd_ef-0123456789xyz');
    expect(tokenFromScan('  rawtoken1234567890  '), 'rawtoken1234567890');
  });

  test('WhatsApp numbers use the international Bangladesh format', () {
    expect(whatsappNumber('01712-345678'), '8801712345678');
    expect(whatsappNumber('+8801712345678'), '8801712345678');
    expect(whatsappNumber(''), isNull);
  });

  test('Bangla and English copy share the same keys', () {
    final en = S.of('en'), bn = S.of('bn');
    for (final key in ['whatPlanning', 'signIn', 'deleteAccount', 'syncNow']) {
      expect(en.t(key), isNot(key));
      expect(bn.t(key), isNot(en.t(key)));
    }
  });
}
