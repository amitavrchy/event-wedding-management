import 'dart:convert';
import 'dart:typed_data';

import 'package:ayojon/core/api/api_client.dart';
import 'package:ayojon/core/auth/token_store.dart';
import 'package:ayojon/core/providers.dart';
import 'package:ayojon/core/strings.dart';
import 'package:ayojon/features/tools/more_tools.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _Tokens extends TokenStore {
  @override
  Future<String?> access() async => 'access';
}

class _Adapter implements HttpClientAdapter {
  final requests = <RequestOptions>[];
  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? stream, Future<void>? cancelFuture) async {
    requests.add(options);
    final body = options.method == 'GET'
        ? {'services': [{'id': 'service-1', 'title': 'Photography'}]}
        : {'ok': true};
    return ResponseBody.fromString(jsonEncode(body), 200, headers: {Headers.contentTypeHeader: ['application/json']});
  }
  @override
  void close({bool force = false}) {}
}

void main() {
  testWidgets('accepting a quote sends the chosen service and Dhaka start time', (tester) async {
    final adapter = _Adapter();
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api/'))..httpClientAdapter = adapter;
    final client = ApiClient(_Tokens(), dio: dio);
    await tester.pumpWidget(ProviderScope(
      overrides: [apiProvider.overrideWithValue(client), stringsProvider.overrideWithValue(S.of('en'))],
      child: MaterialApp(home: Scaffold(body: Consumer(builder: (context, ref, _) =>
        TextButton(onPressed: () => acceptQuote(context, ref, {'id': 'quote-1', 'vendorId': 'vendor-1'}), child: const Text('Open'))))),
    ));
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    expect(adapter.requests.first.path, 'vendors/vendor-1');
    await tester.tap(find.text('Choose date'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('${DateTime.now().day}').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Choose time (Dhaka)'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Accept'));
    await tester.pumpAndSettle();
    final request = adapter.requests.last;
    expect(request.path, 'quotes/quote-1/respond');
    final body = request.data as Map;
    expect(body['status'], 'ACCEPTED');
    expect(body['serviceId'], 'service-1');
    expect(DateTime.tryParse(body['startAt'] as String)?.isUtc, isTrue);
  });
}
