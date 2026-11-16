import 'dart:convert';
import 'dart:typed_data';

import 'package:ayojon/core/api/api_client.dart';
import 'package:ayojon/core/api/api_error.dart';
import 'package:ayojon/core/auth/token_store.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

class MemoryTokens extends TokenStore {
  String accessToken = 'old';
  String refreshToken = 'refresh';
  @override
  Future<String?> access() async => accessToken;
  @override
  Future<String?> refresh() async => refreshToken;
  @override
  Future<void> save(String access, String refresh) async {
    accessToken = access;
    refreshToken = refresh;
  }
}

class TestAdapter implements HttpClientAdapter {
  TestAdapter(this.handle);
  final Future<ResponseBody> Function(RequestOptions) handle;
  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) => handle(options);
  @override
  void close({bool force = false}) {}
}

ResponseBody reply(int status, Map<String, Object> body) => ResponseBody.fromString(
  jsonEncode(body), status, headers: {Headers.contentTypeHeader: ['application/json']});

void main() {
  test('refresh rotates tokens and retries the original request', () async {
    final tokens = MemoryTokens();
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api/'));
    dio.httpClientAdapter = TestAdapter((request) async {
      if (request.path == 'auth/refresh') return reply(200, {'accessToken': 'new', 'refreshToken': 'next'});
      if (request.headers['Authorization'] == 'Bearer new') return reply(200, {'ok': true});
      return reply(401, {'message': 'expired'});
    });
    final client = ApiClient(tokens, dio: dio);
    expect(await client.get<Map<String, dynamic>>('events'), {'ok': true});
    expect(tokens.refreshToken, 'next');
  });

  test('invalid refresh expires the session', () async {
    final tokens = MemoryTokens();
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api/'));
    dio.httpClientAdapter = TestAdapter((request) async => reply(401, {'message': 'expired'}));
    final client = ApiClient(tokens, dio: dio);
    var expired = false;
    client.onSessionExpired = () => expired = true;
    await expectLater(client.get('events'), throwsA(isA<ApiError>()));
    expect(expired, isTrue);
  });

  test('a retried request still unauthorized expires the session', () async {
    final tokens = MemoryTokens();
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api/'));
    dio.httpClientAdapter = TestAdapter((request) async {
      if (request.path == 'auth/refresh') return reply(200, {'accessToken': 'new', 'refreshToken': 'next'});
      return reply(401, {'message': 'expired'});
    });
    final client = ApiClient(tokens, dio: dio);
    var expired = false;
    client.onSessionExpired = () => expired = true;
    await expectLater(client.get('events'), throwsA(isA<ApiError>()));
    expect(expired, isTrue);
  });

  test('offline refresh reports network error without expiring session', () async {
    final tokens = MemoryTokens();
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api/'));
    dio.httpClientAdapter = TestAdapter((request) async {
      if (request.path == 'auth/refresh') {
        throw DioException(requestOptions: request, type: DioExceptionType.connectionError);
      }
      return reply(401, {'message': 'expired'});
    });
    final client = ApiClient(tokens, dio: dio);
    var expired = false;
    client.onSessionExpired = () => expired = true;
    await expectLater(client.get('events'), throwsA(isA<ApiError>().having((e) => e.status, 'status', isNull)));
    expect(expired, isFalse);
    expect(tokens.refreshToken, 'refresh');
  });
}
