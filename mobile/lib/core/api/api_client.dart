import 'dart:async';

import 'package:dio/dio.dart';

import '../auth/token_store.dart';
import '../config.dart';
import 'api_error.dart';

/// HTTP client for the Ayojon API.
///
/// Sends the access token as a bearer token. When it expires (401), the
/// refresh token is rotated once — concurrent requests share one refresh —
/// and the request is retried. If refreshing fails, [onSessionExpired] runs.
class ApiClient {
  ApiClient(this.tokens, {Dio? dio})
      : dio = dio ??
            Dio(BaseOptions(
              baseUrl: AppConfig.apiUrl,
              connectTimeout: const Duration(seconds: 15),
              receiveTimeout: const Duration(seconds: 30),
              headers: {'Accept': 'application/json'},
            )) {
    this.dio.interceptors.add(InterceptorsWrapper(
          onRequest: (options, handler) async {
            final token = await tokens.access();
            if (token != null && options.headers['Authorization'] == null) {
              options.headers['Authorization'] = 'Bearer $token';
            }
            handler.next(options);
          },
          onError: (error, handler) async {
            final request = error.requestOptions;
            final unauthorized = error.response?.statusCode == 401;
            if (!unauthorized || request.path.startsWith('auth/') || request.extra['retried'] == true) {
              return handler.next(error);
            }
            if (await _refresh()) {
              request.extra['retried'] = true;
              request.headers['Authorization'] = 'Bearer ${await tokens.access()}';
              try {
                return handler.resolve(await this.dio.fetch(request));
              } on DioException catch (e) {
                return handler.next(e);
              }
            }
            onSessionExpired?.call();
            handler.next(error);
          },
        ));
  }

  final TokenStore tokens;
  final Dio dio;
  void Function()? onSessionExpired;
  Completer<bool>? _refreshing;

  Future<bool> _refresh() {
    final pending = _refreshing;
    if (pending != null) return pending.future;
    final completer = _refreshing = Completer<bool>();
    () async {
      try {
        final refresh = await tokens.refresh();
        if (refresh == null) return completer.complete(false);
        final response = await dio.post('auth/refresh',
            data: {'refreshToken': refresh}, options: Options(headers: {'Authorization': null}));
        final data = response.data as Map<String, dynamic>;
        await tokens.save(data['accessToken'] as String, data['refreshToken'] as String);
        completer.complete(true);
      } on DioException catch (e) {
        // 409: another request refreshed a moment ago and saved new tokens.
        completer.complete(e.response?.statusCode == 409 && await tokens.access() != null);
      } catch (_) {
        completer.complete(false);
      } finally {
        _refreshing = null;
      }
    }();
    return completer.future;
  }

  Future<T> _call<T>(Future<Response<dynamic>> Function() request) async {
    try {
      final response = await request();
      return response.data as T;
    } catch (e) {
      throw ApiError.from(e);
    }
  }

  Future<T> get<T>(String path, {Map<String, dynamic>? query}) =>
      _call<T>(() => dio.get(path, queryParameters: query));
  Future<T> post<T>(String path, [Object? body]) => _call<T>(() => dio.post(path, data: body ?? {}));
  Future<T> patch<T>(String path, [Object? body]) => _call<T>(() => dio.patch(path, data: body ?? {}));
  Future<T> put<T>(String path, [Object? body]) => _call<T>(() => dio.put(path, data: body ?? {}));
  Future<T> delete<T>(String path, [Object? body]) => _call<T>(() => dio.delete(path, data: body));

  /// Uploads a file through the API's upload slot and returns the ready media record.
  Future<Map<String, dynamic>> upload(List<int> bytes, String contentType, String purpose, {String? fileName}) async {
    final slot = await post<Map<String, dynamic>>('uploads', {
      'purpose': purpose,
      'contentType': contentType,
      'sizeBytes': bytes.length,
      'fileName': ?fileName,
    });
    final upload = slot['upload'] as Map<String, dynamic>;
    final url = _absolute(upload['url'] as String);
    final plain = Dio();
    try {
      if (upload['method'] == 'POST') {
        final fields = Map<String, dynamic>.from(upload['fields'] as Map);
        fields['file'] = MultipartFile.fromBytes(bytes, filename: fileName ?? 'upload', contentType: DioMediaType.parse(contentType));
        await plain.post(url, data: FormData.fromMap(fields));
      } else {
        await plain.put(url,
            data: Stream.fromIterable([bytes]),
            options: Options(headers: {'Content-Type': contentType, Headers.contentLengthHeader: bytes.length}));
      }
    } catch (e) {
      throw ApiError.from(e);
    }
    return post<Map<String, dynamic>>('uploads/${slot['id']}/complete');
  }

  /// The local storage driver returns site-relative URLs.
  String _absolute(String url) {
    if (url.startsWith('http')) return url;
    final api = Uri.parse(AppConfig.apiUrl);
    return '${api.scheme}://${api.authority}$url';
  }

  String absoluteUrl(String url) => _absolute(url);
}
