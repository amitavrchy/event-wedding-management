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

  test('profile and socket token requests refresh expired bearer tokens', () async {
    for (final path in ['auth/me', 'auth/socket-token', 'auth/devices']) {
      final tokens = MemoryTokens();
      final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api/'));
      var refreshes = 0;
      dio.httpClientAdapter = TestAdapter((request) async {
        if (request.path == 'auth/refresh') {
          refreshes++;
          expect(request.headers['Authorization'], isNull);
          expect(request.data, {'refreshToken': 'refresh'});
          return reply(200, {'accessToken': 'new', 'refreshToken': 'next'});
        }
        return request.headers['Authorization'] == 'Bearer new'
            ? reply(200, {'ok': true}) : reply(401, {'message': 'expired'});
      });
      final client = ApiClient(tokens, dio: dio);
      expect(await client.get<Map<String, dynamic>>(path), {'ok': true});
      expect(refreshes, 1);
    }
  });

  test('bad credentials do not refresh or expire an existing session', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api/'));
    var calls = 0;
    dio.httpClientAdapter = TestAdapter((request) async {
      calls++;
      return reply(401, {'message': 'Incorrect email or password'});
    });
    final client = ApiClient(MemoryTokens(), dio: dio);
    var expired = false;
    client.onSessionExpired = () => expired = true;
    await expectLater(client.post('auth/login', {}), throwsA(isA<ApiError>()));
    expect(calls, 1);
    expect(expired, false);
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
