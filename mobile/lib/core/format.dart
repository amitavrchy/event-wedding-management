import 'package:intl/intl.dart';

/// Money is integer paisa everywhere in the API.
String taka(num minor, {bool compact = false}) {
  final value = minor / 100;
  final format = compact ? NumberFormat.compact(locale: 'en_IN') : NumberFormat.decimalPatternDigits(locale: 'en_IN', decimalDigits: value % 1 == 0 ? 0 : 2);
  return '৳${format.format(value)}';
}

String dateLabel(DateTime value, {String locale = 'en'}) => DateFormat.yMMMd(locale == 'bn' ? 'bn' : 'en').format(value);
String dateTimeLabel(DateTime value, {String locale = 'en'}) => DateFormat('EEE d MMM, h:mm a', locale == 'bn' ? 'bn' : 'en').format(value);

/// Bangladeshi number in international form for wa.me links.
String? whatsappNumber(String? phone) {
  if (phone == null || phone.trim().isEmpty) return null;
  final digits = phone.replaceAll(RegExp(r'[^\d]'), '');
  return digits.startsWith('0') ? '88$digits' : digits;
}

/// Extracts a guest token from a scanned RSVP link or a raw token.
String tokenFromScan(String raw) {
  final match = RegExp(r'/rsvp/(?:family/)?([A-Za-z0-9_-]{16,})').firstMatch(raw);
  return match?.group(1) ?? raw.trim();
}
