class SyncHttpException implements Exception {
  final int? statusCode;
  final String code;
  final String message;
  final String? body;

  SyncHttpException({
    this.statusCode,
    this.code = 'UNKNOWN_ERROR',
    this.message = 'Sync HTTP Error',
    this.body,
  });

  bool get isNetworkError => statusCode == null;
  bool get isTimeout => this is SyncTimeoutException;
  bool get isConflict => statusCode == 409;
  bool get isServerError => statusCode != null && statusCode! >= 500;
  bool get isValidationError => statusCode == 400 || statusCode == 422;

  @override
  String toString() => 'SyncHttpException($code): $message';
}

class SyncTimeoutException extends SyncHttpException {
  SyncTimeoutException(String message)
    : super(statusCode: null, code: 'TIMEOUT', message: message);
}

class SyncNetworkException extends SyncHttpException {
  SyncNetworkException(String message)
    : super(statusCode: null, code: 'NETWORK_ERROR', message: message);
}

class SyncConflictException extends SyncHttpException {
  SyncConflictException({
    required super.code,
    required super.message,
    super.body,
  }) : super(statusCode: 409);
}

class SyncValidationException extends SyncHttpException {
  SyncValidationException({
    required super.code,
    required super.message,
    super.body,
  }) : super(statusCode: 400);
}

class SyncServerException extends SyncHttpException {
  SyncServerException({
    required int super.statusCode,
    required super.code,
    required super.message,
    super.body,
  });
}

class SyncMalformedResponseException extends SyncHttpException {
  SyncMalformedResponseException(String message)
    : super(statusCode: null, code: 'MALFORMED_RESPONSE', message: message);
}
