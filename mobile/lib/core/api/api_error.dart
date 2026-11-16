import 'package:dio/dio.dart';

import '../strings.dart';

/// A readable error from the API (its `message`) or the network.
class ApiError implements Exception {
  ApiError(this.message, {this.status});
  final String message;
  final int? status;

  factory ApiError.from(Object error) {
    if (error is ApiError) return error;
    if (error is DioException) {
      final data = error.response?.data;
      String? message;
      if (data is Map && data['message'] != null) {
        final m = data['message'];
        message = m is List ? m.join(', ') : m.toString();
      }
      if (message == null) {
        switch (error.type) {
          case DioExceptionType.connectionTimeout:
          case DioExceptionType.receiveTimeout:
          case DioExceptionType.sendTimeout:
          case DioExceptionType.connectionError:
            message = 'No internet connection. Check your network and try again.';
          default:
            message = 'Something went wrong. Please try again.';
        }
      }
      return ApiError(message, status: error.response?.statusCode);
    }
    return ApiError(error.toString());
  }

  /// Never expose arbitrary server messages in the UI.
  String localized(S s) {
    final key = switch (status) {
      400 || 422 => 'errorValidation',
      401 => 'errorUnauthorized',
      403 => 'errorForbidden',
      404 => 'errorNotFound',
      409 => 'errorConflict',
      429 => 'errorRateLimit',
      _ => message.startsWith('No internet connection.') ? 'errorNetwork' : 'genericError',
    };
    return s.t(key);
  }

  @override
  String toString() => message;
}
