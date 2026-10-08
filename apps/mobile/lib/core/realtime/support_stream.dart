// The support stream: the bell's live notifications and the support chat (Ask Ezymex AI replies too), one
// connection per app (port of apps/crm/lib/realtime.ts). Ticket from `POST support/stream-ticket`; in production its
// `url` is null, so the socket opens config.urls.streams.support + ?ticket=. Frames: ping (ignored), resync (->
// "reconnected": reload what may have been missed), hello {unread}, notification {item, unread},
// notifications.read {ids | all | cleared, unread}, and the chat frames. A re-open after a drop also emits
// {"type": "reconnected"}.
import 'dart:async';

import '../api/api_client.dart';
import '../api/api_error.dart';
import 'backoff.dart';
import 'socket.dart';

class SupportStream {
  SupportStream({required ApiClient api, required String Function() streamUrl, SocketConnector? connector}) {
    _socket = ReconnectingSocket(
      name: 'support',
      resolveUrl: () async {
        try {
          final t = await api.post<Map<String, dynamic>>('support/stream-ticket');
          final ticket = t['ticket'] as String?;
          if (ticket == null) throw const ApiException(status: 502, code: 'unavailable', message: 'no ticket');
          final base = (t['url'] is String && (t['url'] as String).isNotEmpty) ? t['url'] as String : streamUrl();
          return Uri.parse('$base?ticket=${Uri.encodeQueryComponent(ticket)}');
        } on ApiException catch (e) {
          if (e.status == 401) throw const SocketFatal();
          if (e.isModuleDisabled || e.isReadOnly) throw const SocketUnavailable(Duration(minutes: 5));
          rethrow;
        }
      },
      onFrame: _onFrame,
      onOpen: () {
        if (_everOpen) _out.add(const {'type': 'reconnected'});
        _everOpen = true;
      },
      backoff: Backoff(),
      silentAfter: const Duration(seconds: 60),
      connector: connector,
    );
  }

  late final ReconnectingSocket _socket;
  final StreamController<Map<String, dynamic>> _out = StreamController.broadcast();
  bool _everOpen = false;

  /// Every frame except pings (`resync` arrives as `reconnected`).
  Stream<Map<String, dynamic>> get frames => _out.stream;
  SocketStatus get status => _socket.status;

  void start() => _socket.start();
  void resume() => _socket.resume();

  void stop() {
    _socket.stop();
    _everOpen = false;
  }

  Future<void> dispose() async {
    _socket.stop();
    await _out.close();
  }

  void _onFrame(Map<String, dynamic> f) {
    final type = f['type'];
    if (type == 'ping') return;
    _out.add(type == 'resync' ? const {'type': 'reconnected'} : f);
  }
}
