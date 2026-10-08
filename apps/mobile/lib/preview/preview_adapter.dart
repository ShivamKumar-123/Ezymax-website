// Answers every API call from preview_data.dart (development previews, golden tests and the in-app demo). Sign-in
// accepts any password and code; "wrong@example.com" answers invalid_credentials, so the error states can be seen too.
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../features/terminal/preview/preview_server.dart';
import 'c1/preview_c1.dart';
import 'c2/c2_preview.dart';
import 'preview_data.dart';

class PreviewAdapter implements HttpClientAdapter {
  PreviewAdapter({this.latency = const Duration(milliseconds: 220)});
  final Duration latency;

  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    await Future<void>.delayed(latency);
    final path = o.uri.path.replaceFirst(RegExp(r'^.*/api/mobile/'), '').replaceFirst(RegExp(r'^/'), '');
    final body = o.data is Map ? (o.data as Map).cast<String, dynamic>() : const <String, dynamic>{};
    // agent C1's pages answer first (they may extend the shared answers above with more fields)
    final (int status, Object data) =
        previewC1(o.method, path, body, o.uri.queryParameters) ??
        previewC2(o.method, path, body, o.uri.queryParameters) ??
        // Ezymex Trader: the preview trade server (agent D, lib/features/terminal/preview)
        PreviewServer.instance.answer(o.method, path, o.uri.queryParameters, body, o.headers['X-Ezymex-Trade'] as String?) ??
        _answer(o.method, path, body);
    return ResponseBody.fromString(
      jsonEncode(data),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  (int, Object) _answer(String method, String path, Map<String, dynamic> body) {
    Map<String, dynamic> error(String code, String message) => {
      'error': {'code': code, 'message': message},
    };
    final ok = {'status': 'ok'};
    final signedIn = {
      'status': 'ok',
      ...previewMe,
      'session': {'token': previewSession().token, 'expires_at': DateTime.now().add(const Duration(days: 7)).toIso8601String()},
    };
    switch (path) {
      case 'config':
        return (200, previewConfig);
      case 'auth/login':
        if (body['email'] == 'wrong@example.com') return (401, error('invalid_credentials', 'Wrong email or password.'));
        return (200, previewChallenge('login'));
      case 'auth/verify-email':
        if (body['code'] == '000000') {
          return (
            400,
            {
              'error': {'code': 'invalid_code', 'message': 'That code is not right.', 'attempts_left': 4},
            },
          );
        }
        return (200, signedIn);
      case 'auth/resend':
        return (200, previewChallenge('login'));
      case 'auth/register':
        return (200, previewChallenge('verify_email'));
      case 'auth/forgot':
        return (200, previewChallenge('reset_password'));
      case 'auth/reset':
      case 'auth/logout':
        return (200, ok);
      case 'auth/me':
        return (200, previewMe);
      case 'auth/heartbeat':
        return (200, {'ok': true, 'restrictions': <String>[]});
      case 'auth/stepup':
      case 'auth/stepup-resend':
        return (200, previewChallenge('confirm'));
      case 'auth/stepup-verify':
        return (200, {'stepup_token': 'preview-stepup'});
      case 'trading/accounts':
        return (200, previewAccounts);
      case 'wallet/overview':
        return (200, previewWalletOverview);
      case 'wallet/activity':
        return (200, previewWalletActivity);
      case 'wallet/config':
        return (200, previewWalletConfig);
      case 'growth/rewards':
        return (200, previewRewards);
      case 'reports/analytics':
        return (200, previewAnalytics());
      case 'notifications':
        return (200, previewNotifications);
      case 'notifications/read':
      case 'notifications/clear':
        return (200, {'ok': true, 'unread': 0});
      case 'support/stream-ticket':
        return (200, {'ticket': 'preview', 'url': null});
    }
    return (404, error('not_found', 'Not in the preview data: $method $path'));
  }

  @override
  void close({bool force = false}) {}
}
