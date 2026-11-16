import 'package:ayojon/core/api/api_error.dart';
import 'package:ayojon/core/strings.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('HTTP errors use localized messages and do not expose server text', () {
    final bn = S.of('bn');
    expect(ApiError('secret server text', status: 401).localized(bn), bn.t('errorUnauthorized'));
    expect(ApiError('secret server text', status: 500).localized(bn), bn.t('genericError'));
    expect(ApiError('secret server text', status: 422).localized(S.of('en')), S.of('en').t('errorValidation'));
  });

  test('known server codes have translated labels', () {
    expect(S.of('bn').codeLabel('AWAITING_ADVANCE'), 'অগ্রিমের অপেক্ষায়');
    expect(S.of('en').codeLabel('ACCEPTED'), 'Accepted');
    expect(S.of('bn').codeLabel('UNRECOGNIZED_CODE'), S.of('bn').t('unknownStatus'));
  });
}
