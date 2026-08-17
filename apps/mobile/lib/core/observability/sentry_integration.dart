import 'dart:async';
import 'package:flutter/widgets.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

const String _dsn = String.fromEnvironment('SENTRY_DSN');
const String _environment = String.fromEnvironment('SENTRY_ENVIRONMENT', defaultValue: 'development');
const String _release = String.fromEnvironment('SENTRY_RELEASE');
const String _tracesSampleRateStr = String.fromEnvironment('SENTRY_TRACES_SAMPLE_RATE');

final _sensitiveKeys = <String>{
  'authorization',
  'access_token',
  'refresh_token',
  'password',
  'password_hash',
  'jwt',
  'database_url',
  'database',
  'sentry_dsn',
  'cookie',
  'secret',
  'private_key',
};

bool _isSensitive(String key) {
  return _sensitiveKeys.contains(key.toLowerCase());
}

String _scrubString(String val) {
  if (val.contains('Bearer ') || val.contains('postgres://')) {
    return '[REDACTED]';
  }
  return val;
}

dynamic _scrubObject(dynamic obj, [int depth = 0]) {
  if (depth > 5) return obj;
  if (obj == null) return null;

  if (obj is String) {
    return _scrubString(obj);
  } else if (obj is List) {
    return obj.map((e) => _scrubObject(e, depth + 1)).toList();
  } else if (obj is Map) {
    final scrubbed = <String, dynamic>{};
    for (final entry in obj.entries) {
      final key = entry.key.toString();
      if (_isSensitive(key)) {
        scrubbed[key] = '[REDACTED]';
      } else {
        scrubbed[key] = _scrubObject(entry.value, depth + 1);
      }
    }
    return scrubbed;
  }
  return obj;
}

FutureOr<SentryEvent?> _beforeSend(SentryEvent event, Hint hint) {
  SentryRequest? req = event.request;
  if (req != null) {
    req = req.copyWith(
      headers: (_scrubObject(req.headers) as Map).cast<String, String>(),
      data: _scrubObject(req.data),
    );
  }

  List<Breadcrumb>? breadcrumbs;
  if (event.breadcrumbs != null) {
    breadcrumbs = event.breadcrumbs!.map((b) {
      return b.copyWith(
        message: b.message != null ? _scrubString(b.message!) : null,
        data: b.data != null ? (_scrubObject(b.data) as Map).cast<String, dynamic>() : null,
      );
    }).toList();
  }

  Map<String, String>? tags;
  if (event.tags != null) {
    tags = (_scrubObject(event.tags) as Map).cast<String, String>();
  }
  
  Map<String, dynamic>? contexts;
  contexts = (_scrubObject(event.contexts.toJson()) as Map).cast<String, dynamic>();

  return event.copyWith(
    request: req,
    breadcrumbs: breadcrumbs,
    tags: tags,
    contexts: Contexts.fromJson(contexts),
  );
}

@visibleForTesting
FutureOr<SentryEvent?> scrubEventForTest(SentryEvent event, {Hint? hint}) {
  return _beforeSend(event, hint ?? Hint());
}

double _parseSampleRate() {
  if (_tracesSampleRateStr.isEmpty) return 0.0;
  final val = double.tryParse(_tracesSampleRateStr);
  if (val == null || val < 0.0 || val > 1.0) return 0.0;
  return val;
}

Future<void> initSentry(AppRunner appRunner) async {
  if (_dsn.isEmpty) {
    await appRunner();
    return;
  }

  await SentryFlutter.init(
    (options) {
      options.dsn = _dsn;
      options.environment = _environment;
      if (_release.isNotEmpty) {
        options.release = _release;
      }
      options.tracesSampleRate = _parseSampleRate();
      options.beforeSend = _beforeSend;
    },
    appRunner: appRunner,
  );
}
