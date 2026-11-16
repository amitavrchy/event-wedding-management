import 'package:intl/intl.dart';

/// Money is integer paisa everywhere in the API.
String taka(num minor, {bool compact = false, String locale = 'en'}) {
  final value = minor / 100;
  final format = compact
      ? NumberFormat.compact(locale: locale == 'bn' ? 'bn' : 'en_IN')
      : NumberFormat.decimalPatternDigits(
          locale: locale == 'bn' ? 'bn' : 'en_IN',
          decimalDigits: value % 1 == 0 ? 0 : 2,
        );
  return '৳${format.format(value)}';
}

String dateLabel(DateTime value, {String locale = 'en'}) =>
    DateFormat.yMMMd(locale == 'bn' ? 'bn' : 'en').format(value);
String dateTimeLabel(DateTime value, {String locale = 'en'}) => _localizePeriod(
  DateFormat('EEE d MMM, h:mm a', locale == 'bn' ? 'bn' : 'en').format(value),
  locale,
);

String timeLabel(DateTime value, {String locale = 'en'}) => _localizePeriod(
  DateFormat.jm(locale == 'bn' ? 'bn' : 'en').format(value),
  locale,
);

String _localizePeriod(String value, String locale) => locale == 'bn'
    ? value.replaceAll('AM', 'পূর্বাহ্ণ').replaceAll('PM', 'অপরাহ্ণ')
    : value;

String numberLabel(num value, {String locale = 'en'}) =>
    NumberFormat.decimalPattern(locale == 'bn' ? 'bn' : 'en_IN').format(value);

/// Accept localized digits in numeric input.
String normalizedDigits(String value) => value.replaceAllMapped(
  RegExp('[০-৯]'),
  (m) => '${m[0]!.codeUnitAt(0) - 0x09e6}',
);

/// Bangladeshi number in international form for wa.me links.
String? whatsappNumber(String? phone) {
  if (phone == null || phone.trim().isEmpty) return null;
  final digits = phone.replaceAll(RegExp(r'[^\d]'), '');
  return digits.startsWith('0') ? '88$digits' : digits;
}

/// Extracts a guest token from a scanned RSVP link or a raw token.
String tokenFromScan(String raw) {
  final match = RegExp(r'/rsvp/(?:family/)?([A-Za-z0-9_-]{16,})')
      .firstMatch(raw);
  return match?.group(1) ?? raw.trim();
}
